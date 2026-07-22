# Trip, Plotted — an offline-first travel itinerary PWA

A single-page travel itinerary that installs to a phone home screen and works
**fully offline** (including the fonts). Every trip-specific detail lives in one
JSON file, so making a new trip means writing one new file — no HTML, CSS, or JS
changes.

The first trip is **Boston, Plotted** — a daddy-daughter weekend, Jul 24–26 2026.

## Live site

Deployed via GitHub Pages: **https://gottspd.github.io/boston-trip/**

## How it works

```
index.html            generic shell (no trip content)
app.js                renders a trip from JSON into the itinerary design
styles.css            the visual design (unchanged from the original)
fonts.css + fonts/    self-hosted Newsreader / Archivo / IBM Plex Mono (offline)
manifest.webmanifest  PWA install metadata
sw.js                 service worker — precaches everything for offline use
icons/                app icons (192 / 512 / maskable / apple-touch)
trips/
  boston-2026.json    ← all the trip-specific content lives here
```

`app.js` fetches `trips/<slug>.json` and builds the exact same markup the
original hand-written page used, so the design is identical.

## Make a new trip (one file)

1. Copy `trips/boston-2026.json` to `trips/<your-slug>.json` and edit the
   content (city, dates, flights, stops, restaurants, transit, checklist).
2. Open it with `?trip=<your-slug>` — e.g.
   `https://gottspd.github.io/boston-trip/?trip=lisbon-2027`.
3. To make it the default trip served at the root URL, set `DEFAULT_TRIP` at the
   top of `app.js` and add the new file to the `sw.js` precache list.

The home-screen name, colors, and icons follow the JSON (`appName`,
`appShortName`, `themeColor`, `backgroundColor`), so a new trip needs no other
edits to install cleanly.

### Trip JSON shape

Text fields ending in `Html` accept inline HTML (`<b>`, `<em>`) for emphasis,
matching the original design.

```jsonc
{
  "title": "Boston, Plotted | Michael and Allie",  // browser + install title
  "appName": "Boston, Plotted",
  "appShortName": "Boston",                          // home-screen label
  "storageKey": "boston-trip-todo",                  // checklist persistence key
  "themeColor": "#16303C",
  "backgroundColor": "#E7EEF0",
  "weather": { "latitude": 42.353, "longitude": -71.044, "timezone": "America/New_York" },
  "header": {
    "eyebrow": "Plotted course · Fri Jul 24 to Sun Jul 26, 2026",
    "titleHtml": "Boston, with <em>Allie</em>",      // <em> = the accent word
    "sub": "…",
    "facts": [ { "html": "Land <b>10:20 AM</b> …", "href": "https://…" }, { "html": "…" } ]
  },
  "days": [
    {
      "id": "fri",
      "tab": { "label": "Friday", "subHtml": "Harbor + North End" },
      "heading": "Day 1 · Friday, July 24",
      "course": "…",
      "date": "2026-07-24",                          // drives the live weather line
      "legs": [
        {
          "time": "10:20",
          "meal": false,                              // true = filled timeline dot
          "titleHtml": "Land at Logan …",
          "badge": { "text": "Reserve now", "res": true },   // res = orange badge
          "bodyHtml": "…",
          "chips": [ { "type": "walk", "label": "Walk · 5 min" } ],  // walk|sl|red|ferry|taxi
          "tipHtml": "…",
          "swap": { "label": "Swap", "bodyHtml": "…" },
          "map": "Barking Crab 88 Sleeper St Boston"  // adds a one-tap Apple Maps pin
        }
      ]
    }
  ],
  "checklist": { "heading": "Before you fly", "lede": "…", "items": ["…"], "notes": "…" },
  "footer": "…"
}
```

## Offline & fonts

The Google Fonts (Newsreader, Archivo, IBM Plex Mono) are downloaded into
`fonts/` and referenced by `fonts.css`, so there is **no runtime call to Google**
and the type renders with no network. The service worker precaches the shell,
fonts, icons, and the trip JSON. The only network-dependent feature is the live
weather line, which fails silently offline (the plan still stands).

## PWA install

- **iPhone:** open the site in Safari → Share → *Add to Home Screen*. It launches
  full-screen and works offline.
- **Android/desktop Chrome:** use the install button in the address bar.

## Deploy

Pushing to the deploy branch runs `.github/workflows/deploy.yml`, which enables
GitHub Pages (if needed) and publishes the repo root. Any static host works too —
it is plain files with relative paths, so it runs from any subpath.
