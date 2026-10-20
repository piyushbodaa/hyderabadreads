// Markup for the pieces of a book: its spine (shared by the shelf and the 3D
// viewer so the hand-off between them is seamless), covers and page edges.

import { spineText } from './model.js'

export function escape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function bookVars(book) {
  return [
    `--base:${book.base}`,
    `--accent:${book.accent}`,
    `--ink:${book.ink}`,
    `--title-ink:${book.titleInk}`,
    `--accent-ink:${book.accentInk}`,
    `--h:${book.h}`,
    `--t:${book.t}`,
    `--fs:${book.fs}`,
    `--afs:${book.afs}`,
  ].join(';')
}

export function spineHTML(book) {
  const author = book.style === 'minimal' ? '' : `<span class="spine__author">${escape(book.surname)}</span>`
  const loan = book.onLoanTo ? '<span class="spine__loan" aria-hidden="true"></span>' : ''
  return `
    <span class="spine__title"><span>${escape(spineText(book.title))}</span></span>
    ${author}
    <span class="spine__label">${escape(book.owner.slice(0, 3))}</span>
    ${loan}`
}

export function frontHTML(book) {
  if (book.cover) {
    return `<img src="${book.cover}" alt="" decoding="async" draggable="false" />`
  }
  return `
    <div class="cover-art cover-art--${book.style}">
      <span class="cover-art__rule"></span>
      <span class="cover-art__title">${escape(book.title)}</span>
      <span class="cover-art__author">${escape(book.author)}</span>
    </div>`
}

export function backHTML(book) {
  return `
    <div class="back">
      <p class="back__blurb">${escape(book.blurb || `${book.title}, by ${book.author}.`)}</p>
      <div class="back__foot">
        <span class="back__stamp">From the shelf of<br /><strong>${escape(book.owner)}</strong></span>
        ${barcode(book.seed)}
      </div>
    </div>`
}

function barcode(seed) {
  let x = 0
  let bars = ''
  let s = seed
  while (x < 92) {
    s = (s * 1103515245 + 12345) >>> 0
    const w = 1 + (s % 3)
    if ((s >> 8) & 1) bars += `<rect x="${x}" width="${w}" height="34" />`
    x += w + 1
  }
  return `<svg class="back__barcode" viewBox="0 0 92 34" aria-hidden="true">${bars}</svg>`
}
