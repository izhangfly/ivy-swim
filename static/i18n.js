/* Bilingual layer. English strings are the keys; Chinese lives in ZH.
   Anything missing from ZH falls back to English rather than breaking. */
'use strict';

const ZH = {
  /* chrome */
  'Dashboard': '总览', 'Events': '项目', 'Meets': '比赛', 'Analysis': '分析',
  'Data': '数据', 'Add Result': '录入成绩',
  '{0} · born {1} · performance record': '{0} · {1}出生 · 比赛成绩档案',
  '中文': 'English',

  /* strokes & pools */
  'Freestyle': '自由泳', 'Backstroke': '仰泳', 'Breaststroke': '蛙泳',
  'Butterfly': '蝶泳', 'Individual Medley': '混合泳',
  '25 m pool (short course)': '25米池（短池）', '50 m pool (long course)': '50米池（长池）',
  '25 m': '25米', '50 m': '50米', '100 m': '100米',
  '25 m pool': '25米池', '50 m pool': '50米池',
  '{0} m {1}': '{0}米{1}', '{0} metres': '{0}米',

  /* shared table + metric labels */
  'Date': '日期', 'Age': '年龄', 'Time': '成绩', 'Event': '项目', 'Pool': '池长',
  'Speed': '速度', 'Pace /100': '配速/100米', 'Meet': '赛事', 'Round': '轮次',
  'Source': '来源', 'Races': '场次', 'Change': '变化', 'Previous best': '此前最好',
  'WA pts': '积分', 'Pts': '积分', 'personal best': '个人最好成绩',
  'Personal best': '个人最好成绩', 'per 100 m': '每100米', 'pts': '分',
  'World Aquatics points': '世界水上运动积分', 'first time': '首次',
  'not recorded': '未记录', 'none on the day': '当日无',
  'fitted trend': '拟合趋势', 'WA points': '积分',
  'prev {0}': '(此前 {0})', 'first': '首次', 'best': '最好', 'total': '累计', 'single race': '仅一场',
  'yr': '年', 'Pace': '配速',

  /* dashboard */
  'Career progression': '成绩发展', 'Current personal bests': '当前个人最好成绩',
  'Most recent competition': '最近一次比赛',
  'Races recorded': '已记录场次', '{0} event/course combinations': '{0}个项目/池长组合',
  'Competitions': '参赛次数', 'Personal bests set': '刷新个人最好',
  '{0}% of all swims': '占全部场次的{0}%', 'Strongest swim': '最佳表现',
  'Best performance': '最佳表现', 'Fastest swim': '最快游速', 'Best pace': '最佳配速',
  'Latest best': '最新最好成绩', 'mean velocity over {0} m': '{0}米平均速度',
  'vs world record': '对比世界纪录', 'no base time': '无基准成绩',
  'View full meet →': '查看完整比赛 →', '+{0} more': '另有{0}项',
  'No results yet': '尚无成绩记录', 'Add the first race on the {0} page.': '请前往{0}页面录入第一场比赛。',
  'World Aquatics points place every event on one comparable scale: {0}. Higher is better. Because the scale is shared, a rise here means real improvement relative to the event\'s own world standard, not just a faster clock.':
    '世界水上运动积分把所有项目放在同一可比尺度上：{0}。分数越高越好。由于尺度统一，积分上升代表相对该项目世界标准的真实进步，而不仅仅是秒表变快。',
  'Each tile shows the personal best for that stroke, distance and pool length. The bar is World Aquatics points relative to {0}\'s own strongest event. Age today: {1}.':
    '每格显示该泳姿、距离与池长的个人最好成绩。色条为积分，以{0}自身最强项目为基准。当前年龄：{1}。',

  /* events */
  'Group': '分组', 'Order': '排序', 'Stroke': '泳姿', 'Distance': '距离',
  'Best time': '最好成绩', 'Improvement': '进步幅度', 'Most recent': '最近',
  'All': '全部', '← All events': '← 全部项目',
  'No events recorded': '尚无项目记录', 'Add the first result': '录入第一条成绩',
  'Progression model': '进步模型', 'Every swim': '全部场次',
  'First recorded': '首次记录', 'Total improvement': '累计进步',
  'Age at best': '创造时年龄', 'Span': '跨度', 'Trend': '趋势',
  '95% interval': '95%置信区间', 'Statistically clear': '统计显著',
  'yes': '是', 'not yet': '尚不显著', 'needs 3+ races': '需3场以上',
  '{0} days': '{0}天', '{0} per year': '每年{0}', '{0} event': '{0}个项目',
  '{0} events': '{0}个项目', 'total improvement': '累计进步',
  'Least-squares fit of log-time against date. The rate is the proportional change in race time per year, so it stays comparable across events of any length.':
    '以成绩对数对日期做最小二乘拟合。速率为每年成绩的比例变化，因此不同距离的项目之间仍可比较。',
  'The interval excludes zero, so the trend is distinguishable from noise.':
    '置信区间不含零，趋势可与随机波动区分。',
  'The interval still spans zero — more races are needed before the trend is firm.':
    '置信区间仍跨越零，需要更多场次才能确认趋势。',

  /* meets */
  'Races swum': '参赛场次', 'Personal bests': '个人最好成绩', 'Time gained': '累计缩短',
  'against previous bests': '对比此前最好成绩', 'Results': '成绩明细',
  'Meet performance profile': '本次比赛表现', 'All meets': '全部比赛',
  'Competition': '比赛', 'Best of the meet': '本次最佳', 'Mean points': '平均积分',
  'across {0} scored race': '共{0}项计分', 'across {0} scored races': '共{0}项计分',
  'Distance swum': '比赛总距离', 'racing volume': '比赛量', 'Strokes': '泳姿数',
  'No competitions yet': '尚无比赛记录',
  'Add a result to create the first meet.': '录入成绩即可生成第一场比赛。',
  'No scored races at this meet.': '本次比赛没有可计分的项目。',
  '{0} competitions · {1} races · {2} to {3}': '{0}场比赛 · {1}项成绩 · {2} 至 {3}',
  '{0} meet': '{0}场比赛', '{0} meets': '{0}场比赛', '{0} races': '{0}项成绩',
  '★ {0} personal best': '★ {0}项个人最好', '★ {0} personal bests': '★ {0}项个人最好',
  'Bars show World Aquatics points for each race at this meet, with the athlete\'s previous best in the same event marked for comparison.':
    '色条为本次比赛各项目的积分，竖线标出该项目此前的最好成绩以作对照。',

  /* analysis */
  'Reference standard:': '参照标准：', 'Women\'s records': '女子纪录', 'Men\'s records': '男子纪录',
  'World Aquatics points are scored against {0}.': '积分基准为{0}。',
  'world records as of September 2026': '2026年9月的世界纪录',
  'Performance against age': '年龄–表现曲线', 'Age now': '当前年龄',
  'born {0}': '{0}出生', 'Age at first race': '首场比赛年龄',
  'Events modelled': '可建模项目', 'of {0} recorded': '共{0}个项目',
  'Median trend': '趋势中位数', 'change in race time per year': '每年成绩变化',
  'Progression model, by event': '各项目进步模型',
  'n': '场次', 'First': '首次', 'Best': '最好', 'Gain': '进步', 'Rate / year': '年化速率',
  'Signal': '显著性', 'clear': '显著', 'tentative': '待确认',
  'Stroke balance': '泳姿均衡', 'Speed endurance': '速度耐力',
  'Racing the same event twice in a day': '同日多次出战同一项目',
  'Swims': '成绩', 'Spread': '差值', 'Best of the day': '当日最好',
  'Method and data provenance': '方法与数据来源',
  'Points.': '积分。', 'Trend fitting.': '趋势拟合。', 'Pool length.': '池长。',
  'Age.': '年龄。', 'Source.': '数据来源。',
  'World Aquatics points use {0}, where {1} is the base time for the event and pool length and {2} is the swum time. This build uses {3} as base times, selectable between the women\'s and men\'s tables above. Events with no base time in the table are shown as "—" rather than being estimated.':
    '世界水上运动积分公式为 {0}，其中 {1} 为该项目与池长的基准成绩，{2} 为实际成绩。本系统以{3}作为基准成绩，可在上方切换男女标准。基准表中没有的项目显示为"—"，不作估算。',
  'Race times are logged before fitting, so the slope reads as a proportional rate and stays comparable between a 50 and a 200. Confidence intervals use the two-sided {0} distribution on {1} degrees of freedom. Events with fewer than three races are not fitted.':
    '拟合前先对成绩取对数，因此斜率表示比例变化率，50米与200米之间仍可比较。置信区间采用自由度为{1}的双侧{0}分布。少于三场的项目不作拟合。',
  'Short course (25 m) and long course (50 m) results are never pooled. Each is a separate event with its own base time, which is the correct way to compare across the two.':
    '短池（25米）与长池（50米）成绩从不混合统计。两者各自为独立项目并使用各自的基准成绩，这是跨池长比较的正确方式。',
  'Calculated from {0} to the date of each race.': '按{0}至每场比赛日期计算。',
  '{0} races imported from the training record; one long-course 50 m backstroke on 5 September 2026 came from the summary sheet rather than the event sheet. Results added later through the intake page carry the source they were captured from.':
    '{0}项成绩自训练记录导入；其中2026年9月5日的长池50米仰泳取自汇总表而非项目分表。之后通过录入页添加的成绩会标注各自的来源。',
  'Every scored race plotted against the athlete\'s age on the day. Because World Aquatics points normalise for event and pool length, the vertical axis is comparable across all strokes and distances.':
    '每一项计分成绩按比赛当日年龄绘制。积分已对项目与池长做归一化，纵轴在所有泳姿与距离之间可比。',
  'Rate is the slope of a least-squares fit of log race-time on date, expressed as percentage change per year; negative means getting faster. The interval is the two-sided 95% confidence interval on that slope. "Clear" marks events where the interval excludes zero.':
    '速率为成绩对数对日期最小二乘拟合的斜率，以每年百分比变化表示；负值代表变快。区间为该斜率的双侧95%置信区间。"显著"表示区间不含零。',
  'Best World Aquatics score reached in each stroke. Comparable across strokes by construction.':
    '各泳姿达到的最高积分。该指标在泳姿之间本身即可比较。',
  'Lower is better; world-class sprinters sit near 1.05–1.10 over this step.':
    '数值越低越好；世界级短距离选手在此区间约为1.05–1.10。',
  'Needs a 50 and a 100 in the same stroke and pool.': '需要同一泳姿、同一池长的50米与100米成绩。',
  '{0} months separate these two bests, so the exponent mixes two different levels of fitness.':
    '两项最好成绩相隔约{0}个月，该指数混合了两个不同阶段的状态。',
  'A small spread with the quicker swim last indicates the athlete can back up a heat and still improve in the final.':
    '差值小且后一场更快，说明预赛之后仍能在决赛继续提高。',

  /* data */
  'Search the record': '检索成绩库', 'Clear': '清除', 'Export CSV': '导出CSV',
  'Search syntax': '检索语法', 'Nothing matches that search.': '没有匹配的记录。',
  '{0} of {1} races': '{0} / {1} 项成绩', 'matching {0}': '匹配 {0}',
  'Search anything — \'fly\', \'50 back\', \'lcm 2026\', \'stroke:free time<35\', \'pb\'':
    '搜索任意内容 —— "蝶泳"、"50 back"、"lcm 2026"、"stroke:free time<35"、"pb"',
  'Bare words match every field at once — event name, pool, date, meet, round, notes, even the formatted time. Add qualifiers to narrow it, and combine as many as you like; all of them must match.':
    '直接输入的词会同时匹配所有字段——项目名、池长、日期、赛事、轮次、备注，甚至格式化后的成绩。可以加上限定词缩小范围，并任意组合；所有条件需同时满足。',
  'stroke name or short form (free, back, breast, fly, im)': '泳姿名称或缩写（free, back, breast, fly, im）',
  'pool length — {0} or {1}': '池长 —— {0} 或 {1}',
  'race distance; also {0}': '比赛距离；也可用 {0}',
  'calendar year': '年份',
  'on or after a date ({0} for the other side)': '不早于该日期（{0} 表示不晚于）',
  'time comparison, accepts {0}': '成绩比较，支持 {0} 格式',
  'age in years on the day of the race': '比赛当日年龄（岁）',
  'meet name; quote anything with spaces': '赛事名称；含空格请加引号',
  'only swims that set a personal best': '仅显示刷新个人最好成绩的场次',
  'Filter…': '筛选…',

  /* add */
  'Capture from a screenshot or a note': '从截图或文字录入',
  'Screenshot': '截图', 'from a meet app, results PDF or scoreboard': '来自比赛App、成绩单PDF或计分屏',
  'Drop an image here': '将图片拖到此处',
  'or click to choose · you can also paste with ⌘V / Ctrl+V': '或点击选择 · 也可用 ⌘V / Ctrl+V 粘贴',
  'Description': '文字描述', 'plain language, English or 中文': '自然语言，中英文皆可',
  'What was swum': '比赛内容',
  'Ivy swam the 50 free long course in 33.74 at the provincial championships on 30 May 2026, and went 1:19.43 in the 100 back the same day.':
    '例：2026年5月30日省锦标赛，Ivy 长池50自游了33.74，同一天100仰游了1:19.43。',
  'Read the result': '识别成绩', 'Reset': '重置',
  'Add a result by hand': '手动录入', 'Distance (m)': '距离（米）',
  'Time': '成绩', 'optional': '选填', 'Add result': '添加成绩',
  '25 m — short course': '25米 — 短池', '50 m — long course': '50米 — 长池',
  'Recorded results': '已录入成绩', 'Check before saving': '保存前请核对',
  'Dist': '距离', 'Confidence': '置信度', 'remove': '移除',
  'Are these correct? Edit any field below, remove anything that should not be saved, then confirm.':
    '这些是否正确？可直接修改下方任意字段，移除不需要保存的行，然后确认。',
  'Confirm and save': '确认并保存',
  'Save to the record': '保存到成绩库', 'Discard': '放弃',
  'delete': '删除', '{0} of {1} results': '{0} / {1} 条记录',
  'Add a screenshot or describe the swim first.': '请先添加截图或输入文字描述。',
  'Reading the screenshot…': '正在识别截图…', 'Reading the description…': '正在识别文字…',
  'No results could be read from that.': '未能从中识别出成绩。',
  'Found {0} result. Check the details, then save.': '识别到{0}条成绩，请核对后保存。',
  'Found {0} results. Check the details, then save.': '识别到{0}条成绩，请核对后保存。',
  'Could not read that: {0}': '识别失败：{0}',
  'Saved {0} result.': '已保存{0}条成绩。', 'Saved {0} results.': '已保存{0}条成绩。',
  '{0} were already on record.': '其中{0}条此前已存在。',
  'All rows discarded.': '已放弃全部识别结果。',
  'Could not save: {0}': '保存失败：{0}',
  'Added {0} in {1}.': '已添加{0}：{1}。',
  'That result is already on record.': '该成绩已存在。',
  'Delete {0} — {1} on {2}?': '确定删除 {0} —— {2} 的 {1}？',


  /* exports */
  'Export': '导出', 'Review': '评估', 'Generated {0}': '生成于{0}',
  'Page {0} of {1}': '第{0}页 / 共{1}页',
  'Full record and interactive charts:': '完整成绩与交互图表：',
  'Event report': '单项报告', 'Event reports': '各项目报告',
  'Personal bests': '个人最好成绩', 'Events': '项目',
  'event/course combinations': '项目/池长组合', '{0} competitions': '{0}场比赛',
  'Strongest': '最强项', 'Best time': '最好成绩',
  'bests {0} months apart': '两项最好成绩相隔约{0}个月',
  'Document language': '文件语言',
  '{0} races · {1} events · {2} competitions': '{0}项成绩 · {1}个项目 · {2}场比赛',
  'Whole-record documents': '整体档案文件',
  'Every event with its best time, meet, pool length, date and age. Written straight from the database.':
    '每个项目的最好成绩、赛事、池长、日期与当时年龄，直接取自数据库。',
  'Excel': 'Excel 表格',
  'The full analysis page: age curve, progression model for every event, stroke balance, speed endurance and method notes.':
    '完整的分析页：年龄曲线、各项目进步模型、泳姿均衡、速度耐力与方法说明。',
  'All event reports': '全部项目报告',
  'One page per event: labelled progression chart, progression model and every swim. {0} pages.':
    '每个项目一页：带数据标注的进步曲线、进步模型与全部场次，共{0}页。',
  'Single events': '单个项目',
  'Every file carries the athlete\'s name and date of birth, the date it was produced, and a link back to this dashboard.':
    '每份文件都包含运动员姓名与出生日期、生成日期，以及返回本站的链接。',
  'Export failed: {0}': '导出失败：{0}',
  'Rendering the chart…': '正在生成图表…', 'Building the report…': '正在生成报告…',
  'Building the document…': '正在生成文件…', 'Building {0} pages…': '正在生成{0}页…',
  'Save PNG': '存为PNG', 'Save PDF': '存为PDF', 'Preparing…': '准备中…',
  'Method: times are plotted against the date of each race; the fastest swim in each event carries a star and the dashed line marks it.':
    '方法：成绩按比赛日期绘制；各项目最快的一次标有星号，虚线即该成绩。',
  'World Aquatics points score a swim against the world record for that event and pool length, P = 1000 × (B/T)³, so events of different length and stroke can be compared on one scale.':
    '世界水上运动积分以该项目及池长的世界纪录为基准计分，P = 1000 × (B/T)³，因此不同距离与泳姿可在同一尺度上比较。',
  'Improvement rate is the slope of a least-squares fit of log race-time on date, expressed as percent change per year; negative means getting faster. The 95% interval comes from the two-sided t distribution on n−2 degrees of freedom, and needs at least three races.':
    '进步速率为成绩对数对日期最小二乘拟合的斜率，以每年百分比变化表示，负值代表变快。95%区间取自自由度为n−2的双侧t分布，至少需要三场比赛。',
  'Short course (25 m) and long course (50 m) are treated as separate events throughout and are never pooled.':
    '短池（25米）与长池（50米）全程视为独立项目，从不混合统计。',
  'An event needs at least three races to be modelled: two points define a line exactly, leaving no residual from which to estimate uncertainty.':
    '一个项目至少需要三场比赛才能建模：两个点恰好确定一条直线，没有残差可用于估计不确定性。',
  'Points are scored against {0}.': '积分基准为{0}。',
  'Age is calculated from {0} to the date of each race.': '年龄按{0}至每场比赛日期计算。',
  'Riegel exponent n from T = k · dⁿ, solved between the 50 and the 100 of the same stroke and pool. Lower is better; world-class sprinters sit near 1.05–1.10 over this step.':
    'Riegel指数n由T = k · dⁿ在同一泳姿、同一池长的50米与100米之间求得。数值越低越好；世界级短距离选手约在1.05–1.10。',
  'of {0} recorded — {1} have fewer than 3 races': '共{0}个项目 — 其中{1}个不足3场',
  'Not yet modelled: {0}.': '暂未建模：{0}。',

  /* access */
  'Restricted area': '受限页面',
  'Adding, editing and deleting results is limited to the account holder. Everything else on the site is open to view.':
    '新增、修改与删除成绩仅限本人操作。网站其余内容均可自由浏览。',
  'Passcode': '访问密码', 'Unlock': '解锁',
  'Back to the dashboard': '返回总览', 'Already unlocked.': '已解锁。',
  'No passcode is configured on the server.': '服务器未设置访问密码。',
  'Unlock failed': '解锁失败',
  'This is limited to the account holder.': '此功能仅限本人使用。',
  'Locked': '已锁定', 'Unlocked': '已解锁', 'Lock': '锁定',

  /* written review */
  'Written review': '文字评估',
  'A written assessment of the complete competition record: where she stands, what the numbers show, and what is worth discussing with her coach. Written in the language the site is currently set to.':
    '基于完整比赛记录的文字评估：目前的水平、数据说明了什么，以及有哪些值得与教练讨论的问题。生成语言与当前网站语言一致。',
  'Anything specific to look at (optional)': '希望重点了解的内容（选填）',
  'e.g. which events to prioritise next season': '例如：下个赛季应以哪些项目为重点',
  'Generate review': '生成评估', 'Print / save as PDF': '打印 / 存为PDF',
  'Reading the full record and writing the review. This usually takes under a minute.':
    '正在读取完整成绩并撰写评估，通常不到一分钟。',

  'Technical reference': '技术文档', 'Help': '帮助',
  'What is this?': '这是什么？',

  /* help page */
  'How to read this site': '如何阅读本站',
  'This is the complete competition record for one swimmer: every race, when it was swum, in which pool, and how it compares with what came before. Nothing here is an estimate — each row is a timed result from a meet.':
    '这里是一名运动员完整的比赛记录：每一场比赛的时间、池长，以及与此前成绩的对比。所有内容均非估算——每一行都是比赛中的计时成绩。',
  'The pages are: {0} for the headline picture, {1} for one stroke and distance at a time, {2} for a single competition, {3} for the statistics, {4} for a written summary, {5} to search everything, and {6} to download it.':
    '各页面：{0} 查看总体情况，{1} 查看单个泳姿与距离，{2} 查看单场比赛，{3} 查看统计分析，{4} 查看文字评估，{5} 检索全部记录，{6} 下载文件。',
  'Reading a chart': '如何看图',
  'Time runs up the vertical axis with the fastest swims at the top, so an improving line rises. The axis is always labelled to make that clear.':
    '纵轴为成绩，最快的成绩在最上方，因此进步表现为曲线上升。坐标轴上均有明确标注。',
  'Colour identifies the stroke, never anything else.': '颜色只代表泳姿，不表示其他含义。',
  'A solid line is a 25 m pool; a dashed line is a 50 m pool.': '实线为25米池，虚线为50米池。',
  'A gold star marks the fastest swim in that event, and the dashed line across the chart sits at that time.':
    '金色星标为该项目最快的一次成绩，横贯图表的虚线即位于该成绩处。',
  'Hovering or tapping a point shows the exact time, the date, her age that day, the meet, the speed, the pace and the points.':
    '将鼠标移到数据点上或点击该点，会显示准确成绩、日期、当日年龄、赛事、速度、配速与积分。',
  'The two pool lengths': '两种池长',
  'A 25 m pool gives twice as many turns as a 50 m pool over the same distance, and a push off the wall is faster than swimming. Times from the two are therefore not comparable, and this site never mixes them: every event exists separately as short course and long course, each measured against its own world record.':
    '同样的距离，25米池的转身次数是50米池的两倍，而蹬壁比游进更快。因此两者成绩不可直接比较，本站也从不混用：每个项目都分为短池与长池两项，各自对照相应的世界纪录。',
  'World Aquatics points': '世界水上运动积分',
  'A raw time cannot tell you whether a 50 backstroke is better than a 200 medley. Points solve that: each swim is scored against the world record for that exact event and pool length.':
    '单看成绩无法判断50米仰泳与200米混合泳孰优孰劣。积分解决了这一问题：每项成绩都与该项目、该池长的世界纪录相比计分。',
  'A swim equal to the world record scores 1000. Higher is better, and because every event is scored the same way, the number is comparable across all of them. Events with no world record in the table are shown as an em dash rather than guessed at.':
    '与世界纪录相同的成绩为1000分。分数越高越好；由于所有项目计分方式一致，该数值在项目之间可直接比较。基准表中没有世界纪录的项目显示为破折号，不作推测。',
  'For example, her {0} of {1} scores {2} points.': '例如，她的{0}成绩{1}折合{2}分。',
  'Speed and pace': '速度与配速',
  'Speed is the average metres swum per second. Pace is the same figure turned around: how long 100 m would take at that rate, which is the form coaches usually think in.':
    '速度指每秒游进的平均米数。配速是同一数据的另一种表达：按该速度游完100米所需的时间，也是教练更习惯使用的形式。',
  'Improvement rate and confidence': '进步速率与置信度',
  'On the Analysis page each event gets a rate such as −12% per year. It comes from fitting a straight line through the logarithm of her times against the date, so it reads as a proportional change and stays comparable between a 50 and a 200. Negative means getting faster.':
    '在分析页，每个项目都有一个速率，例如每年−12%。它来自对成绩取对数后与日期做直线拟合，因此表示比例变化，在50米与200米之间同样可比。负值代表变快。',
  'Every rate is shown with a 95% interval, the range the true rate is very likely to sit in. A narrow interval means the trend is well established; a wide one means there are not yet enough races. An event with fewer than three races gets no rate at all, because two points define a line exactly and leave nothing from which to judge uncertainty.':
    '每个速率都附有95%区间，即真实速率极可能落在的范围。区间窄说明趋势已较为确定；区间宽说明比赛场次还不够。少于三场的项目不给出速率，因为两个点恰好确定一条直线，没有任何余地用于判断不确定性。',
  'Searching': '检索',
  'The {0} page searches every field at once. Plain words match anything — an event name, a date, a meet, even a formatted time. Qualifiers narrow it and can be combined; all of them must match.':
    '{0} 页面可同时检索所有字段。直接输入的词会匹配任意内容——项目名、日期、赛事，甚至格式化后的成绩。限定词可缩小范围并任意组合，所有条件需同时满足。',
  'one stroke': '单一泳姿', '50 m pool only': '仅50米池',
  'faster than 35 seconds': '快于35秒', 'swum before her tenth birthday': '十岁生日之前的成绩',
  'Downloading': '下载',
  'The {0} page produces PDFs and an Excel workbook. Charts can also be saved one at a time as an image from the button above each chart. Every file names the athlete and her date of birth, records the date it was made, and links back here.':
    '{0} 页面可生成PDF与Excel表格。图表也可通过图表上方的按钮单张保存为图片。每份文件都注明运动员姓名与出生日期、生成日期，并附有返回本站的链接。',
  'Exported charts label every single data point and leave the fitted trend line out, so nothing on the page is a model rather than a measured result.':
    '导出的图表会标注每一个数据点，并且不含拟合趋势线，因此页面上的内容全部是实测成绩，而非模型推算。',
  'Where the numbers come from': '数据来源',
  'Results are entered from official meet results and are not edited afterwards. Each row records where it came from, and the {0} page lists the method behind every calculation on the site.':
    '成绩依据正式比赛结果录入，录入后不再修改。每条记录都标注了来源，{0} 页面列出了本站每一项计算所使用的方法。',
  'The small {0} marks throughout the site explain individual figures where they appear.':
    '站内各处的 {0} 标记会就地解释相应的数据含义。',


  /* meet mobile sync */
  'Meet Mobile export': 'Meet Mobile 数据', 'Meet Mobile': 'Meet Mobile',
  'paste the results JSON from the app': '粘贴 App 中的成绩数据（JSON）',
  'Meet Mobile data': 'Meet Mobile 数据',
  'Match against my records': '与我的记录比对',
  'How do I get this?': '如何获取？',
  'Paste the Meet Mobile results JSON first.': '请先粘贴 Meet Mobile 的成绩 JSON。',
  'Matching…': '正在比对…',
  'Compared {0} swims: {1} already match, {2} new, {3} differ.':
    '比对了{0}项成绩：{1}项已一致，{2}项为新增，{3}项存在差异。',
  '{0} swims are new or differ. Confirm the ones to save.': '有{0}项为新增或存在差异，请确认要保存的项目。',
  'Everything in that export already matches your records.': '该数据中的所有成绩均已与你的记录一致。',
  'Meet Mobile has {0}; the record had {1}': 'Meet Mobile 为 {0}；原记录为 {1}',
  'Data source': '数据来源', 'Sources': '来源', 'From Meet Mobile': '来自 Meet Mobile',
  'Last updated': '最近更新', 'Sync from Meet Mobile': '从 Meet Mobile 同步',
  'training record': '训练记录', 'summary sheet': '汇总表', 'entered by hand': '手动录入',
  'text capture': '文字识别', 'screenshot': '截图识别', 'test': '测试',
  'Records are reconciled against Meet Mobile before they are added, so the two never drift apart.':
    '成绩在加入前会与 Meet Mobile 比对核对，因此两者不会产生偏差。',
  'Syncing from Meet Mobile': '从 Meet Mobile 同步',
  'The site can reconcile against Meet Mobile (the Active.com results app) so the two never drift apart. On the {0} page, paste the results data the app shows for the swimmer into the Meet Mobile box and press match.':
    '本站可与 Meet Mobile（Active.com 的成绩 App）进行核对，使两者保持一致。在 {0} 页面，将 App 中显示的该运动员成绩数据粘贴到 Meet Mobile 框中并点击比对即可。',
  'It compares every swim with what is already stored and reports three groups: already matching, genuinely new, and any where the times differ. You confirm which of the new or differing swims to save; nothing is written without your say-so.':
    '系统会将每项成绩与已存储的记录比较，并分为三类：已一致、确属新增、以及成绩存在差异的项。你可确认要保存哪些新增或有差异的成绩；未经确认不会写入任何内容。',
  'Active does not offer a public interface, so the site cannot pull the data on its own — you provide the export and the site does the matching. The screenshot and text capture on the same page work the same way if you do not have the raw data.':
    'Active 未提供公开接口，因此本站无法自行拉取数据——由你提供导出内容，本站负责比对。若没有原始数据，同一页面的截图与文字识别功能同样适用。',

  /* chart chrome */
  'TIME  (faster ↑)': '成绩（越靠上越快 ↑）',
  'WORLD AQUATICS POINTS  (higher ↑)': '积分（越靠上越好 ↑）',
  'WA POINTS  (higher ↑)': '积分（越靠上越好 ↑）',
  'No results in this selection.': '当前筛选下没有成绩。',
};

let _forcedLang = null;
const LANG = {
  /** An explicit choice always wins; otherwise fall back to the browser locale. */
  get() {
    if (_forcedLang) return _forcedLang;
    const saved = localStorage.getItem('ivy.lang');
    if (saved === 'zh' || saved === 'en') return saved;
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  },
  set(v) { localStorage.setItem('ivy.lang', v); },
  /** Render a block in another language — used to export in EN or 中文
      regardless of what the page is currently showing. */
  as(v, fn) {
    const prev = _forcedLang;
    _forcedLang = (v === 'zh' || v === 'en') ? v : null;
    try { return fn(); } finally { _forcedLang = prev; }
  },
};

/** Translate. `{0}`, `{1}` … are substituted from the extra arguments. */
function t(s, ...a) {
  let out = LANG.get() === 'zh' ? (ZH[s] ?? s) : s;
  return a.length ? out.replace(/\{(\d+)\}/g, (m, i) => a[i] ?? '') : out;
}
/** Singular/plural helper that keeps Chinese (which has no plural) tidy. */
function tn(n, one, many, ...a) { return t(n === 1 ? one : many, n, ...a); }

const LOCALE = () => (LANG.get() === 'zh' ? 'zh-CN' : 'en-GB');
