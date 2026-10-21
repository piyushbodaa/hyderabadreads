# Hyderabad Reads

The shared library of our weekend book club: every book members are happy to lend or swap, on one set of shelves. Live at **[hyderabadreads.fun](https://hyderabadreads.fun)**.

## Adding books

Everything lives in [`src/data/library.js`](src/data/library.js). Find your name (or copy a reader block) and add a line:

```js
{ title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi & Fantasy', blurb: 'One line about it.' },
```

Only `title` and `author` are required. Optional: `genre`, `language` (if it isn't English), `blurb`, `note`, `onLoanTo`, plus `isbn` or `year` if the fetched cover or date is wrong.

Once a change is merged into `main`, Vercel redeploys in about a minute. Covers, page counts and spine colours are fetched from Open Library during the build.

## Meetup calendar

Dates and venues live in [`src/data/meetups.js`](src/data/meetups.js), one line per meetup. The site shows the month with the next meetup in it. Announcements go out on Instagram at [@hyderabadreads](https://www.instagram.com/hyderabadreads).

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run covers   # fetch covers for new books
npm run build
```

## Contributing

It's open source and contributions are welcome, from club members and anyone else. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add books, update the calendar or change the code, and open a pull request against `main`.

Every change to the site goes through a pull request, so the [pull requests](https://github.com/piyushbodaa/hyderabadreads/pulls?q=is%3Apr) show what changed and why. [CHANGELOG.md](CHANGELOG.md) has the short version.

## License

[MIT](LICENSE). Book covers and publication data come from [Open Library](https://openlibrary.org) and belong to their respective publishers. They are not covered by this license.
