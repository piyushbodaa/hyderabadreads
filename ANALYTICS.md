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
- strips query strings and `#fragments` from the page address and referrer, so book links (`#book/…`) and anything else in a URL never reach Google, and sends a fixed page title;
- sets Google Signals and ad-personalisation signals to off in the tag;
- sends no User-ID, member details or custom events.

GA4 still uses its usual cookies and device identifiers, so this isn't anonymous or cookieless analytics. The footer tells visitors so.

## What it doesn't count

- Which books people open. The site is a single page and `#book/` links are stripped, so every visit is one page view. Book opens could be added later as a custom event, deliberately without member names.
- UTM campaign tags, because query strings are stripped.

## Settings in Google Analytics itself

These live in the GA4 property, not in the code:

- **Google Signals** and **user-provided data collection**: off (checked when the property was set up).
- **Ads personalisation** (Admin → Data collection): turn it off for the property as well. The tag already asks Google not to use this site's data for ad personalisation, but the property setting is the owner's to change and the code is no substitute for it.

## Checks

- `npm test` runs the loader tests in a stubbed browser. Nothing is sent to Google.
- After a deploy, open the live site once, confirm the `gtag/js?id=G-KQ5C6LHH8R` and `collect` requests in the browser's developer tools, then look for the visit in GA4 Realtime. Local and preview visits deliberately send nothing.

History: prepared in [#1](https://github.com/piyushbodaa/hyderabadreads/pull/1) on the day-one placeholder, then moved onto the real site.
