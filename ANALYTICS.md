# Google Analytics

- Property: `559877699`
- Measurement ID: `G-KQ5C6LHH8R`
- Web stream: `16169803215`, "Hyderabad Reads website", `https://hyderabadreads.fun`
- Reporting timezone: India (UTC+05:30). Currency: INR.
- Enhanced measurement is off in GA4: standard page views only, plus GA4's automatic session and engagement events.

## How it's wired

`public/analytics.js` is loaded by one `<script defer src="/analytics.js">` in the head of `index.html`. The loader:

- runs only on `hyderabadreads.fun` and `www.hyderabadreads.fun`, never on localhost, Vercel previews or lookalike hosts;
- can't initialise twice;
- strips query strings and `#fragments` from the page address and referrer, and sends a fixed page title;
- keeps member names out of addresses: every `/shelf/<name>` is sent as `/shelf/`, and a second copy of a book (`/book/dune-herbert--piyush`) as the book itself (`/book/dune-herbert`);
- sets Google Signals and ad-personalisation signals to off in the tag;
- sends no User-ID or member details.

GA4 still uses its usual cookies and device identifiers, so this isn't anonymous or cookieless analytics. The footer tells visitors so.

## What it counts

- Page loads, by address. Books have their own addresses (`/book/<id>`), so a book link opened from the club group counts as a visit to that book.
- A few events, sent through `src/lib/track.js` with no parameters: no names, owners or titles.

| Event | When |
| --- | --- |
| `ask_click` | Someone copies or shares an "Ask to bring it" message |
| `borrow_request` | A signed-in member asks for a book |
| `borrow_got` | A member marks a book as borrowed ("I've got it", often from a bookplate's QR code) |
| `calendar_add` | Someone adds a meetup to their calendar, or subscribes to all of them |
| `year_card` | A member shares or downloads their year card |
| `app_install` | Someone installs the site as an app, on a phone or a computer |

The number to watch is `borrow_request` per week: whether the library is being used, not just looked at.

## What it doesn't count

- Books opened from the shelves without reloading the page.
- UTM campaign tags, because query strings are stripped.

## Settings in Google Analytics itself

These live in the GA4 property, not in the code:

- **Google Signals** and **user-provided data collection**: off (checked when the property was set up).
- **Ads personalisation** (Admin → Data collection): turn it off for the property as well. The tag already asks Google not to use this site's data for ad personalisation, but the property setting is the owner's to change and the code is no substitute for it.

## Checks

- `npm test` runs the loader tests in a stubbed browser. Nothing is sent to Google.
- After a deploy, open the live site once, confirm the `gtag/js?id=G-KQ5C6LHH8R` and `collect` requests in the browser's developer tools, then look for the visit in GA4 Realtime. Local and preview visits deliberately send nothing.

History: prepared in [#1](https://github.com/piyushbodaa/hyderabadreads/pull/1) on the day-one placeholder, then moved onto the real site.
