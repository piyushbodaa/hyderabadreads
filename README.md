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

A brand-new database starts with the shelves and calendar in [`src/data/`](src/data). Those books are placeholders, so every shelf is marked as a **sample** until its owner adds real books.

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173, with a local database in .data/
npm test         # server, pages, feeds and analytics tests
npm run build
npm run preview  # the production build, same local database
```

No Postgres to install: locally the site uses [PGlite](https://pglite.dev), Postgres compiled to WebAssembly, and fills it with the starting shelves on first run. Delete `.data/` to start again from scratch.

Visits are counted with Google Analytics on the live site only; see [ANALYTICS.md](ANALYTICS.md).

## Contributing

It's open source and contributions are welcome, from club members and anyone else. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to change the code and open a pull request against `main`.

Every change to the site goes through a pull request, so the [pull requests](https://github.com/piyushbodaa/hyderabadreads/pulls?q=is%3Apr) show what changed and why. [CHANGELOG.md](CHANGELOG.md) has the short version.

## License

[MIT](LICENSE). Book covers and publication data come from [Open Library](https://openlibrary.org) and belong to their respective publishers. They are not covered by this license.
