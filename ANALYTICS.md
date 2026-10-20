# Google Analytics integration

- Property: `559877699`
- Measurement ID: `G-KQ5C6LHH8R`
- Web stream: `16169803215` — Hyderabad Reads website
- URL: `https://hyderabadreads.fun`
- Reporting timezone: India (UTC+05:30); currency: INR.
- Enhanced measurement is disabled in GA4: standard page views only, alongside GA4's automatic session/engagement events.

## Integration with the real website

This branch adds one deferred `/analytics.js` script to the current scaffold's head and its loader at `public/analytics.js`. Carry **both** changes into the actual website build. Do not replace the real site with this placeholder. This branch is not a production deployment.

The loader runs only on `hyderabadreads.fun` and `www.hyderabadreads.fun`. It ignores localhost and preview hosts, prevents repeated initialization, strips query strings/fragments from page location and referrer, and uses a fixed page title. The prepared tag sets Google Signals and ad-personalization signals to false. This draft is not deployed; approval of the property-level ad-personalization setting is pending, and this code must not be deployed as an indirect workaround for that approval. Property-level Google Signals and user-provided data collection were verified off by default. No User-ID, member details, book submissions, custom events, or advertising integration is added.

GA4 still uses its normal analytics cookies/device identifiers. This is not anonymous or cookieless analytics. Add an appropriate privacy disclosure and any consent flow needed for the audience before launch. If the site later introduces personal data in URL paths, member pages, or client-side navigation, review the instrumentation before enabling those flows. Query stripping intentionally omits UTM campaign attribution. Only initial document pageviews are implemented; SPA route tracking is not added.

## Checks

Run `node --test tests/analytics.test.mjs` and `npm run build`. Tests stub the browser and send no events to Google. Local and preview visits deliberately cannot test live ingestion.

After the real site is deployed, visit the production URL once, confirm the tag request and measurement ID in browser developer tools, then confirm the pageview in GA4 Realtime. Do not claim live collection based only on the build or tag presence. At preparation time the production domain returned Vercel `DEPLOYMENT_NOT_FOUND`, so live collection remains unverified.
