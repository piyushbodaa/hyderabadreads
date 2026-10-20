// Stable id for a book, shared by the cover script and the site (covers, URLs).
export function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function bookSlug(book) {
  const surname = book.author.trim().split(/\s+/).pop()
  return slugify(`${book.title} ${surname}`)
}
