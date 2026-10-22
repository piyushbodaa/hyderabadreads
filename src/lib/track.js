// Counts what people do on the site, without saying who: events carry no
// names, no owners and no titles. A no-op anywhere Google Analytics doesn't run.
export function track(name, params = {}) {
  window.gtag?.('event', name, params)
}

// Posts opened from the blog or the home page, counted by platform. A member's
// own site counts only as "own site", since its address could name them.
const PLATFORMS = new Set(['Substack', 'Medium', 'WordPress', 'Blogger', 'Ghost'])

export function trackPostOpens() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-post-link]')
    if (link) track('blog_post_open', { platform: PLATFORMS.has(link.dataset.postLink) ? link.dataset.postLink : 'own site' })
  })
}
