# Contributing to Hyderabad Reads

Thanks for helping. Anyone can contribute, club member or not: bug fixes, new features and ideas are all welcome.

## Books and meetups

The library and the calendar live in the site's database, not in this repository. Members manage their own shelves on the site, and the club's admins run the calendar. Until sign-in arrives, send your titles to Piyush on the club group.

[`src/data/`](src/data) only holds the starting shelves and calendar that fill a brand-new database, such as a fresh preview or your local copy.

## Changing the code

```sh
git clone https://github.com/<you>/hyderabadreads.git
cd hyderabadreads
npm install
npm run dev      # http://localhost:5173
```

You don't need a database: locally the site uses PGlite (Postgres in WebAssembly) in `.data/`, filled with the starting shelves on first run.

- Work on a branch and open a pull request against `main`.
- Run `npm test` and `npm run build` before you push.
- Check your change at phone width (about 390px) as well as on a laptop. Most of the club opens the site on a phone.
- Keep pull requests small. The pull request template asks what changed and why. Fill it in so the club can follow along, and add screenshots for anything visual.
- Add a line to [`CHANGELOG.md`](CHANGELOG.md) under today's date. If you forget, a maintainer will do it when merging.
- Schema changes go at the end of `MIGRATIONS` in `server/migrate.js`, as new statements that are safe to run twice. Never edit a migration that has already shipped.

The site is plain JavaScript and CSS built with [Vite](https://vite.dev), with no framework. The main pieces:

| File | What it does |
| --- | --- |
| `src/main.js` | Search, filters, sections and wiring on the home page |
| `src/lib/model.js` | Turns the library data into books with spine designs |
| `src/lib/bookcase.js` | Shelves, grouping and the sliding layout |
| `src/lib/viewer.js` | The 3D book that opens when you pick one |
| `api/*.js` | Vercel Functions: pages, feeds and link-preview images |
| `server/page.js` | Server-rendered pages: titles, link previews, structured data |
| `server/library.js` | Everything a visitor can see, in one database round trip |
| `server/migrate.js`, `server/seed.js` | The database schema, and the starting shelves for an empty database |
| `server/og.js` | Link-preview images, drawn with Satori and sharp |
| `server/feeds.js` | `llms.txt`, `llms-full.txt`, `library.json`, `sitemap.xml`, `meetups.ics` |
| `server/dev.js` | Runs the same server inside Vite for `npm run dev` and `npm run preview` |

## Licence

By contributing, you agree that your contributions are released under the [MIT License](LICENSE).
