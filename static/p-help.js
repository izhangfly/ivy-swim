/* Help — how to read the site. Written for anyone opening it for the first time. */
'use strict';

(async function () {
  mountShell('help.html');
  const app = document.getElementById('app');
  const rows = await store.load().catch(() => []);
  const events = rows.length ? store.events(rows) : [];
  const example = events.find(e => e.n >= 4) || events[0];

  const section = (title, body) =>
    `<div class="sec-title">${title}</div><div class="card helpdoc">${body}</div>`;

  app.innerHTML = `
    <div class="sec-title">${t('How to read this site')}</div>
    <div class="card helpdoc">
      <p>${t('This is the complete competition record for one swimmer: every race, when it was swum, in which pool, and how it compares with what came before. Nothing here is an estimate — each row is a timed result from a meet.')}</p>
      <p>${t('The pages are: {0} for the headline picture, {1} for one stroke and distance at a time, {2} for a single competition, {3} for the statistics, {4} for a written summary, {5} to search everything, and {6} to download it.',
        `<a href="index.html">${t('Dashboard')}</a>`, `<a href="events.html">${t('Events')}</a>`,
        `<a href="meets.html">${t('Meets')}</a>`, `<a href="analysis.html">${t('Analysis')}</a>`,
        `<a href="advice.html">${t('Review')}</a>`, `<a href="data.html">${t('Data')}</a>`,
        `<a href="export.html">${t('Export')}</a>`)}</p>
    </div>

    ${section(t('Reading a chart'), `
      <p>${t('Time runs up the vertical axis with the fastest swims at the top, so an improving line rises. The axis is always labelled to make that clear.')}</p>
      <ul>
        <li>${t('Colour identifies the stroke, never anything else.')}</li>
        <li>${t('A solid line is a 25 m pool; a dashed line is a 50 m pool.')}</li>
        <li>${t('A gold star marks the fastest swim in that event, and the dashed line across the chart sits at that time.')}</li>
        <li>${t('Hovering or tapping a point shows the exact time, the date, her age that day, the meet, the speed, the pace and the points.')}</li>
      </ul>`)}

    ${section(t('The two pool lengths'), `
      <p>${t('A 25 m pool gives twice as many turns as a 50 m pool over the same distance, and a push off the wall is faster than swimming. Times from the two are therefore not comparable, and this site never mixes them: every event exists separately as short course and long course, each measured against its own world record.')}</p>`)}

    ${section(t('World Aquatics points'), `
      <p>${t('A raw time cannot tell you whether a 50 backstroke is better than a 200 medley. Points solve that: each swim is scored against the world record for that exact event and pool length.')}</p>
      <p style="font-family:'Teko',sans-serif;font-size:23px;margin:10px 0">P = 1000 × (record ÷ time)³</p>
      <p>${t('A swim equal to the world record scores 1000. Higher is better, and because every event is scored the same way, the number is comparable across all of them. Events with no world record in the table are shown as an em dash rather than guessed at.')}</p>
      ${example ? `<p>${t('For example, her {0} of {1} scores {2} points.',
          example.label, fmt.time(example.best.seconds), example.points ?? '—')}</p>` : ''}`)}

    ${section(t('Speed and pace'), `
      <p>${t('Speed is the average metres swum per second. Pace is the same figure turned around: how long 100 m would take at that rate, which is the form coaches usually think in.')}</p>`)}

    ${section(t('Improvement rate and confidence'), `
      <p>${t('On the Analysis page each event gets a rate such as −12% per year. It comes from fitting a straight line through the logarithm of her times against the date, so it reads as a proportional change and stays comparable between a 50 and a 200. Negative means getting faster.')}</p>
      <p>${t('Every rate is shown with a 95% interval, the range the true rate is very likely to sit in. A narrow interval means the trend is well established; a wide one means there are not yet enough races. An event with fewer than three races gets no rate at all, because two points define a line exactly and leave nothing from which to judge uncertainty.')}</p>`)}

    ${section(t('Searching'), `
      <p>${t('The {0} page searches every field at once. Plain words match anything — an event name, a date, a meet, even a formatted time. Qualifiers narrow it and can be combined; all of them must match.', `<a href="data.html">${t('Data')}</a>`)}</p>
      <table class="data" style="margin-top:8px"><tbody>
        <tr><td><code>stroke:fly</code></td><td>${t('one stroke')}</td></tr>
        <tr><td><code>course:lcm</code></td><td>${t('50 m pool only')}</td></tr>
        <tr><td><code>time&lt;35</code></td><td>${t('faster than 35 seconds')}</td></tr>
        <tr><td><code>age&lt;10</code></td><td>${t('swum before her tenth birthday')}</td></tr>
        <tr><td><code>pb</code></td><td>${t('only swims that set a personal best')}</td></tr>
      </tbody></table>`)}

    ${section(t('Downloading'), `
      <p>${t('The {0} page produces PDFs and an Excel workbook. Charts can also be saved one at a time as an image from the button above each chart. Every file names the athlete and her date of birth, records the date it was made, and links back here.', `<a href="export.html">${t('Export')}</a>`)}</p>
      <p>${t('Exported charts label every single data point and leave the fitted trend line out, so nothing on the page is a model rather than a measured result.')}</p>`)}

    <div id="meetmobile"></div>
    ${section(t('Syncing from Meet Mobile'), `
      <p>${t('The site can reconcile against Meet Mobile (the Active.com results app) so the two never drift apart. On the {0} page, paste the results data the app shows for the swimmer into the Meet Mobile box and press match.', `<a href="add.html">${t('Add Result')}</a>`)}</p>
      <p>${t('It compares every swim with what is already stored and reports three groups: already matching, genuinely new, and any where the times differ. You confirm which of the new or differing swims to save; nothing is written without your say-so.')}</p>
      <p>${t('Active does not offer a public interface, so the site cannot pull the data on its own — you provide the export and the site does the matching. The screenshot and text capture on the same page work the same way if you do not have the raw data.')}</p>`)}

    ${section(t('Where the numbers come from'), `
      <p>${t('Results are entered from official meet results and are not edited afterwards. Each row records where it came from, and the {0} page lists the method behind every calculation on the site.', `<a href="analysis.html">${t('Analysis')}</a>`)}</p>
      <p>${t('The small {0} marks throughout the site explain individual figures where they appear.', '<span class="helpdot" style="cursor:default">?</span>')}</p>`)}`;
})();
