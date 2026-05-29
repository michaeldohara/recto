// marks.jsx — recto logo marks. Each accepts {ink, accent, paper, size}.
// All geometry on a 96×96 grid. currentColor is avoided; explicit fills.

function MarkFolio({ ink, accent, paper = "#fff", size = 96 }) {
  // Dog-eared page — recto, the right page you turn to. Literary/literal.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="recto folio mark">
      <path d="M23 13 H57 L83 39 V79 a4 4 0 0 1-4 4 H23 a4 4 0 0 1-4-4 V17 a4 4 0 0 1 4-4 Z" fill={ink} />
      {/* folded corner */}
      <path d="M57 13 V35 a4 4 0 0 0 4 4 H83 Z" fill={accent} />
      {/* reading lines knocked out */}
      <g stroke={paper} strokeWidth="3.4" strokeLinecap="round">
        <line x1="29" y1="52" x2="61" y2="52" />
        <line x1="29" y1="61" x2="73" y2="61" />
        <line x1="29" y1="70" x2="66" y2="70" />
      </g>
    </svg>
  );
}

function MarkSpread({ ink, accent, paper = "#fff", size = 96 }) {
  // Open book spread; the right page (recto) is the solid one.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="recto spread mark">
      {/* verso (left) — outline */}
      <path d="M48 23 C38 16.5 26 16.5 13 19.5 V74 C26 71 38 71 48 77.5 Z"
            fill="none" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      {/* recto (right) — solid */}
      <path d="M48 23 C58 16.5 70 16.5 83 19.5 V74 C70 71 58 71 48 77.5 Z" fill={accent} />
      {/* spine */}
      <line x1="48" y1="23" x2="48" y2="77.5" stroke={ink} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function MarkMonogram({ ink, accent, paper = "#fff", size = 96 }) {
  // Serif 'r' set in a ring — letter-in-mark, ties to the wordmark.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="recto monogram mark">
      <circle cx="48" cy="48" r="37" stroke={ink} strokeWidth="4" />
      <text x="48" y="49" textAnchor="middle" dominantBaseline="central"
            fontFamily="Newsreader, serif" fontWeight="500" fontSize="58" fill={accent}
            style={{ fontStyle: "normal" }}>r</text>
    </svg>
  );
}

function MarkMarkdown({ ink, accent, paper = "#fff", size = 96, bare = false }) {
  // Chevron — markdown blockquote '>' & terminal prompt; "turn to the next page".
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="recto markdown mark">
      {!bare && <rect x="12" y="12" width="72" height="72" rx="20" fill={ink} />}
      <polyline points="40,33 60,48 40,63" fill="none" stroke={bare ? ink : accent} strokeWidth="7"
                strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarkMargin({ ink, accent, paper = "#fff", size = 96 }) {
  // Minimal: a steel margin rule — the spine of the open book.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="recto margin mark">
      <line x1="40" y1="20" x2="40" y2="76" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <line x1="40" y1="20" x2="56" y2="20" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <line x1="40" y1="76" x2="56" y2="76" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      {/* faint text lines to the right */}
      <g stroke={ink} strokeWidth="3" strokeLinecap="round" opacity="0.35">
        <line x1="52" y1="38" x2="74" y2="38" />
        <line x1="52" y1="48" x2="78" y2="48" />
        <line x1="52" y1="58" x2="70" y2="58" />
      </g>
    </svg>
  );
}

Object.assign(window, { MarkFolio, MarkSpread, MarkMonogram, MarkMarkdown, MarkMargin });
