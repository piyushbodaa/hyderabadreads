# Changelog

What's changed on [hyderabadreads.fun](https://hyderabadreads.fun), newest first. Every change now arrives as a pull request. The [closed pull requests](https://github.com/piyushbodaa/hyderabadreads/pulls?q=is%3Apr+is%3Aclosed) have the full detail, with screenshots.

## 2026-10-21

### Members manage their own shelves

- Every member signs in with their own link. There's no password or email: an admin makes the link at **/admin** and sends it on WhatsApp.
- **My shelf** (/me) is where members add books. They search by title, author or ISBN, or **scan the barcode** with the phone camera, and the cover and spine colours fill themselves in. They can also type a book in by hand.
- Members can add a note to each book ("Margins full of scribbles"), change its genre or language, or take it off the shelf.
- Sample shelves can be kept ("Yes, they're really mine") or cleared with one tap.
- Admins add, rename and remove members, make admins, and make new sign-in links. A new link cancels the old one.
- The header's "Add your books" becomes "My shelf" once you're signed in.

### The library moves into a database, and every book gets its own page

- The shelves, members and meetup calendar now live in a Postgres database (Neon, through Vercel) instead of a file in the code. This is the groundwork for members managing their own shelves and loans.
- Every book has its own address, like [/book/dune-herbert](https://hyderabadreads.fun/book/dune-herbert), and every member their own shelf, like [/shelf/piyush](https://hyderabadreads.fun/shelf/piyush). Old `#book/…` links still work.
- Links pasted into WhatsApp or Instagram show that book's cover with "On Piyush's shelf" (or the member's covers fanned out), instead of the same site-wide picture for everything.
- Search engines and anyone without JavaScript get the whole catalogue as plain HTML, plus schema.org data for each book and upcoming meetup.
- New: [/meetups.ics](https://hyderabadreads.fun/meetups.ics), a calendar feed to subscribe to.
- The starting shelves were placeholders, so they're marked as **samples**. Their plates read "· SAMPLE", the books sit slightly dimmer, and opening one says it's a placeholder instead of offering "Ask to bring it".
- Google Analytics never sees member names: shelf addresses are counted together.

### A proper 404 page, security headers and keyboard shelves

- Addresses that don't exist get a "This page isn't on our shelves" page with links back to the library and the calendar, instead of Vercel's bare "NOT_FOUND".
- `www.hyderabadreads.fun` now redirects to `hyderabadreads.fun` on the home page too. Other pages already did.
- The site sends standard security headers: a content security policy, no framing by other sites, no MIME sniffing, a strict referrer policy, and no camera, microphone or location access.
- The bookcase takes one press of Tab instead of about 125. The arrow keys move along the shelves, up and down jump to the shelf above or below, and Home and End go to the first and last book.

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
