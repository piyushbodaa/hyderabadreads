# Hyderabad Reads

The shared library of our weekend book club: every book members are happy to lend or swap, on one set of shelves. Live at **[hyderabadreads.fun](https://hyderabadreads.fun)**.

## Adding books

Everything lives in [`src/data/library.js`](src/data/library.js). Find your name (or copy a reader block) and add a line:

```js
{ title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi & Fantasy', blurb: 'One line about it.' },
```

Only `title` and `author` are required. Optional: `genre`, `blurb`, `note`, `onLoanTo`, plus `isbn` or `year` if the fetched cover or date is wrong.

Commit to `main` and Vercel redeploys in about a minute. Covers, page counts and spine colours are fetched from Open Library during the build.

## Running locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run covers   # fetch covers for new books
npm run build
```
