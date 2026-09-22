# OnlineJobs.ph Job Watcher (Chrome extension)

Polls OnlineJobs.ph job search results in the background and raises a Chrome
desktop notification when a post you haven't seen before matches your keywords
— "webflow" out of the box. Click a notification to open the post.

## Install (unpacked)

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `extension/` folder.
3. Click the extension icon → **Settings** to set keywords and interval.
4. Make sure Chrome itself is allowed to show notifications in your OS
   settings (macOS: System Settings → Notifications → Google Chrome).

Chrome must be running for checks to happen — this is a browser extension, not
a server. If you need alerts while your machine is off, the same polling logic
belongs in a small cron job / hosted worker instead.

## Settings

| Setting | What it does |
| --- | --- |
| Keywords | Comma separated. One search request per keyword. |
| Match mode | Title must contain any keyword / every keyword / no title filter at all. |
| Exclusions | Titles containing these are never notified (e.g. `unpaid`). |
| Interval | Minutes between checks, minimum 5. |
| Summary threshold | More new posts than this in one check collapse into a single summary notification. |
| Custom search URLs | Watch a filtered search instead: run the search on onlinejobs.ph, paste the resulting URL(s), one per line. Only `onlinejobs.ph` URLs are accepted. |

**The first check never notifies.** It records what is already posted as a
baseline, so you only hear about posts that appear after you install. "Forget
seen posts" resets that baseline.

## How it works

- `src/background.js` — service worker. A `chrome.alarms` timer fetches each
  watch URL (with your cookies, so a logged-in session works), diffs the
  results against the seen-id map in `chrome.storage.local`, stores new matches
  and fires notifications.
- `src/lib/parser.js` — pulls postings out of the results HTML. It anchors on
  the `/jobseekers/job/<slug>-<id>` link shape rather than CSS classes, because
  the URL shape is far more stable than the markup. The numeric id at the end
  of the slug is the dedupe key.
- `src/offscreen.js` — MV3 service workers have no `DOMParser`, so parsing runs
  in an offscreen document when available; the worker falls back to a regex
  parser if it can't create one.
- `src/options.*`, `src/popup.*` — settings page and the toolbar popup (last
  check status, recent matches, "Check now").

## Tests

```
node test/parser.test.mjs      # parsing, keyword filtering, watch-URL building
node test/background.test.mjs  # seed → diff → notify flow, against mocked chrome APIs
```

Both run on plain Node with no dependencies, against
`test/sample-results.html`. The background test stubs `fetch` and the `chrome.*`
APIs, and checks that the first run only seeds, that an added post notifies
exactly once, and that HTTP errors and login walls surface as errors.

## Caveats worth knowing

- **The parser was written against the documented URL shape, not a live page**
  — the sandbox this was built in cannot reach onlinejobs.ph. If a check
  reports "No job links found", open a search page, view source, confirm result
  links still look like `/jobseekers/job/<slug>-<id>`, and adjust
  `src/lib/parser.js` if they don't.
- Some OnlineJobs.ph pages require a logged-in session. The extension fetches
  with your browser cookies; if it hits a login wall it says so in the popup
  instead of silently reporting zero results.
- Keep the interval reasonable. Scraping a search page every few minutes is
  what a person refreshing the page does; hammering it isn't, and OnlineJobs.ph
  may rate-limit or block you. Check their terms before running it aggressively
  or sharing it.
