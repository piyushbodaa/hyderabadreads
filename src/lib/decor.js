// Small objects that fill the empty end of a shelf. Sizes are at shelf scale 1.

export const DECOR = [
  {
    name: 'chai',
    w: 40,
    h: 62,
    svg: `<svg viewBox="0 0 40 62" aria-hidden="true">
      <g class="decor__steam" fill="none" stroke="rgba(255,240,220,.35)" stroke-width="1.6" stroke-linecap="round">
        <path d="M15 20c-3-4 3-6 0-10s3-6 0-9" /><path d="M24 21c-3-4 3-6 0-10s3-6 0-9" />
      </g>
      <path d="M7 24h26l-3 36H10z" fill="rgba(255,255,255,.07)" stroke="rgba(255,245,230,.4)" stroke-width="1" />
      <path d="M8.1 33h23.8L30 60H10z" fill="#a8652c" />
      <path d="M8.1 33h23.8" stroke="#e2ae76" stroke-width="2.2" />
      <path d="M13 26l1.6 33M20 26v33M27 26l-1.6 33" stroke="rgba(255,255,255,.12)" stroke-width="1" />
      <path d="M9 25l2 9" stroke="rgba(255,255,255,.35)" stroke-width="1.4" stroke-linecap="round" />
    </svg>`,
  },
  {
    name: 'plant',
    w: 58,
    h: 96,
    svg: `<svg viewBox="0 0 58 96" aria-hidden="true">
      <defs><linearGradient id="leaf" x1="0" x2="1"><stop offset="0" stop-color="#2f5a35" /><stop offset=".5" stop-color="#4f8a4c" /><stop offset="1" stop-color="#2a4d2f" /></linearGradient></defs>
      <path d="M29 66C25 44 18 22 22 4c6 18 9 40 7 62z" fill="url(#leaf)" />
      <path d="M27 66C17 52 6 40 3 22c12 12 22 28 24 44z" fill="url(#leaf)" opacity=".9" />
      <path d="M31 66c8-16 16-28 24-40-2 18-12 30-24 40z" fill="url(#leaf)" opacity=".85" />
      <path d="M30 66c2-14 8-30 16-46 0 18-6 32-16 46z" fill="#3e7240" />
      <path d="M12 64h34l-4 32H16z" fill="#b8673f" />
      <path d="M10 62h38v7H10z" fill="#c97a4f" />
      <path d="M16 72h26" stroke="rgba(0,0,0,.15)" stroke-width="2" />
    </svg>`,
  },
  {
    name: 'charminar',
    w: 62,
    h: 80,
    svg: `<svg viewBox="0 0 62 80" aria-hidden="true">
      <defs><linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#8a6a32" /><stop offset=".45" stop-color="#e6c57e" /><stop offset="1" stop-color="#7a5a26" /></linearGradient></defs>
      <g fill="url(#brass)">
        <rect x="3" y="18" width="7" height="58" rx="1" /><rect x="52" y="18" width="7" height="58" rx="1" />
        <path d="M6.5 6c3 3 4 7 3.5 11h-7C2.5 13 3.5 9 6.5 6z" /><path d="M55.5 6c3 3 4 7 3.5 11h-7c-.5-4 .5-8 3.5-11z" />
        <rect x="1.5" y="30" width="10" height="2.5" rx="1" /><rect x="50.5" y="30" width="10" height="2.5" rx="1" />
        <rect x="1.5" y="46" width="10" height="2.5" rx="1" /><rect x="50.5" y="46" width="10" height="2.5" rx="1" />
        <path d="M10 40h42v36H10z" />
        <rect x="9" y="36" width="44" height="4" rx="1" />
      </g>
      <path d="M22 76V60c0-6 4-10 9-13 5 3 9 7 9 13v16z" fill="#1a120b" />
      <path d="M13 50h6v6h-6zM43 50h6v6h-6z" fill="#1a120b" opacity=".7" />
      <rect x="6" y="76" width="50" height="4" rx="1" fill="#6b4f22" />
    </svg>`,
  },
  {
    name: 'stack',
    w: 92,
    h: 38,
    svg: `<svg viewBox="0 0 92 38" aria-hidden="true">
      <rect x="6" y="26" width="84" height="12" rx="1.5" fill="#3a5a7a" /><rect x="6" y="26" width="5" height="12" fill="rgba(0,0,0,.25)" />
      <path d="M14 30h60" stroke="#d9b46a" stroke-width="1" opacity=".7" />
      <rect x="2" y="13" width="78" height="13" rx="1.5" fill="#8a2a2a" /><rect x="74" y="13" width="6" height="13" fill="#efe4cc" />
      <path d="M8 19.5h50" stroke="#e8c98a" stroke-width="1.2" opacity=".7" />
      <rect x="10" y="3" width="70" height="10" rx="1.5" fill="#d8c9a6" /><rect x="74" y="3" width="6" height="10" fill="#f5eedd" />
      <path d="M16 8h40" stroke="#5a4428" stroke-width="1.2" opacity=".6" />
    </svg>`,
  },
]
