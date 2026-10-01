"""File builders for Ivy Swim Analytics — PDF and XLSX, standard library only.

The browser rasterises each export page to a PNG on a canvas; this module unpacks
those PNGs losslessly and re-wraps them as PDF image pages, so a PDF looks exactly
like the site that produced it. XLSX is written directly as OOXML.
"""
import base64, re, struct, zlib
from datetime import datetime, timezone

A4_W, A4_H = 595.276, 841.890          # points


# ------------------------------------------------------------------ PNG ----
def decode_png(data):
    """Return (width, height, rgb_bytes) for an 8-bit non-interlaced PNG.

    canvas.toDataURL emits RGBA (colour type 6); PDF images are RGB, so the
    alpha channel is composited onto white and dropped.
    """
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('not a PNG')
    pos, idat, w = 8, bytearray(), None
    while pos < len(data):
        (length,) = struct.unpack('>I', data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b'IHDR':
            w, h, depth, colour, comp, filt, interlace = struct.unpack('>IIBBBBB', body)
            if depth != 8 or interlace or colour not in (2, 6):
                raise ValueError(f'unsupported PNG (depth {depth}, colour {colour})')
            channels = 3 if colour == 2 else 4
        elif kind == b'IDAT':
            idat += body
        elif kind == b'IEND':
            break
        pos += 12 + length
    if w is None:
        raise ValueError('PNG has no header')

    raw = zlib.decompress(bytes(idat))
    stride = w * channels
    out = bytearray(w * h * 3)
    prev = bytearray(stride)
    at = 0
    for y in range(h):
        ftype = raw[at]; at += 1
        line = bytearray(raw[at:at + stride]); at += stride
        if ftype == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 0xFF
        elif ftype != 0:
            raise ValueError(f'bad PNG filter {ftype}')
        prev = line
        o = y * w * 3
        if channels == 3:
            out[o:o + stride] = line
        else:
            for x in range(w):                       # composite onto white
                s, d = x * 4, o + x * 3
                al = line[s + 3]
                if al == 255:
                    out[d:d + 3] = line[s:s + 3]
                else:
                    inv = 255 - al
                    out[d] = (line[s] * al + 255 * inv) // 255
                    out[d + 1] = (line[s + 1] * al + 255 * inv) // 255
                    out[d + 2] = (line[s + 2] * al + 255 * inv) // 255
    return w, h, bytes(out)


def data_url_to_png(url):
    return base64.b64decode(re.sub(r'^data:image/\w+;base64,', '', url.strip()))


# ------------------------------------------------------------------ PDF ----
def _esc(s):
    return s.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')


def _pdf_text(s):
    """A PDF text string. ASCII stays literal; anything else becomes UTF-16BE hex,
    which is how PDF carries non-Latin text (Chinese titles, names, URLs)."""
    s = str(s)
    try:
        s.encode('ascii')
        return '(' + _esc(s) + ')'
    except UnicodeEncodeError:
        return '<' + ('\ufeff' + s).encode('utf-16-be').hex().upper() + '>' 


def jpeg_size(data):
    """(width, height, components) from a JPEG's frame header."""
    if data[:2] != b'\xff\xd8':
        raise ValueError('not a JPEG')
    i = 2
    while i < len(data) - 1:
        if data[i] != 0xFF:
            i += 1; continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2; continue
        (seglen,) = struct.unpack('>H', data[i + 2:i + 4])
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                      0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return w, h, data[i + 9]
        i += 2 + seglen
    raise ValueError('no JPEG frame header')


def _image_object(data):
    """Describe one image for embedding: JPEG passes through untouched.

    Decoding a full-page PNG in pure Python is far too slow, so the browser sends
    JPEG for multi-page documents; PNG stays supported for small single images.
    """
    if data[:2] == b'\xff\xd8':
        w, h, comps = jpeg_size(data)
        space = '/DeviceGray' if comps == 1 else ('/DeviceCMYK' if comps == 4 else '/DeviceRGB')
        return w, h, space, '/DCTDecode', data
    w, h, rgb = decode_png(data)
    return w, h, '/DeviceRGB', '/FlateDecode', zlib.compress(rgb, 6)


def build_pdf(images, title='Ivy Swim Analytics', author='', fit=(A4_W, A4_H),
              links=None, doc_size=None):
    """One PDF page per image, each scaled to fit the page box and centred.

    `links` is one list of {x, y, w, h, url} per page, in the browser's top-left
    document units (`doc_size`), turned into real clickable PDF annotations.
    """
    if not images:
        raise ValueError('nothing to export')
    objects = ['']                       # 1-indexed
    def add(body):
        objects.append(body)
        return len(objects) - 1

    page_ids, kids = [], []
    for raw in images:
        w, h, space, filt, stream = _image_object(raw)
        img_id = add(
            f'<< /Type /XObject /Subtype /Image /Width {w} /Height {h} '
            f'/ColorSpace {space} /BitsPerComponent 8 /Filter {filt} '
            f'/Length {len(stream)} >>\nstream\n'.encode('latin-1') + stream + b'\nendstream')
        box_w, box_h = fit
        scale = min(box_w / w, box_h / h)
        dw, dh = w * scale, h * scale
        ox, oy = (box_w - dw) / 2, (box_h - dh) / 2
        content = f'q {dw:.2f} 0 0 {dh:.2f} {ox:.2f} {oy:.2f} cm /Im0 Do Q'.encode('latin-1')
        cs = zlib.compress(content, 9)
        content_id = add(f'<< /Filter /FlateDecode /Length {len(cs)} >>\nstream\n'
                         .encode('latin-1') + cs + b'\nendstream')

        annots = []
        page_links = (links or [])[len(page_ids)] if links and len(page_ids) < len(links) else []
        for ln in page_links or []:
            try:
                dsw, dsh = doc_size or (dw, dh)
                k = dw / dsw                       # document units -> PDF points
                x0 = ox + float(ln['x']) * k
                x1 = ox + (float(ln['x']) + float(ln['w'])) * k
                y1 = oy + dh - float(ln['y']) * k
                y0 = oy + dh - (float(ln['y']) + float(ln['h'])) * k
                uri = str(ln['url'])[:400]
                annots.append(add(
                    f'<< /Type /Annot /Subtype /Link /Border [0 0 0] '
                    f'/Rect [{x0:.2f} {y0:.2f} {x1:.2f} {y1:.2f}] '
                    f'/A << /Type /Action /S /URI /URI {_pdf_text(uri)} >> >>'))
            except (KeyError, TypeError, ValueError):
                continue
        page_ids.append((img_id, content_id, box_w, box_h, annots))

    pages_id = len(objects) + len(page_ids)          # reserve after page objects
    for img_id, content_id, box_w, box_h, annots in page_ids:
        annot_str = (' /Annots [' + ' '.join(f'{a} 0 R' for a in annots) + ']') if annots else ''
        kids.append(add(
            f'<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {box_w:.2f} {box_h:.2f}] '
            f'/Resources << /XObject << /Im0 {img_id} 0 R >> /ProcSet [/PDF /ImageC] >> '
            f'/Contents {content_id} 0 R{annot_str} >>'))
    real_pages = add('<< /Type /Pages /Kids [' + ' '.join(f'{k} 0 R' for k in kids) +
                     f'] /Count {len(kids)} >>')
    for i, k in enumerate(kids):
        objects[k] = objects[k].replace(f'/Parent {pages_id} 0 R',
                                        f'/Parent {real_pages} 0 R')
    stamp = datetime.now(timezone.utc).strftime('D:%Y%m%d%H%M%SZ')
    info_id = add(f'<< /Title {_pdf_text(title)} /Author {_pdf_text(author)} '
                  f'/Producer (Ivy Swim Analytics) /CreationDate ({stamp}) >>')
    catalog_id = add(f'<< /Type /Catalog /Pages {real_pages} 0 R >>')

    out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    offsets = [0] * len(objects)
    for i in range(1, len(objects)):
        offsets[i] = len(out)
        body = objects[i]
        out += f'{i} 0 obj\n'.encode('latin-1')
        out += body if isinstance(body, bytes) else body.encode('latin-1')
        out += b'\nendobj\n'
    xref_at = len(out)
    out += f'xref\n0 {len(objects)}\n'.encode('latin-1')
    out += b'0000000000 65535 f \n'
    for i in range(1, len(objects)):
        out += f'{offsets[i]:010d} 00000 n \n'.encode('latin-1')
    out += (f'trailer\n<< /Size {len(objects)} /Root {catalog_id} 0 R '
            f'/Info {info_id} 0 R >>\nstartxref\n{xref_at}\n%%EOF\n').encode('latin-1')
    return bytes(out)


# ----------------------------------------------------------------- XLSX ----
def _xml(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def build_xlsx(headers, rows, sheet_name='Personal Bests', title='', data_rows=None):
    """A minimal but fully valid .xlsx: one sheet, a bold header row, autofilter."""
    def col(i):
        s = ''
        while True:
            s = chr(65 + i % 26) + s
            i = i // 26 - 1
            if i < 0:
                return s

    body = []
    body.append('<row r="1" s="1">' + ''.join(
        f'<c r="{col(i)}1" s="1" t="inlineStr"><is><t>{_xml(h)}</t></is></c>'
        for i, h in enumerate(headers)) + '</row>')
    for n, row in enumerate(rows, start=2):
        cells = []
        for i, v in enumerate(row):
            ref = f'{col(i)}{n}'
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                cells.append(f'<c r="{ref}"><v>{v}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{_xml(v)}</t></is></c>')
        body.append(f'<row r="{n}">' + ''.join(cells) + '</row>')

    # the autofilter covers only the data block, so trailing note rows stay out of it
    last = f'{col(len(headers) - 1)}{(data_rows if data_rows is not None else len(rows)) + 1}'
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '</sheetView></sheetViews>'
        '<cols>' + ''.join(
            f'<col min="{i+1}" max="{i+1}" width="{max(12, min(34, len(str(h)) + 8))}" customWidth="1"/>'
            for i, h in enumerate(headers)) + '</cols>'
        f'<sheetData>{"".join(body)}</sheetData>'
        f'<autoFilter ref="A1:{last}"/></worksheet>')

    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>'
        '</fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF0F1E36"/>'
        '<bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
        '</cellXfs></styleSheet>')

    parts = {
        '[Content_Types].xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '</Types>',
        '_rels/.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>',
        'xl/workbook.xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets><sheet name="{_xml(sheet_name)[:31]}" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>',
        'xl/styles.xml': styles,
        'xl/worksheets/sheet1.xml': sheet,
    }
    import io, zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, content in parts.items():
            z.writestr(name, content)
    return buf.getvalue()
