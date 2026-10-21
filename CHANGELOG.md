# Changelog

What's changed on [hyderabadreads.fun](https://hyderabadreads.fun), newest first. Every change now arrives as a pull request. The [closed pull requests](https://github.com/piyushbodaa/hyderabadreads/pulls?q=is%3Apr+is%3Aclosed) have the full detail, with screenshots.

## 2026-10-21

### Visit counts with Google Analytics

- The live site counts page visits with Google Analytics, set up privately: only on hyderabadreads.fun, with addresses stripped of anything after `?` or `#`, no member details, and Google Signals and ad personalisation off. The footer says so. Details in [ANALYTICS.md](ANALYTICS.md).

### New link preview

- Links shared on WhatsApp, Instagram and elsewhere now show the new logo, with a fresh stack of members' books and a mention of the meetups. The image has a new file name so apps fetch it again instead of reusing the old preview.

### Changes now go through pull requests

- Every change to the site is now a pull request with a description of what changed and why, so anyone can follow along. Added a pull request template and this changelog.

### AI assistants can read the site ([`0c1c457`](https://github.com/piyushbodaa/hyderabadreads/commit/0c1c457))

- The shelves are drawn by JavaScript that most AI tools never run, so every build now also writes [`llms.txt`](https://hyderabadreads.fun/llms.txt), [`llms-full.txt`](https://hyderabadreads.fun/llms-full.txt) and [`library.json`](https://hyderabadreads.fun/library.json), plus `robots.txt`, `sitemap.xml` and schema.org data for the club and each meetup.
- The footer shows the logo and points AI assistants to `llms.txt`.

### Open source under the MIT License ([`b1f8db8`](https://github.com/piyushbodaa/hyderabadreads/commit/b1f8db8))

- Added the MIT License and a [contributing guide](CONTRIBUTING.md) for adding books, updating the calendar and changing the code.

### Filters, fixes, Instagram and GitHub ([`f74428b`](https://github.com/piyushbodaa/hyderabadreads/commit/f74428b))

- The chips under the search box follow the arrangement: members, genres, languages or writer letters.
- Fixed phone layout rules that had stopped applying, and the header blur missing in Chrome and on Android.
- Reader cards switch the shelves back to Member before filtering. Surprise me no longer picks a hidden book.
- "Meetups" is now "Calendar". Instagram and GitHub icons in the header and footer.

### Meetup calendar ([`598d323`](https://github.com/piyushbodaa/hyderabadreads/commit/598d323))

- A Calendar section with the next meetup, a Maps link and the month's dates (a list on phones). Dates live in `src/data/meetups.js`.
- Links to Instagram [@hyderabadreads](https://www.instagram.com/hyderabadreads).

### New logo ([`ff9e39b`](https://github.com/piyushbodaa/hyderabadreads/commit/ff9e39b))

- The Charminar rising out of an open book, in the header, the browser tab and as the phone home-screen icon.

### Shelves ([`98b394b`](https://github.com/piyushbodaa/hyderabadreads/commit/98b394b), [`ad90444`](https://github.com/piyushbodaa/hyderabadreads/commit/ad90444), [`b0f288b`](https://github.com/piyushbodaa/hyderabadreads/commit/b0f288b))

- Arrange the shelves by Member (the default), Genre, Language or Writer. Writer shelves read like "A · Adams – Austen".
- Two members per shelf on phones, which halves the scrolling. No more book counts on the shelf labels.
- Books can have a `language`, for Telugu, Hindi, Urdu and other titles.

### Readers ([`351ec34`](https://github.com/piyushbodaa/hyderabadreads/commit/351ec34), [`df8ea60`](https://github.com/piyushbodaa/hyderabadreads/commit/df8ea60))

- All 19 club members, listed A to Z, each with placeholder books until their real lists come in.

### Launch ([`be18912`](https://github.com/piyushbodaa/hyderabadreads/commit/be18912), [`ec58342`](https://github.com/piyushbodaa/hyderabadreads/commit/ec58342), [`b9b01fd`](https://github.com/piyushbodaa/hyderabadreads/commit/b9b01fd))

- The shared bookshelf: covers and spine colours from Open Library, search, a 3D book viewer, a link for every book, and "Ask to bring it" for borrowing.
