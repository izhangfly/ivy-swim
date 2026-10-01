#!/usr/bin/env python3
"""Ivy Swim Analytics - stdlib-only HTTP server.

Serves the dashboard, owns the SQLite result store, and brokers DeepSeek calls so
the API key never leaves the machine. No third-party packages, no venv.
"""
import base64, csv, hashlib, hmac, io, json, mimetypes, os, re, secrets, sqlite3, sys
import threading, time
import urllib.error, urllib.parse, urllib.request
from datetime import datetime, date, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import exporters

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get('IVY_DB', os.path.join(ROOT, 'data', 'ivy.db'))
STATIC = os.path.join(ROOT, 'static')
PORT = int(os.environ.get('IVY_PORT', '8830'))
HOST = os.environ.get('IVY_HOST', '0.0.0.0')
MAX_BODY = 24 * 1024 * 1024          # room for a phone screenshot as base64

DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY', "")
DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
TEXT_MODEL = os.environ.get('DEEPSEEK_TEXT_MODEL', 'deepseek-v4-flash')
VISION_MODEL = os.environ.get('DEEPSEEK_VISION_MODEL', 'deepseek-v4-flash-vision-exp')
ADVICE_MODEL = os.environ.get('DEEPSEEK_ADVICE_MODEL', 'deepseek-v4-pro')

STROKES = ('Free', 'Back', 'Breast', 'Fly', 'IM')
COURSES = ('SCM', 'LCM')
_lock = threading.Lock()

ATHLETE_NAME = os.environ.get('IVY_ATHLETE', "")
ATHLETE_PREFERRED = os.environ.get('IVY_PREFERRED', 'Ivy')
ATHLETE_BIRTH = os.environ.get('IVY_BIRTH', "")
PUBLIC_URL = os.environ.get('IVY_PUBLIC_URL', 'http://YOUR_SERVER_IP:8830/')

STROKE_EN = {'Free': 'Freestyle', 'Back': 'Backstroke', 'Breast': 'Breaststroke',
             'Fly': 'Butterfly', 'IM': 'Individual Medley'}
STROKE_ZH = {'Free': '自由泳', 'Back': '仰泳', 'Breast': '蛙泳',
             'Fly': '蝶泳', 'IM': '混合泳'}

# World-record base times (seconds) for World Aquatics points, P = 1000·(B/T)³.
WR = {
 'F|SCM': {'50Free':22.83,'100Free':49.93,'200Free':109.36,'400Free':230.25,'800Free':474.00,'1500Free':908.24,
           '50Back':25.23,'100Back':54.02,'200Back':117.33,
           '50Breast':28.37,'100Breast':62.36,'200Breast':132.50,
           '50Fly':23.72,'100Fly':52.71,'200Fly':119.32,
           '100IM':55.11,'200IM':121.63,'400IM':255.48},
 'F|LCM': {'50Free':23.19,'100Free':51.68,'200Free':112.23,'400Free':234.18,'800Free':484.12,'1500Free':920.48,
           '50Back':26.56,'100Back':57.13,'200Back':123.14,
           '50Breast':29.16,'100Breast':64.13,'200Breast':137.55,
           '50Fly':24.43,'100Fly':54.33,'200Fly':121.65,
           '200IM':125.70,'400IM':263.65},
 'M|SCM': {'50Free':19.90,'100Free':44.84,'200Free':98.61,'400Free':212.25,'800Free':440.46,'1500Free':846.88,
           '50Back':22.11,'100Back':48.16,'200Back':105.12,
           '50Breast':24.95,'100Breast':55.28,'200Breast':119.52,
           '50Fly':21.32,'100Fly':47.68,'200Fly':106.85,
           '100IM':49.28,'200IM':108.88,'400IM':234.81},
 'M|LCM': {'50Free':20.88,'100Free':46.40,'200Free':102.00,'400Free':219.96,'800Free':452.12,'1500Free':870.67,
           '50Back':23.55,'100Back':51.60,'200Back':111.92,
           '50Breast':25.95,'100Breast':56.88,'200Breast':125.48,
           '50Fly':22.27,'100Fly':49.45,'200Fly':110.34,
           '200IM':112.69,'400IM':242.50},
}
WR_ASOF_EN = 'world records as of September 2026'
WR_ASOF_ZH = '2026年9月的世界纪录'


def wa_points(r, gender='F'):
    base = WR.get(f"{gender}|{r['course']}", {}).get(f"{r['distance']}{r['stroke']}")
    return round(1000 * (base / r['seconds']) ** 3) if base else None


def clock(sec):
    if sec is None:
        return ''
    return f'{int(sec // 60)}:{sec % 60:05.2f}' if sec >= 60 else f'{sec:.2f}'


def age_on(iso, birth=None):
    b = date.fromisoformat(birth or ATHLETE_BIRTH)
    d = date.fromisoformat(iso)
    y = d.year - b.year
    m = d.month - b.month
    if d.day < b.day:
        m -= 1
    if m < 0:
        y -= 1; m += 12
    return y, m


def personal_bests(rows, gender='F'):
    """Fastest swim per distance/stroke/course, ordered for reading."""
    best = {}
    for r in rows:
        k = (r['distance'], r['stroke'], r['course'])
        if k not in best or r['seconds'] < best[k]['seconds']:
            best[k] = r
    out = list(best.values())
    out.sort(key=lambda r: (STROKES.index(r['stroke']), r['distance'], r['course']))
    return out


# ---- access control -------------------------------------------------------
# The passcode lives only in the server environment. The browser never receives
# it and never sends it: it answers a one-time nonce with SHA-256(nonce:passcode),
# so the secret is absent from the page source and from the wire.
PASSCODE = os.environ.get('IVY_PASSCODE', '')
SESSION_TTL = 12 * 3600
NONCE_TTL = 180
MAX_FAILS = 8
FAIL_WINDOW = 600

_sessions = {}          # token -> expiry
_nonces = {}            # nonce -> expiry
_fails = {}             # client ip -> [timestamps]
_auth_lock = threading.Lock()


def _sweep(now):
    for d in (_sessions, _nonces):
        for k in [k for k, exp in d.items() if exp < now]:
            d.pop(k, None)
    for ip in list(_fails):
        _fails[ip] = [t for t in _fails[ip] if now - t < FAIL_WINDOW]
        if not _fails[ip]:
            _fails.pop(ip, None)


def new_nonce():
    now = time.time()
    with _auth_lock:
        _sweep(now)
        if len(_nonces) > 200:
            _nonces.clear()
        n = secrets.token_hex(16)
        _nonces[n] = now + NONCE_TTL
    return n


def verify_proof(nonce, proof, ip):
    """Single-use nonce; constant-time comparison; per-IP attempt limiting."""
    now = time.time()
    with _auth_lock:
        _sweep(now)
        if len(_fails.get(ip, [])) >= MAX_FAILS:
            return None, 'too many attempts, try again later'
        if not PASSCODE:
            return None, 'the server has no passcode configured'
        if _nonces.pop(nonce, None) is None:
            return None, 'that attempt expired, please try again'
        expected = hashlib.sha256(f'{nonce}:{PASSCODE}'.encode()).hexdigest()
        if not hmac.compare_digest(expected, str(proof or '').lower()):
            _fails.setdefault(ip, []).append(now)
            return None, 'incorrect passcode'
        token = secrets.token_urlsafe(24)
        _sessions[token] = now + SESSION_TTL
        _fails.pop(ip, None)
    return token, None


def session_valid(token):
    if not token:
        return False
    with _auth_lock:
        exp = _sessions.get(token)
        if not exp:
            return False
        if exp < time.time():
            _sessions.pop(token, None)
            return False
    return True


# ---- short-lived download tokens -----------------------------------------
# The browser builds each export as a PNG on a canvas and posts it here; the file
# is handed back through a normal URL so in-app browsers (WeChat especially),
# which ignore blob: and <a download>, still receive a real HTTP download.
_downloads = {}
_dl_lock = threading.Lock()
DL_TTL = 900
DL_MAX = 40


def stash_download(data, filename, ctype):
    with _dl_lock:
        now = time.time()
        for k in [k for k, v in _downloads.items() if now - v['at'] > DL_TTL]:
            _downloads.pop(k, None)
        while len(_downloads) >= DL_MAX:
            _downloads.pop(min(_downloads, key=lambda k: _downloads[k]['at']), None)
        token = secrets.token_urlsafe(16)
        _downloads[token] = {'data': data, 'name': filename, 'ctype': ctype, 'at': now}
    return token


# ----------------------------------------------------------------- storage ---
def connect():
    con = sqlite3.connect(DB_PATH, timeout=20)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA journal_mode=WAL')
    return con


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = connect()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, course TEXT NOT NULL, distance INTEGER NOT NULL,
        stroke TEXT NOT NULL, seconds REAL NOT NULL,
        meet TEXT DEFAULT '', round TEXT DEFAULT '', note TEXT DEFAULT '',
        source TEXT DEFAULT 'manual', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS results_dedupe
        ON results(date, course, distance, stroke, seconds);
    """)
    con.commit()
    n = con.execute('SELECT COUNT(*) c FROM results').fetchone()['c']
    if n == 0:
        seed = os.path.join(ROOT, 'data', 'seed.json')
        if os.path.exists(seed):
            rows = json.load(open(seed))
            now = datetime.now(timezone.utc).isoformat()
            con.executemany(
                'INSERT OR IGNORE INTO results(date,course,distance,stroke,seconds,'
                'meet,round,note,source,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                [(r['date'], r['course'], int(r['distance']), r['stroke'],
                  float(r['seconds']), r.get('meet', ''), r.get('round', ''),
                  r.get('note', ''), r.get('source', 'workbook'), now) for r in rows])
            con.commit()
            print(f'[init] seeded {len(rows)} results', flush=True)
    con.close()


def all_results():
    con = connect()
    rows = [dict(r) for r in con.execute(
        'SELECT * FROM results ORDER BY date, stroke, distance, seconds').fetchall()]
    con.close()
    return rows


# ------------------------------------------------------------- validation ---
def clean_row(r):
    """Normalise one incoming result. Raises ValueError with a readable message."""
    d = str(r.get('date', '')).strip()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', d):
        raise ValueError(f'bad date {d!r} (want YYYY-MM-DD)')
    date.fromisoformat(d)
    course = str(r.get('course', '')).strip().upper()
    course = {'SC': 'SCM', 'LC': 'LCM', '25': 'SCM', '50': 'LCM'}.get(course, course)
    if course not in COURSES:
        raise ValueError(f'bad course {course!r} (want SCM or LCM)')
    stroke = str(r.get('stroke', '')).strip().title()
    stroke = {'Freestyle': 'Free', 'Free Style': 'Free', 'Fr': 'Free',
              'Backstroke': 'Back', 'Bk': 'Back',
              'Breaststroke': 'Breast', 'Br': 'Breast', 'Brst': 'Breast',
              'Butterfly': 'Fly', 'Fl': 'Fly',
              'Im': 'IM', 'Medley': 'IM', 'Individual Medley': 'IM',
              '自由泳': 'Free', '自': 'Free', '仰泳': 'Back', '仰': 'Back',
              '蛙泳': 'Breast', '蛙': 'Breast', '蝶泳': 'Fly', '蝶': 'Fly',
              '混合泳': 'IM', '混': 'IM'}.get(stroke, stroke)
    if stroke not in STROKES:
        raise ValueError(f'bad stroke {stroke!r}')
    distance = int(float(r.get('distance', 0)))
    if not (25 <= distance <= 25000):
        raise ValueError(f'bad distance {distance!r}')
    seconds = parse_time(r.get('seconds', r.get('time', '')))
    if not (5 <= seconds <= 3600):
        raise ValueError(f'time out of range: {seconds}')
    return {'date': d, 'course': course, 'distance': distance, 'stroke': stroke,
            'seconds': round(seconds, 2), 'meet': str(r.get('meet', ''))[:200],
            'round': str(r.get('round', ''))[:40], 'note': str(r.get('note', ''))[:400],
            'source': str(r.get('source', 'manual'))[:40]}


def parse_time(v):
    """Accept 42.41, '1:23.96', '01:37.22', '3；04.91', or 104.72."""
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace('；', ':').replace('：', ':').replace(';', ':').replace("'", ':')
    m = re.fullmatch(r'(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)', s)
    if m:
        h = int(m.group(1) or 0)
        return h * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    m = re.fullmatch(r'(\d+):(\d+(?:\.\d+)?)', s)
    if m:
        return int(m.group(1)) * 60 + float(m.group(2))
    return float(s)


# -------------------------------------------------------------- deepseek ----
PARSE_SYSTEM = """You are a data-extraction component inside a swimming results database.
You convert meet screenshots, result listings and free-text notes into database rows.
You never converse. You never explain. You emit one JSON object and nothing else.

OUTPUT CONTRACT — emit exactly this shape:
{
  "results": [
    {
      "date": "YYYY-MM-DD",
      "course": "SCM" | "LCM" | null,
      "distance": <integer metres>,
      "stroke": "Free" | "Back" | "Breast" | "Fly" | "IM",
      "time": "SS.hh" | "M:SS.hh" | "MM:SS.hh",
      "meet": "<meet name, or empty string>",
      "round": "Heat" | "Final" | "Semfinal" | "Time Trial" | "",
      "confidence": <number 0.0-1.0>,
      "note": "<short, or empty string>"
    }
  ],
  "warnings": ["<one short sentence per problem>"]
}
No markdown fence. No prose before or after. If you find nothing usable, return
{"results": [], "warnings": ["<why>"]}.

THIS IS ABSOLUTE: your entire reply is one JSON object. Never write a sentence
outside it. If the input is unclear, contradictory, unreadable, empty, or you
object to it for any reason, you still reply with the JSON object and put your
objection in "warnings". A refusal in prose is a failure.

FIELD RULES
1. stroke — normalise to the five enum values exactly:
   freestyle / free / fr / 自由泳 / 自        -> "Free"
   backstroke / back / bk / 仰泳 / 仰         -> "Back"
   breaststroke / breast / br / 蛙泳 / 蛙     -> "Breast"
   butterfly / fly / fl / 蝶泳 / 蝶           -> "Fly"
   individual medley / IM / medley / 混合泳 / 混 -> "IM"
   A stroke you cannot map is not a swim you may emit. Warn instead.
2. distance — integer metres only (25, 50, 100, 200, 400, 800, 1500...).
   Strip the unit. "50 SC Meter Breaststroke" -> 50.
3. course — the POOL LENGTH the race was swum in, not the race distance:
   25 m pool / "SC" / "SCM" / "short course" / "25米池" / "短池"  -> "SCM"
   50 m pool / "LC" / "LCM" / "long course"  / "50米池" / "长池"  -> "LCM"
   Yards ("SCY", "yard") are NOT metric: do not emit the row, add a warning.
   If the pool length appears nowhere, set course to null and add a warning
   naming the event — never guess it.
4. time — the athlete's OFFICIAL FINAL SWUM TIME for that race. Keep hundredths.
   Never a seed/entry time (often labelled "Seed", "报名成绩", or greyed/left column).
   Never a split, never a reaction time, never a cumulative relay time.
   Normalise "1:23,96" / "1；23.96" / "1.23.96" to "1:23.96".
   Under a minute, emit plain seconds: "42.41".
5. date — the date the race was SWUM, ISO. Take the source at its word: if it
   gives a date later than TODAY, record that date anyway and add a warning
   noting it is in the future. Never drop a result over a date you doubt.
   Resolve relative words ("today",
   "yesterday", "last Saturday") against the TODAY value the user supplies.
   A session header date applies to every race under it. If only a day and month
   appear, take the year from the meet title or from TODAY, and drop confidence
   to 0.6 or below.
6. meet — the competition name as printed, trimmed. Empty string if absent.
7. round — Heat / Final / Semifinal / Time Trial when stated or clearly implied
   ("预赛"=Heat, "决赛"=Final). Empty string otherwise.
8. confidence — 1.0 only when every field was read directly off the source.
   Lower it for any inference; 0.5 or less if you are genuinely unsure.

EXTRACTION RULES
- Emit ONE object per swum race. Heats and finals of the same event are two rows.
- Skip DQ, DNS, NS, SCR, DNF and withdrawn entries. Warn once, briefly.
- Skip relay legs and relay totals.
- Skip other athletes: extract only the athlete the user is tracking. When several
  swimmers appear, prefer the highlighted/starred/own-result row; if you cannot
  tell whose result it is, extract it anyway and say so in warnings.
- Preserve every distinct race you can see, even a dozen of them.
- Do not invent a race that is not in the source.

WORKED EXAMPLES

Input: screenshot text "2026 City Autumn Open  ·  Session 3 — 05 Sep 2026
Event 14  Girls 50 SC Meter Breaststroke   Heat 2  Lane 4  Zhang Yijia  42.44"
Output:
{"results":[{"date":"2026-09-05","course":"SCM","distance":50,"stroke":"Breast",
"time":"42.44","meet":"2026 City Autumn Open","round":"Heat","confidence":1.0,
"note":""}],"warnings":[]}

Input: free text "at last weekend's long course meet ivy did 100 breast in 1:37.22
and swam 35.69 in the 50 back" with TODAY = 2026-09-10
Output:
{"results":[{"date":"2026-09-05","course":"LCM","distance":100,"stroke":"Breast",
"time":"1:37.22","meet":"","round":"","confidence":0.7,"note":"date inferred from
\'last weekend\'"},{"date":"2026-09-05","course":"LCM","distance":50,
"stroke":"Back","time":"35.69","meet":"","round":"","confidence":0.7,
"note":"date inferred from \'last weekend\'"}],"warnings":[]}

BEFORE YOU ANSWER, verify silently: every stroke is one of the five enum strings;
every distance is an integer; every time matches SS.hh or M:SS.hh; every date is
a real calendar date in ISO form; the JSON parses. Then emit the object alone."""


ADVICE_SYSTEM_EN = """You are a senior age-group swimming coach and performance analyst
writing a short briefing for the parents of a young swimmer. You are given the athlete's
complete competition record and a set of derived statistics.

Write for an intelligent reader who is not a sports scientist. Be concrete and specific:
cite actual times, dates and events from the data. Never invent a result, a rank, a
qualifying standard or a competitor. If the data cannot support a claim, do not make it.

Cover, under these exact headings:
## Where she stands
## What the numbers show
## What looks strong
## What to watch
## Questions worth asking the coach

Rules:
- 450-650 words total. Short paragraphs. No bullet-point soup: at most two short lists.
- Quote times as they appear (33.74, 1:23.96). Always say which pool length.
- World Aquatics points compare an event against its world record, so they are the only
  fair way to rank her events against each other. Explain that in one clause the first
  time you use them; do not lecture.
- Improvement rates are percentage change in race time per year from a log-linear fit.
  Negative is faster. Treat rates from fewer than three races as unavailable, not as zero.
- She is a child. Frame everything as development, never as a verdict on talent. Do not
  prescribe training volumes, dryland, diet, or anything medical. Suggest questions for
  the coach instead of instructions to the athlete.
- No hype, no emoji, no headings beyond the five given. Do not mention that you are an AI
  or that you were given data. Write the briefing only."""

ADVICE_SYSTEM_ZH = """你是一位资深的青少年游泳教练兼成绩分析师，正在为一名少年运动员的家长撰写一份简短的分析简报。
你将获得该运动员完整的比赛记录以及一组统计指标。

面向的读者聪明但并非体育科学专业人士。内容要具体：引用数据中真实的成绩、日期和项目。
绝不可虚构成绩、名次、达标线或对手。数据无法支撑的结论就不要写。

请严格使用以下小标题：
## 目前的水平
## 数据说明了什么
## 优势所在
## 需要留意的地方
## 可以和教练讨论的问题

要求：
- 全文800—1200字，段落简短。不要通篇罗列要点，最多两处简短列举。
- 成绩按原样引用（33.74、1:23.96），并始终注明池长（25米池／50米池）。
- 世界水上运动积分是把某项成绩与该项目世界纪录相比得出的，因此是横向比较不同项目的唯一公平方式。
  首次使用时用一句话说明即可，不要长篇解释。
- 进步速率来自对成绩取对数后的线性拟合，表示每年成绩的百分比变化，负值代表变快。
  少于三场比赛的项目视为无法评估，而不是零。
- 她还是个孩子。所有表述都应着眼于发展，而非对天赋下结论。不要给出训练量、陆上训练、
  饮食或任何医疗建议，而应提出可以与教练讨论的问题。
- 不要浮夸，不用表情符号，不要出现上述五个之外的标题。不要提及你是AI或你收到了数据。
  只输出这份简报。"""


def log_linear_rate(rows):
    """Percent change in race time per year, and R², from a log-time fit."""
    if len(rows) < 3:
        return None
    import math
    t0 = date.fromisoformat(rows[0]['date']).toordinal()
    pts = [((date.fromisoformat(r['date']).toordinal() - t0) / 365.2425,
            math.log(r['seconds'])) for r in rows]
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    if sxx == 0:
        return None
    b = sum((p[0] - mx) * (p[1] - my) for p in pts) / sxx
    a = my - b * mx
    ss_res = sum((p[1] - (a + b * p[0])) ** 2 for p in pts)
    ss_tot = sum((p[1] - my) ** 2 for p in pts)
    return {'rate_pct': (math.exp(b) - 1) * 100,
            'r2': 1 - ss_res / ss_tot if ss_tot > 0 else 1.0, 'n': n}


def advice_dossier(rows, gender='F', lang='en'):
    """A compact, unambiguous text digest of everything the site knows."""
    names = STROKE_ZH if lang == 'zh' else STROKE_EN
    by_event = {}
    for r in sorted(rows, key=lambda r: r['date']):
        by_event.setdefault((r['distance'], r['stroke'], r['course']), []).append(r)

    y, m = age_on(max(r['date'] for r in rows)) if rows else (0, 0)
    lines = [
        f'ATHLETE: {ATHLETE_NAME} (known as {ATHLETE_PREFERRED}), born {ATHLETE_BIRTH}.',
        f'Age at most recent race: {y}y {m}m. Points reference: '
        f'{"women" if gender == "F" else "men"}\'s world records.',
        f'TOTAL RACES: {len(rows)} across {len({r["date"] for r in rows})} competition days.',
        '',
        'PER-EVENT RECORD (event | pool | races | first | personal best | date of best | '
        'total gain | rate %/yr | R² | WA points at best):',
    ]
    for key in sorted(by_event, key=lambda k: (STROKES.index(k[1]), k[0], k[2])):
        rs = by_event[key]
        best = min(rs, key=lambda r: r['seconds'])
        first = rs[0]
        fit = log_linear_rate(rs)
        gain = first['seconds'] - best['seconds']
        lines.append(
            f'- {key[0]}m {names[key[1]]} | {"25m" if key[2] == "SCM" else "50m"} pool | '
            f'{len(rs)} races | first {clock(first["seconds"])} ({first["date"]}) | '
            f'PB {clock(best["seconds"])} ({best["date"]}) | '
            f'gain {gain:.2f}s | '
            f'{("rate " + format(fit["rate_pct"], ".1f") + "%/yr, R2 " + format(fit["r2"], ".2f")) if fit else "rate n/a (<3 races)"} | '
            f'{wa_points(best, gender) or "no base time"} pts')

    lines += ['', 'EVERY RACE (date | event | pool | time | age | WA points):']
    for r in sorted(rows, key=lambda r: (r['date'], r['stroke'])):
        ay, am = age_on(r['date'])
        lines.append(f'- {r["date"]} | {r["distance"]}m {names[r["stroke"]]} | '
                     f'{"25m" if r["course"] == "SCM" else "50m"} | {clock(r["seconds"])} | '
                     f'{ay}y{am}m | {wa_points(r, gender) or "-"}'
                     + (f' | {r["meet"]}' if r.get('meet') else '')
                     + (f' | {r["round"]}' if r.get('round') else ''))

    # speed endurance where a 50 and a 100 exist in the same stroke and pool
    import math
    endur = []
    for stroke in STROKES:
        for course in COURSES:
            a = by_event.get((50, stroke, course))
            b = by_event.get((100, stroke, course))
            if a and b:
                t50 = min(x['seconds'] for x in a)
                t100 = min(x['seconds'] for x in b)
                endur.append(f'- {names[stroke]} {"25m" if course == "SCM" else "50m"} pool: '
                             f'50={clock(t50)}, 100={clock(t100)}, '
                             f'Riegel n={math.log(t100 / t50) / math.log(2):.3f} '
                             f'(world-class 50->100 is about 1.05-1.10)')
    if endur:
        lines += ['', 'SPEED ENDURANCE (from personal bests):'] + endur
    return '\n'.join(lines)


def deepseek(messages, model, max_tokens=3000, timeout=150, attempts=3):
    if not DEEPSEEK_KEY:
        raise RuntimeError('DEEPSEEK_API_KEY is not set on the server')
    # NOTE: response_format={'type':'json_object'} makes this model return an
    # empty message, so the JSON contract is enforced by the prompt instead.
    body = json.dumps({'model': model, 'messages': messages, 'temperature': 0,
                       'max_tokens': max_tokens}).encode()
    req = urllib.request.Request(DEEPSEEK_URL, data=body, headers={
        'Content-Type': 'application/json', 'Authorization': f'Bearer {DEEPSEEK_KEY}'})
    last = None
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                choice = json.loads(resp.read())['choices'][0]
                text = (choice['message'].get('content') or '').strip()
                if text:
                    return text
                # These models spend tokens on hidden reasoning before writing the
                # answer; an empty reply almost always means the budget ran out.
                raise RuntimeError(
                    'the model returned an empty reply'
                    + (' (token budget exhausted before it began writing)'
                       if choice.get('finish_reason') == 'length' else ''))
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:400]
            last = RuntimeError(f'DeepSeek HTTP {e.code}: {detail}')
            if e.code in (429, 500, 502, 503):
                time.sleep(2 * (attempt + 1)); continue
            raise last
        except Exception as e:                                   # timeout / socket
            last = RuntimeError(f'DeepSeek call failed: {e}')
            if attempt + 1 < attempts:
                time.sleep(2 * (attempt + 1))
    raise last


def deepseek_stream(messages, model, max_tokens=16000, timeout=420):
    """Stream a completion.

    These models emit hidden reasoning before the answer, so a long request can
    sit silent past the point where the connection is dropped, and `max_tokens`
    has to cover reasoning *and* the answer. Streaming keeps the socket busy and
    lets the answer be accumulated as it arrives.
    """
    if not DEEPSEEK_KEY:
        raise RuntimeError('DEEPSEEK_API_KEY is not set on the server')
    body = json.dumps({'model': model, 'messages': messages, 'temperature': 0,
                       'max_tokens': max_tokens, 'stream': True}).encode()
    req = urllib.request.Request(DEEPSEEK_URL, data=body, headers={
        'Content-Type': 'application/json', 'Accept': 'text/event-stream',
        'Authorization': f'Bearer {DEEPSEEK_KEY}'})
    parts, finish = [], None
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            for raw in resp:
                line = raw.decode('utf-8', 'replace').strip()
                if not line.startswith('data:'):
                    continue
                payload = line[5:].strip()
                if payload == '[DONE]':
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                for choice in chunk.get('choices') or []:
                    piece = (choice.get('delta') or {}).get('content')
                    if piece:
                        parts.append(piece)
                    if choice.get('finish_reason'):
                        finish = choice['finish_reason']
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'DeepSeek HTTP {e.code}: '
                           f'{e.read().decode("utf-8", "replace")[:300]}')
    except Exception as e:
        if not parts:
            raise RuntimeError(f'DeepSeek stream failed: {e}')
    text = ''.join(parts).strip()
    if not text:
        raise RuntimeError('the model returned an empty reply'
                           + (' (token budget exhausted before it began writing)'
                              if finish == 'length' else ''))
    return text


def extract_json(text):
    text = re.sub(r'^\s*```(?:json)?|```\s*$', '', text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', text, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def run_parse(text, image_b64, image_mime):
    today = date.today().isoformat()
    prompt = f'TODAY is {today}. Extract the swim results.'
    if text:
        prompt += f'\n\nNotes from the user:\n{text.strip()}'
    if image_b64:
        content = [{'type': 'text', 'text': prompt + '\n\nThe screenshot is attached.'},
                   {'type': 'image_url',
                    'image_url': {'url': f'data:{image_mime};base64,{image_b64}'}}]
        model = VISION_MODEL
    else:
        content = prompt
        model = TEXT_MODEL
    messages = [{'role': 'system', 'content': PARSE_SYSTEM},
                {'role': 'user', 'content': content}]
    raw = deepseek(messages, model)
    try:
        parsed = extract_json(raw)
    except Exception:
        # The model answered in prose. Show it its own reply and demand JSON.
        parsed = extract_json(deepseek(messages + [
            {'role': 'assistant', 'content': raw},
            {'role': 'user', 'content': 'That reply was not JSON. Reply again with '
             'the JSON object only, exactly as the contract specifies. Put any '
             'objection or doubt in "warnings".'}], model))
    rows, warnings = [], list(parsed.get('warnings') or [])
    for item in parsed.get('results') or []:
        try:
            row = clean_row({**item, 'seconds': item.get('time'), 'source':
                             'deepseek-vision' if image_b64 else 'deepseek-text'})
            row['confidence'] = float(item.get('confidence', 0.8))
            row['note'] = item.get('note', '') or row['note']
            rows.append(row)
        except Exception as e:
            warnings.append(f'dropped a row: {e}')
    return {'rows': rows, 'warnings': warnings, 'model': model}


def safe_name(stem, ext):
    stem = re.sub(r'[\\/:*?"<>|]+', '-', str(stem)).strip() or 'ivy-swim'
    if stem.lower().endswith(ext.lower()):          # callers may already include it
        stem = stem[:-len(ext)]
    return (stem[:80] or 'ivy-swim') + ext


def build_pb_workbook(lang='en', gender='F'):
    """Personal bests straight from the database, so the sheet cannot drift."""
    rows = all_results()
    names = STROKE_ZH if lang == 'zh' else STROKE_EN
    zh = lang == 'zh'
    headers = (['项目', '泳姿', '距离(米)', '池长', '最好成绩', '成绩(秒)', '比赛日期',
                '当时年龄', '赛事名称', '轮次', '速度(米/秒)', '配速(每100米)', '积分', '场次']
               if zh else
               ['Event', 'Stroke', 'Distance (m)', 'Pool', 'Best time', 'Seconds', 'Date',
                'Age', 'Meet', 'Round', 'Speed (m/s)', 'Pace /100 m', 'WA points', 'Races'])
    counts = {}
    for r in rows:
        counts[(r['distance'], r['stroke'], r['course'])] = \
            counts.get((r['distance'], r['stroke'], r['course']), 0) + 1
    out = []
    for r in personal_bests(rows, gender):
        y, m = age_on(r['date'])
        pool = ('25米池' if r['course'] == 'SCM' else '50米池') if zh else \
               ('25 m' if r['course'] == 'SCM' else '50 m')
        event = (f"{r['distance']}米{names[r['stroke']]}" if zh
                 else f"{r['distance']} m {names[r['stroke']]}")
        out.append([
            event, names[r['stroke']], r['distance'], pool, clock(r['seconds']),
            round(r['seconds'], 2), r['date'], (f'{y}岁{m}个月' if zh else f'{y}y {m}m'),
            r.get('meet') or '', r.get('round') or '',
            round(r['distance'] / r['seconds'], 3),
            clock(round(r['seconds'] * 100 / r['distance'], 2)),
            wa_points(r, gender) or '',
            counts[(r['distance'], r['stroke'], r['course'])]])
    out.append([''] * len(headers))
    link = [''] * len(headers)
    link[0] = ('完整成绩与交互图表：' if zh else 'Full record and interactive charts:')
    link[1] = PUBLIC_URL
    out.append(link)
    stamped = [''] * len(headers)
    stamped[0] = (f'{ATHLETE_NAME}（{ATHLETE_PREFERRED}）· {ATHLETE_BIRTH} 出生' if zh
                  else f'{ATHLETE_NAME} ({ATHLETE_PREFERRED}) · born {ATHLETE_BIRTH}')
    stamped[1] = (f'导出于 {date.today().isoformat()}' if zh
                  else f'Generated {date.today().isoformat()}')
    out.append(stamped)
    title = ('个人最好成绩' if zh else 'Personal Bests')
    data = exporters.build_xlsx(headers, out, sheet_name=title, data_rows=len(out) - 3)
    stamp = date.today().isoformat()
    return data, f'{ATHLETE_PREFERRED}-{"个人最好成绩" if zh else "personal-bests"}-{stamp}.xlsx'


def _mm_course(*texts):
    """Meet Mobile encodes course in the event/meet name, e.g. '50 SC Meter'."""
    blob = ' '.join(str(t) for t in texts if t).lower()
    if 'yard' in blob or 'scy' in blob:
        return None                       # yards are not metric; we do not store them
    if 'lc' in blob or 'long course' in blob or '50 m pool' in blob:
        return 'LCM'
    if 'sc' in blob or 'short course' in blob or '25 m pool' in blob:
        return 'SCM'
    return None


_MM_STROKE = {'free': 'Free', 'freestyle': 'Free', 'back': 'Back', 'backstroke': 'Back',
              'breast': 'Breast', 'breaststroke': 'Breast', 'fly': 'Fly', 'butterfly': 'Fly',
              'im': 'IM', 'medley': 'IM', 'individual medley': 'IM'}


def _mm_seconds(entry):
    # timeInSecs arrives as a number OR a string ("35.52", "1:23.96")
    for k in ('timeInSecs', 'time_in_secs', 'TIME_IN_SECS', 'finalTimeInSecs',
              'time', 'finalTime', 'swimTime'):
        v = entry.get(k)
        if v in (None, '', 0, '0'):
            continue
        try:
            secs = parse_time(v)
            if secs > 0:
                return round(secs, 2)
        except Exception:
            continue
    return None


def _mm_iso(entry, *keys):
    for k in keys:
        v = entry.get(k)
        if not v:
            continue
        if isinstance(v, (int, float)):        # epoch — seconds (~10 digits) or millis (~13)
            try:
                ts = v / 1000 if v >= 1e11 else v
                return datetime.fromtimestamp(ts, timezone.utc).date().isoformat()
            except Exception:
                continue
        m = re.search(r'(\d{4})-(\d{2})-(\d{2})', str(v))
        if m:
            return m.group(0)
    return None


_MM_ROUND = {'F': 'Final', 'P': 'Heat', 'T': 'Timed Final', 'S': 'Semifinal',
             'final': 'Final', 'prelim': 'Heat', 'timed final': 'Timed Final'}


def _map_relational(res, target_name=''):
    """Join Meet Mobile's normalized result tables into flat rows."""
    rows, warnings = [], []
    events = {e['id']: e for e in res.get('events', []) if 'id' in e}
    rounds = {r['id']: r for r in res.get('rounds', []) if 'id' in r}
    heats = {h['id']: h for h in res.get('heats', []) if 'id' in h}
    entries = {he['id']: he for he in res.get('heatEntries', []) if 'id' in he}
    swim_meet = (res.get('swimmer') or {})
    meet_name = ''
    for m in (res.get('meets') or []):
        meet_name = m.get('name') or meet_name
    # swimmerHeatEntries ties our swimmer to specific heat entries and carries stroke
    she = res.get('swimmerHeatEntries') or []
    # fall back to every heat entry if the swimmer link is absent
    links = she if she else [{'heatEntryId': he_id, 'stroke': None} for he_id in entries]
    for link in links:
        he = entries.get(link.get('heatEntryId'))
        if not he:
            continue
        if he.get('isDisqualified'):
            warnings.append('skipped a DQ swim'); continue
        heat = heats.get(he.get('heatId'), {})
        rnd = rounds.get(heat.get('roundId'), {})
        ev = events.get(rnd.get('eventId'), {})
        if ev.get('isRelay'):
            warnings.append('relay swims were skipped'); continue
        name = ev.get('name', '')
        stroke_raw = link.get('stroke') or ('medley' if ev.get('isMedley') else None)
        stroke = _MM_STROKE.get(str(stroke_raw).strip().lower()) if stroke_raw else None
        if not stroke:
            for w, canon in _MM_STROKE.items():
                if w in name.lower():
                    stroke = canon; break
        import re as _re
        dm = _re.search(r'(\d{2,4})\s*(?:m|sc|lc|meter|metre|yard)', name.lower())
        distance = int(dm.group(1)) if dm else None
        course = _mm_course(name, meet_name)
        if course is None:
            course = 'SCM'                 # age-group meets are usually short course
            if 'course_guessed' not in [w[:13] for w in warnings]:
                warnings.append('course_guessed: pool length was not in the data — '
                                'defaulted to 25 m; check each row before saving')
        secs = _mm_seconds(he)
        date = _mm_iso(rnd, 'startDateUtc', 'startDate') or _mm_iso(res.get('meets', [{}])[0] if res.get('meets') else {}, 'startDateUtc', 'startDate')
        rtype = rnd.get('roundType') or rnd.get('name') or ''
        rnd_label = _MM_ROUND.get(str(rtype).strip(), _MM_ROUND.get(str(rtype).strip().lower(), str(rtype)))
        try:
            rows.append(clean_row({'date': date, 'course': course, 'distance': distance,
                                   'stroke': stroke, 'seconds': secs, 'meet': meet_name[:200],
                                   'round': rnd_label[:40], 'source': 'meet-mobile'}))
        except Exception as e:
            warnings.append(f'could not map "{name or stroke}": {e}')
    # de-dupe
    uniq, seen_keys = [], set()
    for r in rows:
        k = (r['date'], r['course'], r['distance'], r['stroke'], r['seconds'])
        if k not in seen_keys:
            seen_keys.add(k); uniq.append(r)
    return uniq, warnings


def map_meetmobile(payload, target_name=''):
    """Turn a Meet Mobile JSON export into candidate result rows.

    Tolerant of the several shapes the app produces: a swimmer-results document,
    a list of heat entries, or a meet document with nested swimmers. Only the
    athlete's own individual (non-relay) swims are kept.
    """
    rows, warnings = [], []
    seen_relay = False

    # ---- relational shape: getSwimmerById / meetSwimmers return parallel tables
    #      (events, rounds, heats, heatEntries, swimmerHeatEntries) joined by id ----
    res = payload.get('result', payload) if isinstance(payload, dict) else payload
    if isinstance(res, dict) and 'heatEntries' in res and ('rounds' in res or 'events' in res):
        rel = _map_relational(res, target_name)
        if rel[0]:
            return rel

    def walk(node, ctx):
        nonlocal seen_relay
        if isinstance(node, list):
            for x in node:
                walk(x, ctx)
            return
        if not isinstance(node, dict):
            return
        c = dict(ctx)
        for mk, ck in (('meetName', 'meet'), ('name', 'meet_maybe'),
                       ('facilityName', 'facility')):
            if node.get(mk):
                c[ck] = node[mk]
        d = _mm_iso(node, 'startDate', 'date', 'swimDate', 'endDate')
        if d:
            c['date'] = d                 # normalised ISO, never raw millis
        # a result-bearing entry has a time and an event shape
        secs = _mm_seconds(node)
        stroke_raw = node.get('stroke') or node.get('STROKE')
        dist = node.get('distance') or node.get('DISTANCE')
        if secs and (stroke_raw is not None or node.get('eventName')):
            if node.get('isRelay') or node.get('IS_RELAY'):
                seen_relay = True
            elif node.get('isDisqualified') or node.get('IS_DISQUALIFIED'):
                warnings.append('skipped a DQ swim')
            else:
                ev = node.get('eventName') or ''
                stroke = None
                if stroke_raw is not None:
                    key = str(stroke_raw).strip().lower()
                    stroke = _MM_STROKE.get(key)
                if not stroke:
                    for word, canon in _MM_STROKE.items():
                        if word in ev.lower():
                            stroke = canon; break
                distance = None
                if dist:
                    try:
                        distance = int(float(dist))
                    except Exception:
                        pass
                if not distance:
                    m = re.search(r'(\d{2,4})\s*(?:m|meter|metre|sc|lc|yard)', ev.lower())
                    if m:
                        distance = int(m.group(1))
                course = _mm_course(ev, c.get('meet'), c.get('meet_maybe'))
                date = _mm_iso(node, 'swimDate', 'date') or c.get('date')
                rnd = node.get('roundType') or node.get('ROUND_TYPE') or ''
                cand = {'date': date, 'course': course, 'distance': distance,
                        'stroke': stroke, 'seconds': secs,
                        'meet': (c.get('meet') or c.get('meet_maybe') or '')[:200],
                        'round': str(rnd)[:40], 'source': 'meet-mobile'}
                try:
                    rows.append(clean_row(cand))
                except Exception as e:
                    warnings.append(f'could not map an entry ({ev or stroke}): {e}')
        for v in node.values():
            if isinstance(v, (list, dict)):
                walk(v, c)

    walk(payload, {})
    if seen_relay:
        warnings.append('relay swims were skipped')
    # de-duplicate within the payload itself
    uniq, key_seen = [], set()
    for r in rows:
        k = (r['date'], r['course'], r['distance'], r['stroke'], r['seconds'])
        if k not in key_seen:
            key_seen.add(k); uniq.append(r)
    return uniq, warnings


def reconcile(candidates):
    """Compare candidate rows with the database: matched, new, and conflicts."""
    existing = all_results()
    by_event = {}
    for r in existing:
        by_event.setdefault((r['date'], r['course'], r['distance'], r['stroke']), []).append(r)
    matched, new, conflicts = [], [], []
    for c in candidates:
        ek = (c['date'], c['course'], c['distance'], c['stroke'])
        peers = by_event.get(ek, [])
        exact = [p for p in peers if abs(p['seconds'] - c['seconds']) < 0.005]
        if exact:
            matched.append(c)
        elif peers:
            conflicts.append({'incoming': c, 'existing': peers[0]['seconds']})
        else:
            new.append(c)
    return {'matched': matched, 'new': new, 'conflicts': conflicts,
            'total': len(candidates)}


# ---------------------------------------------------------------- handler ---
class Handler(BaseHTTPRequestHandler):
    server_version = 'IvySwim'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        sys.stderr.write(f'{self.log_date_time_string()} {self.address_string()} '
                         f'{fmt % args}\n')

    # -- helpers
    def send(self, code, body=b'', ctype='application/json', extra=None):
        if isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        # Fonts are content-addressed and never change; markup and code must
        # revalidate so a redeploy reaches the browser immediately.
        if ctype.startswith('font/'):
            cache = 'public, max-age=31536000, immutable'
        elif ctype == 'application/json':
            cache = 'no-store'
        else:
            cache = 'no-cache, must-revalidate'
        self.send_header('Cache-Control', cache)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def sendj(self, obj, code=200):
        self.send(code, json.dumps(obj, ensure_ascii=False), 'application/json')

    def handle_one_request(self):
        # A caller that gives up mid-request (a long generation, a closed tab)
        # otherwise surfaces as a broken pipe traceback in the log.
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def fail(self, exc):
        """Report an error to the client if it is still there, and log it either way."""
        sys.stderr.write(f'{self.log_date_time_string()} {self.path} failed: {exc!r}\n')
        try:
            self.sendj({'error': str(exc)}, 500)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def cookie(self, name):
        raw = self.headers.get('Cookie') or ''
        for part in raw.split(';'):
            k, _, v = part.strip().partition('=')
            if k == name:
                return v
        return ''

    @property
    def unlocked(self):
        return session_valid(self.cookie('ivy_session'))

    def client_ip(self):
        fwd = self.headers.get('X-Forwarded-For', '')
        return (fwd.split(',')[0].strip() if fwd else self.client_address[0])

    def require_unlock(self):
        if self.unlocked:
            return False
        self.sendj({'error': 'locked', 'locked': True}, 401)
        return True

    def read_body(self):
        """Consume the request body exactly once.

        Every response path must have drained it: replying to a POST while bytes
        are still queued leaves them to be parsed as the next request on the same
        keep-alive connection, which silently shifts responses onto the wrong
        requests.
        """
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_BODY:
            self._raw = b''
            # Still drain, or the connection cannot be reused.
            left = n
            while left > 0:
                chunk = self.rfile.read(min(left, 65536))
                if not chunk:
                    break
                left -= len(chunk)
            raise ValueError(f'payload too large ({n} bytes, max {MAX_BODY})')
        self._raw = self.rfile.read(n) if n else b''
        return self._raw

    def body(self):
        raw = getattr(self, '_raw', None)
        if raw is None:
            raw = self.read_body()
        return json.loads(raw or b'{}')

    # -- routes
    def do_GET(self):
        p = self.path.split('?')[0]
        try:
            if p == '/api/results':
                return self.sendj({'results': all_results()})
            if p == '/api/auth/status':
                return self.sendj({'unlocked': self.unlocked,
                                   'configured': bool(PASSCODE)})
            if p == '/api/auth/challenge':
                return self.sendj({'nonce': new_nonce()})

            if p == '/api/health':
                return self.sendj({'ok': True, 'deepseek': bool(DEEPSEEK_KEY),
                                   'count': len(all_results()),
                                   'version': APP_VERSION})
            if p.startswith('/dl/'):
                token = p[4:]
                with _dl_lock:
                    item = _downloads.get(token)
                if not item:
                    return self.send(404, b'that download has expired', 'text/plain')
                return self.send(200, item['data'], item['ctype'], {
                    'Content-Disposition':
                        "attachment; filename=\"%s\"; filename*=UTF-8''%s"
                        % (re.sub(r'[^A-Za-z0-9._-]', '_', item['name']),
                           urllib.parse.quote(item['name']))})

            if p == '/api/export/pb.xlsx':
                q = urllib.parse.parse_qs(self.path.partition('?')[2])
                lang = (q.get('lang', ['en'])[0] == 'zh') and 'zh' or 'en'
                gender = q.get('gender', ['F'])[0].upper()[:1] or 'F'
                data, name = build_pb_workbook(lang, gender)
                return self.send(200, data,
                                 'application/vnd.openxmlformats-officedocument.'
                                 'spreadsheetml.sheet',
                                 {'Content-Disposition':
                                  "attachment; filename=\"%s\"; filename*=UTF-8''%s"
                                  % (re.sub(r'[^A-Za-z0-9._-]', '_', name),
                                     urllib.parse.quote(name))})

            if p == '/api/export.csv':
                buf = io.StringIO()
                w = csv.writer(buf)
                w.writerow(['date', 'course', 'distance', 'stroke', 'seconds',
                            'time', 'meet', 'round', 'note', 'source'])
                for r in all_results():
                    s = r['seconds']
                    disp = f'{int(s // 60)}:{s % 60:05.2f}' if s >= 60 else f'{s:.2f}'
                    w.writerow([r['date'], r['course'], r['distance'], r['stroke'],
                                s, disp, r['meet'], r['round'], r['note'], r['source']])
                return self.send(200, buf.getvalue().encode('utf-8-sig'), 'text/csv',
                                 {'Content-Disposition':
                                  'attachment; filename="ivy-swim-results.csv"'})
            # The intake page is never served to a locked client, so there is no
            # hidden element on the page for a viewer to reveal.
            if p in ('/add.html', '/add', '/devdocs.html') and not self.unlocked:
                self.send_response(302)
                self.send_header('Location', '/unlock.html?next=' +
                                 urllib.parse.quote(p))
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            return self.static(p)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as e:
            self.fail(e)

    do_HEAD = do_GET

    def do_POST(self):
        p = self.path.split('?')[0]
        try:
            self.read_body()
        except Exception as e:
            return self.sendj({'error': str(e)}, 413)
        try:
            if p == '/api/auth':
                b = self.body()
                token, err = verify_proof(b.get('nonce'), b.get('proof'), self.client_ip())
                if err:
                    return self.sendj({'error': err}, 401)
                body = json.dumps({'ok': True}).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Set-Cookie',
                                 f'ivy_session={token}; Path=/; Max-Age={SESSION_TTL}; '
                                 'HttpOnly; SameSite=Lax')
                self.end_headers()
                return self.wfile.write(body)

            if p == '/api/auth/logout':
                with _auth_lock:
                    _sessions.pop(self.cookie('ivy_session'), None)
                body = json.dumps({'ok': True}).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Set-Cookie',
                                 'ivy_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')
                self.end_headers()
                return self.wfile.write(body)

            if p == '/api/parse':
                if self.require_unlock():
                    return
                b = self.body()
                img = b.get('image') or ''
                if img.startswith('data:'):
                    head, _, img = img.partition(',')
                    mime = head[5:].split(';')[0] or 'image/png'
                else:
                    mime = b.get('image_mime', 'image/png')
                if not (b.get('text') or '').strip() and not img:
                    return self.sendj({'error': 'send text, an image, or both'}, 400)
                return self.sendj(run_parse(b.get('text', ''), img, mime))
            if p == '/api/export/pdf':
                b = self.body()
                pages = b.get('images') or []
                if not pages:
                    return self.sendj({'error': 'no pages to export'}, 400)
                if len(pages) > 60:
                    return self.sendj({'error': 'too many pages (max 60)'}, 400)
                pngs = [exporters.data_url_to_png(u) for u in pages]
                size = (float(b.get('pageWidth') or 1240), float(b.get('pageHeight') or 1754))
                pdf = exporters.build_pdf(pngs, title=b.get('title') or 'Ivy Swim Analytics',
                                          author=ATHLETE_NAME,
                                          links=b.get('links'), doc_size=size)
                name = safe_name(b.get('name') or 'ivy-swim', '.pdf')
                tok = stash_download(pdf, name, 'application/pdf')
                return self.sendj({'url': f'/dl/{tok}', 'name': name, 'bytes': len(pdf)})

            if p == '/api/export/png':
                b = self.body()
                if not b.get('image'):
                    return self.sendj({'error': 'no image'}, 400)
                png = exporters.data_url_to_png(b['image'])
                name = safe_name(b.get('name') or 'ivy-chart', '.png')
                tok = stash_download(png, name, 'image/png')
                return self.sendj({'url': f'/dl/{tok}', 'name': name, 'bytes': len(png)})

            if p == '/api/import/meetmobile':
                if self.require_unlock():
                    return
                b = self.body()
                raw = b.get('data')
                if isinstance(raw, str):
                    try:
                        raw = json.loads(raw)
                    except json.JSONDecodeError as e:
                        return self.sendj({'error': f'that is not valid JSON: {e}'}, 400)
                if raw is None:
                    return self.sendj({'error': 'send the Meet Mobile JSON in "data"'}, 400)
                rows, warnings = map_meetmobile(raw)
                if not rows:
                    return self.sendj({'rows': [], 'warnings': warnings or
                                       ['no individual swims were found in that export']})
                rep = reconcile(rows)
                return self.sendj({'rows': rows, 'reconcile': rep, 'warnings': warnings})

            if p == '/api/advice':
                if self.require_unlock():
                    return
                b = self.body()
                lang = 'zh' if b.get('lang') == 'zh' else 'en'
                gender = (b.get('gender') or 'F').upper()[:1]
                rows = all_results()
                if not rows:
                    return self.sendj({'error': 'no results on record yet'}, 400)
                focus = str(b.get('focus') or '').strip()[:400]
                dossier = advice_dossier(rows, gender, lang)
                ask = ('请基于以下数据撰写简报。' if lang == 'zh'
                       else 'Write the briefing from the data below.')
                if focus:
                    ask += (f'\n\n家长特别想了解：{focus}' if lang == 'zh'
                            else f'\n\nThe parents specifically want to know: {focus}')
                messages = [{'role': 'system',
                             'content': ADVICE_SYSTEM_ZH if lang == 'zh' else ADVICE_SYSTEM_EN},
                            {'role': 'user', 'content': f'{ask}\n\n{dossier}'}]
                used = ADVICE_MODEL
                try:
                    text = deepseek_stream(messages, ADVICE_MODEL, max_tokens=16000)
                except Exception as first:
                    sys.stderr.write(f'advice: {ADVICE_MODEL} failed ({first}); '
                                     f'falling back to {TEXT_MODEL}\n')
                    used = TEXT_MODEL
                    text = deepseek_stream(messages, TEXT_MODEL, max_tokens=16000)
                return self.sendj({'text': text, 'lang': lang,
                                   'generated': datetime.now(timezone.utc).isoformat(),
                                   'races': len(rows), 'model': used})

            if p == '/api/results':
                if self.require_unlock():
                    return
                b = self.body()
                incoming = b.get('results') if isinstance(b.get('results'), list) else [b]
                rows, errors = [], []
                for r in incoming:
                    try:
                        rows.append(clean_row(r))
                    except Exception as e:
                        errors.append(str(e))
                now = datetime.now(timezone.utc).isoformat()
                added = 0
                with _lock:
                    con = connect()
                    for r in rows:
                        cur = con.execute(
                            'INSERT OR IGNORE INTO results(date,course,distance,stroke,'
                            'seconds,meet,round,note,source,created_at)'
                            ' VALUES(?,?,?,?,?,?,?,?,?,?)',
                            (r['date'], r['course'], r['distance'], r['stroke'],
                             r['seconds'], r['meet'], r['round'], r['note'],
                             r['source'], now))
                        added += cur.rowcount
                    con.commit(); con.close()
                return self.sendj({'added': added, 'duplicates': len(rows) - added,
                                   'errors': errors, 'results': all_results()})
            return self.sendj({'error': 'not found'}, 404)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as e:
            self.fail(e)

    def do_DELETE(self):
        m = re.fullmatch(r'/api/results/(\d+)', self.path.split('?')[0])
        if not m:
            return self.sendj({'error': 'not found'}, 404)
        if self.require_unlock():
            return
        with _lock:
            con = connect()
            cur = con.execute('DELETE FROM results WHERE id=?', (int(m.group(1)),))
            con.commit(); con.close()
        return self.sendj({'deleted': cur.rowcount, 'results': all_results()})

    def static(self, path):
        rel = 'index.html' if path in ('/', '') else path.lstrip('/')
        full = os.path.normpath(os.path.join(STATIC, rel))
        if not full.startswith(STATIC) or not os.path.isfile(full):
            return self.send(404, b'not found', 'text/plain')
        ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/javascript',):
            ctype += '; charset=utf-8'
        st = os.stat(full)
        etag = '"%x-%x"' % (int(st.st_mtime), st.st_size)
        if self.headers.get('If-None-Match') == etag:
            self.send_response(304)
            self.send_header('ETag', etag)
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        with open(full, 'rb') as f:
            data = f.read()
        return self.send(200, data, ctype, {'ETag': etag})


APP_VERSION = '20260910114002'

if __name__ == '__main__':
    init_db()
    print(f'[ivy-swim {APP_VERSION}] http://{HOST}:{PORT}  db={DB_PATH}  '
          f'deepseek={"on" if DEEPSEEK_KEY else "OFF"}  '
          f'passcode={"set" if PASSCODE else "NOT SET (intake is open)"}', flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
