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

function renderLeg(leg) {
  let h3 = leg.titleHtml;
  if (leg.badge) {
    h3 += ` <span class="badge${leg.badge.res ? ' res' : ''}">${leg.badge.text}</span>`;
  }
  if (leg.map) {
    const href = 'https://maps.apple.com/?q=' + encodeURIComponent(leg.map);
    h3 += ` <a class="mappin" href="${attr(href)}" target="_blank" rel="noopener">MAP</a>`;
  }

  let inner = `<p>${leg.bodyHtml}</p>`;
  if (leg.chips && leg.chips.length) {
    const chips = leg.chips.map(c =>
      `<span class="chip ${attr(c.type)}">${c.label}</span>`
    ).join('');
    inner += `\n        <div class="chips">${chips}</div>`;
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

function renderDay(d, i) {
  const legs = (d.legs || []).map(renderLeg).join('\n\n    ');
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

function renderPanel(c) {
  const items = (c.items || []).map(it =>
    `<li><span class="box"></span><span>${it}</span></li>`
  ).join('\n    ');
  return `<div class="panel">
  <h2>${c.heading}</h2>
  <p class="lede">${c.lede}</p>
  <ul class="todo" id="todo">
    ${items}
  </ul>
  <p class="notes">${c.notes}</p>
</div>`;
}

/* ---------- behaviour wiring ---------- */

function wireTabs() {
  const tabs = document.querySelectorAll('.tab');
  const days = document.querySelectorAll('.day');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    days.forEach(d => d.classList.remove('show'));
    t.classList.add('active');
    document.getElementById(t.dataset.day).classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

function wireChecklist(storageKey) {
  const KEY = storageKey || 'trip-todo';
  const todoItems = [...document.querySelectorAll('#todo li')];

  async function save() {
    const done = todoItems.map((li, i) => li.classList.contains('done') ? i : -1).filter(i => i >= 0);
    const val = JSON.stringify(done);
    // Prefer the Claude app's window.storage when present; fall back to localStorage.
    try { if (window.storage && window.storage.set) { await window.storage.set(KEY, val); return; } } catch (e) {}
    try { localStorage.setItem(KEY, val); } catch (e) {}
  }
  async function load() {
    let val = null;
    try { if (window.storage && window.storage.get) { const r = await window.storage.get(KEY); val = r && r.value; } } catch (e) {}
    if (val == null) { try { val = localStorage.getItem(KEY); } catch (e) {} }
    if (val) { try { JSON.parse(val).forEach(i => todoItems[i] && todoItems[i].classList.add('done')); } catch (e) {} }
  }
  todoItems.forEach(li => li.addEventListener('click', () => { li.classList.toggle('done'); save(); }));
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
    ...trip.days.map((d, i) => renderDay(d, i)),
    renderPanel(trip.checklist),
    `<footer>${trip.footer}</footer>`
  ].join('\n\n');

  wireTabs();
  wireChecklist(trip.storageKey);
  loadWeather(trip);
}

main();

/* Register the service worker for offline use. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
