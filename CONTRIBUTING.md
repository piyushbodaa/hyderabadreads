# Contributing to Hyderabad Reads

Thanks for helping. Anyone can contribute, club member or not: books, calendar dates, bug fixes and new features are all welcome.

## Adding your books (no coding)

1. Open [`src/data/library.js`](src/data/library.js) on GitHub and click the pencil icon. GitHub makes a copy (a fork) for you.
2. Find your name, or copy a reader block for someone new and slot it in alphabetically.
3. Add one line per book. Only `title` and `author` are required:

   ```js
   { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi & Fantasy' },
   ```

4. Click **Propose changes**, then **Create pull request**. A maintainer reviews and merges it, and the site updates about a minute later, covers and all.

The comment at the top of the file lists the optional fields (`genre`, `language`, `blurb`, `note`, `onLoanTo`, `isbn`, `year`).

## Updating the meetup calendar

Dates and venues live in [`src/data/meetups.js`](src/data/meetups.js). Each meetup is one line:

```js
{ date: '2026-11-07', venue: 'Chilaka' },
```

A new venue goes into `VENUES` first, with its area and (if different from the usual) its timings.

## Changing the code

```sh
git clone https://github.com/<you>/hyderabadreads.git
cd hyderabadreads
npm install
npm run dev      # http://localhost:5173
```

- Work on a branch and open a pull request against `main`.
- Run `npm run build` before you push. It also fetches covers for any new books.
- Check your change at phone width (about 390px) as well as on a laptop. Most of the club opens the site on a phone.
- Keep pull requests small and say what you changed and why. Screenshots help for anything visual.

The site is plain JavaScript and CSS built with [Vite](https://vite.dev), with no framework. The main pieces:

| File | What it does |
| --- | --- |
| `src/data/library.js` | Every reader and book |
| `src/data/meetups.js` | The meetup calendar |
| `src/lib/bookcase.js` | Shelves, grouping and the sliding layout |
| `src/lib/viewer.js` | The 3D book that opens when you pick one |
| `src/main.js` | Search, filters, sections and wiring |
| `scripts/covers.mjs` | Fetches covers and spine colours from Open Library at build time |

## Licence

By contributing, you agree that your contributions are released under the [MIT License](LICENSE).
