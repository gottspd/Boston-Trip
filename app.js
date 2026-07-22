/* =========================================================================
   Travel itinerary template — renders a trip from trips/<slug>.json into the
   exact same DOM/design as the original single-file itinerary.

   To make a new trip: drop a new file in trips/, e.g. trips/lisbon-2027.json,
   and open the app with ?trip=lisbon-2027 (or set DEFAULT_TRIP below).
   No HTML/CSS/JS changes required.
   ========================================================================= */

const DEFAULT_TRIP = 'boston-2026';

/* ---- tiny HTML helpers ---------------------------------------------------
   Trip content is authored HTML (trusted, first-party JSON), injected as-is so
   the rendered markup matches the original hand-written itinerary byte for byte.
   `attr()` escapes values used inside HTML attributes (hrefs, data-dates). */
const attr = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slugFromQuery() {
  const p = new URLSearchParams(location.search).get('trip');
  // allow only a safe slug so ?trip= can't point elsewhere
  return (p && /^[a-z0-9-]+$/i.test(p)) ? p : DEFAULT_TRIP;
}

/* ---------- renderers (return HTML strings) ---------- */

function renderHeader(h) {
  const facts = (h.facts || []).map(f => f.href
    ? `<a class="fact flink" href="${attr(f.href)}" target="_blank" rel="noopener">${f.html}</a>`
    : `<div class="fact">${f.html}</div>`
  ).join('\n    ');
  return `<header>
  <div class="eyebrow">${h.eyebrow}</div>
  <h1>${h.titleHtml}</h1>
  <p class="sub">${h.sub}</p>
  <div class="facts">
    ${facts}
  </div>
</header>`;
}

function renderNav(days) {
  const tabs = days.map((d, i) =>
    `<button class="tab${i === 0 ? ' active' : ''}" data-day="${attr(d.id)}">${d.tab.label} <small>${d.tab.subHtml}</small></button>`
  ).join('\n  ');
  return `<nav aria-label="Days">\n  ${tabs}\n</nav>`;
}

// Turn a leg's transit chips into one-tap actions: walking directions from the
// previous stop, and Uber/Lyft to this stop when the plan calls for a rideshare.
function actionChips(leg, origin) {
  if (!leg.map) return '';
  const labels = (leg.chips || []).map(c => (c.label || '').toLowerCase());
  const out = [];
  const dest = encodeURIComponent(leg.map);
  if (labels.some(l => l.includes('walk')) && origin) {
    const u = 'https://maps.apple.com/?saddr=' + encodeURIComponent(origin) + '&daddr=' + dest + '&dirflg=w';
    out.push(`<a class="chip act" href="${attr(u)}" target="_blank" rel="noopener">Walk directions ›</a>`);
  }
  if (labels.some(l => l.includes('rideshare'))) {
    const uber = 'https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=' + dest;
    const lyft = 'https://lyft.com/ride?id=lyft&destination[address]=' + dest;
    out.push(`<a class="chip act" href="${attr(uber)}" target="_blank" rel="noopener">Uber ›</a>`);
    out.push(`<a class="chip act" href="${attr(lyft)}" target="_blank" rel="noopener">Lyft ›</a>`);
  }
  return out.join('');
}

function renderLeg(leg, origin) {
  let h3 = leg.titleHtml;
  if (leg.badge) {
    h3 += ` <span class="badge${leg.badge.res ? ' res' : ''}">${leg.badge.text}</span>`;
  }
  if (leg.web) {
    h3 += ` <a class="webpin" href="${attr(leg.web)}" target="_blank" rel="noopener">SITE</a>`;
  }
  if (leg.map) {
    const href = 'https://maps.apple.com/?q=' + encodeURIComponent(leg.map);
    h3 += ` <a class="mappin" href="${attr(href)}" target="_blank" rel="noopener">MAP</a>`;
  }

  let inner = `<p>${leg.bodyHtml}</p>`;
  const chips = (leg.chips || []).map(c => `<span class="chip ${attr(c.type)}">${c.label}</span>`).join('');
  const acts = actionChips(leg, origin);
  if (chips || acts) {
    inner += `\n        <div class="chips">${chips}${acts}</div>`;
  }
  if (leg.tipHtml) inner += `\n        <p class="tip">${leg.tipHtml}</p>`;
  if (leg.swap) inner += `\n        <div class="swap"><b>${leg.swap.label}</b> · ${leg.swap.bodyHtml}</div>`;

  return `<div class="leg${leg.meal ? ' meal' : ''}">
      <div class="time">${leg.time}</div><div class="dot"></div>
      <div class="card">
        <h3>${h3}</h3>
        ${inner}
      </div>
    </div>`;
}

function renderDay(d, i, base) {
  // Track the previous located stop so each leg can offer directions from it.
  let origin = base || null;
  const legs = (d.legs || []).map(leg => {
    const html = renderLeg(leg, origin);
    if (leg.map) origin = leg.map;
    return html;
  }).join('\n\n    ');
  return `<section class="day${i === 0 ? ' show' : ''}" id="${attr(d.id)}">
  <div class="dayhead">
    <h2>${d.heading}</h2>
    <p class="course">${d.course}</p>
    <p class="wx" data-date="${attr(d.date)}"></p>
  </div>
  <div class="course-line">
    ${legs}
  </div>
</section>`;
}

function renderPanel(c, listId) {
  const items = (c.items || []).map(it =>
    `<li><span class="box"></span><span>${it}</span></li>`
  ).join('\n    ');
  return `<div class="panel">
  <h2>${c.heading}</h2>
  <p class="lede">${c.lede}</p>
  <ul class="todo" id="${listId}">
    ${items}
  </ul>
  ${c.notes ? `<p class="notes">${c.notes}</p>` : ''}
</div>`;
}

// Optional add-on cards (e.g. a side trip), rendered as standalone cards with
// an honest "my take" verdict. Not part of the day timeline or the live status.
function renderOptional(opt) {
  if (!opt || !opt.cards || !opt.cards.length) return '';
  const cards = opt.cards.map(c => {
    let h3 = c.titleHtml;
    if (c.badge) h3 += ` <span class="badge${c.badge.res ? ' res' : ''}">${c.badge.text}</span>`;
    if (c.web) h3 += ` <a class="webpin" href="${attr(c.web)}" target="_blank" rel="noopener">SITE</a>`;
    if (c.map) {
      const href = 'https://maps.apple.com/?q=' + encodeURIComponent(c.map);
      h3 += ` <a class="mappin" href="${attr(href)}" target="_blank" rel="noopener">MAP</a>`;
    }
    let inner = `<p>${c.bodyHtml}</p>`;
    const chips = (c.chips || []).map(x => `<span class="chip ${attr(x.type)}">${x.label}</span>`).join('');
    if (chips) inner += `\n        <div class="chips">${chips}</div>`;
    if (c.tipHtml) inner += `\n        <p class="tip">${c.tipHtml}</p>`;
    if (c.verdictHtml) inner += `\n        <div class="verdict">${c.verdictHtml}</div>`;
    return `<div class="card optcard"><h3>${h3}</h3>\n        ${inner}</div>`;
  }).join('\n\n    ');
  return `<section class="optional">
  <div class="dayhead">
    <h2>${opt.heading}</h2>
    <p class="course">${opt.lede}</p>
  </div>
  ${cards}
</section>`;
}

/* ---------- behaviour wiring ---------- */

function activateDay(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.day === id));
  document.querySelectorAll('.day').forEach(d => d.classList.toggle('show', d.id === id));
}

function wireTabs() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    activateDay(t.dataset.day);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

/* ---- "You are here": open the current day and scroll to the current leg ----
   Leg times mix AM/PM (e.g. 8:45 and 8:15), but legs are chronological, so we
   resolve each to real minutes-since-midnight by keeping the sequence rising. */
function dayLegMinutes(day) {
  let prev = -1;
  return (day.legs || []).map(leg => {
    const [h, m] = String(leg.time).split(':').map(Number);
    let mins = (h % 12) * 60 + (m || 0);   // 12 -> 0
    while (mins < prev) mins += 720;        // bump into PM to stay increasing
    prev = mins;
    return mins;
  });
}

function nowInTrip(tz) {
  // ?now=YYYY-MM-DDTHH:MM overrides the clock (for previewing / testing).
  const override = new URLSearchParams(location.search).get('now');
  if (override) {
    const [d, t] = override.split('T');
    const [h, m] = (t || '00:00').split(':').map(Number);
    return { dateStr: d, minutes: (h || 0) * 60 + (m || 0) };
  }
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const g = type => p.find(x => x.type === type).value;
    return { dateStr: `${g('year')}-${g('month')}-${g('day')}`, minutes: (parseInt(g('hour'), 10) % 24) * 60 + parseInt(g('minute'), 10) };
  } catch (e) {
    const d = new Date();
    return { dateStr: d.toISOString().slice(0, 10), minutes: d.getHours() * 60 + d.getMinutes() };
  }
}

function plainText(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
function absMin(dateStr, min) { return Math.round(Date.parse(dateStr + 'T00:00:00Z') / 60000) + min; }
function fmtClock(min) { let h = Math.floor(min / 60), m = min % 60, p = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + p; }
function fmtDelta(mins) {
  if (mins <= 0) return 'now';
  if (mins < 60) return 'in ' + mins + 'm';
  if (mins < 1440) { const h = Math.floor(mins / 60), m = mins % 60; return m ? `in ${h}h ${m}m` : `in ${h}h`; }
  const d = Math.round(mins / 1440); return 'in ' + d + (d > 1 ? ' days' : ' day');
}

// Flatten every leg into one chronological list with its real minutes + DOM index.
function flatLegs(trip) {
  const out = [];
  (trip.days || []).forEach(day => {
    const mins = dayLegMinutes(day);
    (day.legs || []).forEach((leg, i) => out.push({
      dayId: day.id, i, date: day.date, min: mins[i],
      title: plainText(leg.titleHtml), dayLabel: (day.tab && day.tab.label) || day.id
    }));
  });
  return out;
}

function tripStatus(trip, now) {
  const legs = flatLegs(trip);
  if (!legs.length) return null;
  const past = L => (L.date < now.dateStr) || (L.date === now.dateStr && L.min <= now.minutes);
  let current = null, next = null;
  for (const L of legs) { if (past(L)) current = L; else { next = L; break; } }
  return { current, next, nowAbs: absMin(now.dateStr, now.minutes) };
}

function legElement(dayId, i) { const s = document.getElementById(dayId); return s ? s.querySelectorAll('.leg')[i] : null; }

function setNowMarker(status, now) {
  document.querySelectorAll('.leg.now').forEach(e => e.classList.remove('now'));
  const c = status.current;
  if (c && c.date === now.dateStr) { const el = legElement(c.dayId, c.i); if (el) el.classList.add('now'); }
}

// The fixed "Now / Next" bar at the bottom of the screen.
function updateNowBar(status, now) {
  let bar = document.getElementById('nowbar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'nowbar'; bar.setAttribute('role', 'button'); document.body.appendChild(bar); }
  const c = status.current, n = status.next;
  let label, title, sub, dayId, legIdx;

  if (!c && n) {                                   // before the trip
    label = 'Starts ' + n.dayLabel;
    title = n.title;
    sub = fmtClock(n.min) + ' · ' + fmtDelta(absMin(n.date, n.min) - status.nowAbs);
    dayId = n.dayId; legIdx = n.i;
  } else if (c && !n) {                            // trip over
    label = 'Trip complete'; title = 'Safe travels home ✈️'; sub = '';
    dayId = c.dayId; legIdx = c.i;
  } else if (c && n) {
    const delta = fmtDelta(absMin(n.date, n.min) - status.nowAbs);
    if (c.date === now.dateStr) {                  // mid-day: show Now + Next
      label = 'Now'; title = c.title;
      const dl = n.date === now.dateStr ? '' : n.dayLabel + ' ';
      sub = 'Next · ' + dl + fmtClock(n.min) + ' · ' + n.title + ' · ' + delta;
      dayId = c.dayId; legIdx = c.i;
    } else {                                       // overnight: show what's up next
      label = 'Up next'; title = n.title;
      sub = n.dayLabel + ' · ' + fmtClock(n.min) + ' · ' + delta;
      dayId = n.dayId; legIdx = n.i;
    }
  } else { bar.hidden = true; return; }

  bar.hidden = false;
  bar.innerHTML = '<span class="nb-dot"></span><div class="nb-main">'
    + '<div class="nb-now">' + attr(label) + '</div>'
    + '<div class="nb-title">' + attr(title) + '</div>'
    + (sub ? '<div class="nb-next">' + attr(sub) + '</div>' : '')
    + '</div><span class="nb-cta">Jump ›</span>';
  bar.onclick = () => {
    activateDay(dayId);
    const el = legElement(dayId, legIdx);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

// Recompute "now" marker + bar; called on load and once a minute.
function refreshLive(trip) {
  const now = nowInTrip(trip.weather && trip.weather.timezone);
  const status = tripStatus(trip, now);
  if (!status) return;
  setNowMarker(status, now);
  updateNowBar(status, now);
}

// On first load, open the current day and scroll to where we are.
function autoLocate(trip) {
  const now = nowInTrip(trip.weather && trip.weather.timezone);
  const status = tripStatus(trip, now);
  if (!status) return;
  const c = status.current, n = status.next;
  let target = null;
  if (c && c.date === now.dateStr) target = c;              // during the day
  else if (c && n) target = n;                              // overnight → next up
  else if (c && !n) target = c;                             // after → the finale
  else if (!c && n) { activateDay((trip.days[0] || {}).id); return; }  // before → rest at top
  if (!target) return;
  activateDay(target.dayId);
  const el = legElement(target.dayId, target.i);
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
}

function wireList(listId, storageKey) {
  const KEY = storageKey || ('trip-' + listId);
  const items = [...document.querySelectorAll('#' + listId + ' li')];

  async function save() {
    const done = items.map((li, i) => li.classList.contains('done') ? i : -1).filter(i => i >= 0);
    const val = JSON.stringify(done);
    // Prefer the Claude app's window.storage when present; fall back to localStorage.
    try { if (window.storage && window.storage.set) { await window.storage.set(KEY, val); return; } } catch (e) {}
    try { localStorage.setItem(KEY, val); } catch (e) {}
  }
  async function load() {
    let val = null;
    try { if (window.storage && window.storage.get) { const r = await window.storage.get(KEY); val = r && r.value; } } catch (e) {}
    if (val == null) { try { val = localStorage.getItem(KEY); } catch (e) {} }
    if (val) { try { JSON.parse(val).forEach(i => items[i] && items[i].classList.add('done')); } catch (e) {} }
  }
  items.forEach(li => li.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;   // let booking / call links work without checking the item off
    li.classList.toggle('done'); save();
  }));
  load();
}

async function loadWeather(trip) {
  const w = trip.weather;
  if (!w) return;
  const dates = trip.days.map(d => d.date).filter(Boolean).sort();
  if (!dates.length) return;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + encodeURIComponent(w.latitude)
      + '&longitude=' + encodeURIComponent(w.longitude)
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      + '&temperature_unit=fahrenheit'
      + '&timezone=' + encodeURIComponent(w.timezone || 'auto')
      + '&start_date=' + dates[0] + '&end_date=' + dates[dates.length - 1];
    const res = await fetch(url);
    const d = await res.json();
    if (!d.daily) return;
    d.daily.time.forEach((t, i) => {
      const el = document.querySelector('.wx[data-date="' + t + '"]');
      if (el) el.textContent = 'Forecast · H ' + Math.round(d.daily.temperature_2m_max[i]) + '° / L '
        + Math.round(d.daily.temperature_2m_min[i]) + '° · ' + d.daily.precipitation_probability_max[i] + '% rain';
    });
  } catch (e) { /* no network, no problem: the plan stands */ }
}

/* Keep the installed-app identity in sync with the trip JSON, so a new trip
   only needs a new JSON file — the home-screen name/colours follow it.
   iOS uses <title> + apple-mobile-web-app-title; Android/Chrome uses the
   manifest, which we regenerate from the JSON as a data URL. */
function applyIdentity(trip) {
  if (trip.title) document.title = trip.title;
  const setMeta = (sel, val) => { const m = document.querySelector(sel); if (m && val) m.setAttribute('content', val); };
  setMeta('meta[name="apple-mobile-web-app-title"]', trip.appShortName || trip.appName);
  setMeta('meta[name="theme-color"]', trip.themeColor);

  const manifest = {
    name: trip.appName || trip.title || 'Trip',
    short_name: trip.appShortName || trip.appName || 'Trip',
    start_url: './index.html',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: trip.backgroundColor || '#E7EEF0',
    theme_color: trip.themeColor || '#16303C',
    icons: [
      { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: './icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  try {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)));
  } catch (e) { /* static manifest.webmanifest remains as fallback */ }
}

/* ---------- boot ---------- */

async function main() {
  const app = document.getElementById('app');
  const slug = slugFromQuery();
  let trip;
  try {
    const res = await fetch('./trips/' + slug + '.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    trip = await res.json();
  } catch (e) {
    app.innerHTML = '<header><h1>Trip not found</h1><p class="sub">Could not load <code>trips/'
      + attr(slug) + '.json</code>.</p></header>';
    return;
  }

  applyIdentity(trip);

  app.innerHTML = [
    renderHeader(trip.header),
    renderNav(trip.days),
    ...trip.days.map((d, i) => renderDay(d, i, trip.base)),
    trip.optional ? renderOptional(trip.optional) : '',
    renderPanel(trip.checklist, 'todo'),
    trip.packing ? renderPanel(trip.packing, 'packlist') : '',
    trip.photos ? renderPanel(trip.photos, 'photolist') : '',
    `<footer>${trip.footer}</footer>`
  ].join('\n\n');

  wireTabs();
  wireList('todo', trip.storageKey);
  const base = trip.storageKey || 'trip';
  if (trip.packing) wireList('packlist', base + '-pack');
  if (trip.photos) wireList('photolist', base + '-photos');
  autoLocate(trip);
  refreshLive(trip);
  setInterval(() => refreshLive(trip), 60000);
  loadWeather(trip);
}

main();

/* Register the service worker for offline use. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
