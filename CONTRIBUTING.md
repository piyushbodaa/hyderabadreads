# Contributing to Hyderabad Reads

Thanks for helping. Anyone can contribute, club member or not: bug fixes, new features and ideas are all welcome.

## Books and meetups

The library and the calendar live in the site's database, not in this repository. Members manage their own shelves at [/me](https://hyderabadreads.fun/me): they sign in with a personal link from an admin, then search for a book, scan its barcode, or type it in. Admins look after members and sign-in links at [/admin](https://hyderabadreads.fun/admin).

[`src/data/`](src/data) only holds the starting shelves and calendar that fill a brand-new database, such as a fresh preview or your local copy.

## Changing the code

```sh
git clone https://github.com/<you>/hyderabadreads.git
cd hyderabadreads
npm install
npm run dev      # http://localhost:5173
```

You don't need a database: locally the site uses PGlite (Postgres in WebAssembly) in `.data/`, filled with the starting shelves on first run. To sign in locally as any member, open [localhost:5173/__dev/invite?name=Piyush](http://localhost:5173/__dev/invite?name=Piyush) and follow the link it prints. That address only exists in local development.

- Work on a branch and open a pull request against `main`.
- Run `npm test` and `npm run build` before you push.
- Check your change at phone width (about 390px) as well as on a laptop. Most of the club opens the site on a phone.
- Keep pull requests small. The pull request template asks what changed and why. Fill it in so the club can follow along, and add screenshots for anything visual.
- Add a line to [`CHANGELOG.md`](CHANGELOG.md) under today's date. If you forget, a maintainer will do it when merging.
- Schema changes go at the end of `MIGRATIONS` in `server/migrate.js`, as new statements that are safe to run twice. Never edit a migration that has already shipped.

### Checks on every pull request

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs three checks on each pull request, and on `main` after each merge:

- **Tests and build:** `npm test` and `npm run build`.
- **Browser checks:** the built site in Chrome at phone and laptop sizes. The tests are in [`e2e/`](e2e):
  - the shelves and search;
  - a book's address and a member's shelf;
  - the 404 page;
  - the covers view;
  - nothing scrolling sideways;
  - signing in;
  - opening the shelves offline.
- **Lighthouse:** the home page and a book page, three runs each, held to the budgets in [`lighthouserc.json`](lighthouserc.json):
  - accessibility and best practices at 95 or more, and SEO at 90 or more;
  - layout shift under 0.1;
  - at most 50 KB of scripts, 30 KB of styles and 300 KB of fonts;
  - nothing loaded from other sites.

  A performance score under 80 is only a warning, because shared CI machines vary too much for a hard limit. Each run keeps its reports for two weeks.

You can run the browser checks and Lighthouse yourself. They use your installed Google Chrome and a throwaway database, so they never touch the one in `.data/`:

```sh
npm run build
npm run test:browser
npm run lighthouse
```

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
| `server/auth.js` | Sign-in links and sessions |
| `server/members.js`, `server/app.js` | The members' API: My shelf and admin |
| `server/openlibrary.js` | Book search, covers and spine colours from Open Library |
| `server/covers.js` | A new book's cover: Apple Books' HD artwork first, then Open Library's |
| `src/me.js`, `src/admin.js` | The My shelf and admin pages |
| `src/lib/scan.js` | Barcode scanning with the phone camera |
| `server/loans.js` | Requests, loans, returns, and the weekly digest's data |
| `src/lib/session.js` | Who's signed in on the home page, and the lending they see |
| `src/bookplates.js`, `src/digest.js` | Printable QR bookplates, and the weekly WhatsApp digest |
| `server/calendar.js` | Admins' calendar, venues and club details |
| `src/lib/calendar-links.js`, `src/lib/meetup-time.js` | Add-to-calendar links, and meetup times as calendar times |
| `src/lib/faq.js`, `server/photos.js` | Newcomers' questions (page and schema.org), and meetup photos |
| `server/extras.js`, `src/stats.js`, `src/year.js` | The Wanted shelf, the club in numbers, and each member's year |
| `public/sw.js`, `src/lib/pwa.js` | The service worker that keeps the shelves working offline, and its registration |
| `e2e/`, `lighthouserc.json`, `scripts/serve-build.mjs` | The browser checks and Lighthouse budgets, and the server they run against |

## Licence

By contributing, you agree that your contributions are released under the [MIT License](LICENSE).
