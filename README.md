# Hyderabad Reads

The shared library of our weekend book club: every book members are happy to lend or swap, on one set of shelves. Live at **[hyderabadreads.fun](https://hyderabadreads.fun)**.

## How it's built

- **The shelves** are plain JavaScript and CSS, built with [Vite](https://vite.dev), with no framework.
- **The library lives in Postgres** ([Neon](https://neon.com), connected through Vercel). The tables are members, books, meetups, venues, settings, and uploaded covers in `media`. The schema is in [`server/migrate.js`](server/migrate.js) and updates itself during each deploy.
- **The server is a few Vercel Functions** in [`api/`](api), which route their work to [`server/`](server). They render:
  - the home page, every book (`/book/dune-herbert`) and every member's shelf (`/shelf/piyush`), each with its own title, link preview and schema.org data;
  - link-preview images (`/og/book/<id>.jpg`);
  - the feeds: `llms.txt`, `llms-full.txt`, `library.json`, `sitemap.xml`, and `meetups.ics` for calendar apps.
- Pages are cached at Vercel's edge for a minute, so a change to the library shows up within a minute or so.
- **It works offline, and installs as an app.** A service worker ([`public/sw.js`](public/sw.js)) keeps the last copy of each page and the covers it has shown, so the shelves open without a connection. With [`public/manifest.webmanifest`](public/manifest.webmanifest) and the icons in `public/icons/` (drawn by `node scripts/icons.mjs`), phones can add it to the home screen.

A brand-new database starts with the shelves and calendar in [`src/data/`](src/data). Those books are placeholders, so every shelf is marked as a **sample** until its owner adds real books.

## Members

Members sign in with a personal link, so there are no passwords, emails or phone numbers to collect. An admin makes the link at [/admin](https://hyderabadreads.fun/admin) and sends it on WhatsApp. The member opens it, and lands on [/me](https://hyderabadreads.fun/me), where they can:

- add books by searching Open Library, scanning the barcode, or typing them in;
- write a note for each book;
- keep or clear their sample books.

The database only stores a hash of each link. Making someone a new link cancels their old one.

For the very first admin, before anyone can make links on the site, print one from a terminal:

```sh
vercel env pull .env.production.local --environment production
node --env-file=.env.production.local scripts/invite.mjs Piyush
```

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173, with a local database in .data/
npm test         # server, pages, feeds and analytics tests
npm run build
npm run preview  # the production build, same local database
npm run test:browser  # after a build: the site in Chrome, at phone and laptop sizes
npm run lighthouse    # after a build: Lighthouse, against the budgets in lighthouserc.json
```

Every pull request runs the tests, the build, the browser checks and Lighthouse on GitHub Actions; see [CONTRIBUTING.md](CONTRIBUTING.md#checks-on-every-pull-request).

No Postgres to install: locally the site uses [PGlite](https://pglite.dev), Postgres compiled to WebAssembly, and fills it with the starting shelves on first run. Delete `.data/` to start again from scratch.

Visits are counted with Google Analytics on the live site only; see [ANALYTICS.md](ANALYTICS.md).

## Contributing

It's open source and contributions are welcome, from club members and anyone else. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to change the code and open a pull request against `main`.

Every change to the site goes through a pull request, so the [pull requests](https://github.com/piyushbodaa/hyderabadreads/pulls?q=is%3Apr) show what changed and why. [CHANGELOG.md](CHANGELOG.md) has the short version.

## License

[MIT](LICENSE). Book covers and publication data come from [Open Library](https://openlibrary.org) and belong to their respective publishers. They are not covered by this license.
