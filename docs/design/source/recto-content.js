// recto-content.js — sample markdown library for the recto reading app.
window.RECTO_TREE = [
  {
    type: "folder", name: "recto", open: true, children: [
      { type: "file", id: "welcome", name: "welcome.md" },
      { type: "file", id: "syntax",  name: "markdown-syntax.md" },
      {
        type: "folder", name: "notes", open: true, children: [
          { type: "file", id: "reading", name: "on-reading-well.md" },
          { type: "file", id: "changelog", name: "changelog.md" },
        ]
      },
      { type: "file", id: "shortcuts", name: "keyboard.md" },
    ]
  },
];

window.RECTO_DOCS = {
  welcome: {
    title: "Welcome to recto",
    path: "recto / welcome.md",
    edited: "Edited 2 days ago",
    md: String.raw`# Welcome to recto

recto is a quiet place to **read** the Markdown you write. Not an editor that happens to preview — a reader that treats your notes, drafts, and documentation like pages in a book.

> The recto is the right-hand page of an open book — the one your eye lands on, the one you turn *toward*. Everything here is built around that single, forward motion: read the next page.

## Why another Markdown app

Most tools optimise for *writing*. They split the screen, crowd the margins, and leave your prose competing with a toolbar. recto inverts that. The document is the interface — typeset on a generous measure, in a face made for long passages, with the machinery tucked to the edges where it belongs.

Three principles guide it:

1. **The page comes first.** Chrome recedes; type leads.
2. **Reading is a setting, not a mode.** Paper, sepia, or night — switch without losing your place.
3. **Structure is navigation.** Your headings become the map.

### Built for the long read

When a document runs long, recto keeps you oriented. The **Contents** panel slides in from the left and tracks your position as you descend, and the measure never stretches past a comfortable line length — around \`66 characters\`, the width typographers have favoured for centuries.

## A taste of the type

You write ordinary Markdown and recto renders it with care. **Bold** carries weight, *italic* leans in, and [links](#) wear the house clay. Inline code like \`recto --open notes/\` sits in a monospace cut so it never disturbs the line.

\`\`\`js
// recto reads your folder and renders, nothing more
import { open } from "recto";

const vault = open("~/notes", { theme: "paper" });
vault.on("change", (doc) => render(doc));
\`\`\`

Tables stay legible without heavy rules:

| Surface   | Background | Best for            |
|-----------|------------|---------------------|
| Paper     | Warm cream | Daytime, long reads |
| Sepia     | Aged paper | Evening, low glare  |
| Night     | Deep umber | Dark rooms          |

---

## Three ways to read

The same document, three views — switch with the menu or the keyboard:

1. **Raw** (\`Ctrl 1\`) — the source, in monospace, nothing rendered.
2. **Rendered** (\`Ctrl 2\`) — clean sans body, the everyday read.
3. **Memo** (\`Ctrl 3\`) — a serif page sized for print and PDF export.

Press \`Ctrl \\\` to show the contents panel. recto follows your system's light or dark appearance automatically.

Turn the page when you're ready.`,
  },

  reading: {
    title: "On Reading Well",
    path: "recto / notes / on-reading-well.md",
    edited: "Edited last week",
    md: String.raw`# On Reading Well

There is a difference between *processing* text and *reading* it. The first is what we do all day — scanning, skimming, triaging. The second is rarer, and worth protecting.

## Slow down the eye

A line that runs too wide forces the eye to hunt for the next row; too narrow and it ricochets. The remedy is old and simple: a fixed, humane measure.

> "The line should be long enough to be interesting, and short enough to be read." — paraphrasing more than one typographer.

### Rhythm over speed

- Give paragraphs room to breathe.
- Let headings announce themselves with space, not decoration.
- Keep one idea per block.

## The right page

To read *well* is to keep moving forward without losing the thread. That is the whole idea behind recto — the page on the right, the one you turn toward.

\`\`\`md
# A heading
Some prose, then a list:
- one
- two
\`\`\`

That is all Markdown asks of you. recto does the rest.`,
  },

  syntax: {
    title: "Markdown Syntax",
    path: "recto / markdown-syntax.md",
    edited: "Edited 3 weeks ago",
    md: String.raw`# Markdown Syntax

A quick reference for what recto renders.

## Headings

Use \`#\` through \`######\`. recto sets them in the reading face with generous space above.

## Emphasis

- \`*italic*\` → *italic*
- \`**bold**\` → **bold**
- \`\u0060code\u0060\` → \`code\`

## Lists

1. Ordered items
2. Nest them freely
   - mixed with bullets
   - as deep as you like

## Quotes & rules

> Block quotes wear a clay rule and a lighter ink.

Separate sections with three dashes:

---

## Code

\`\`\`python
def turn_page(book):
    return book.recto
\`\`\`

## Links & tables

See [the welcome note](#) for a fuller tour. Tables render with quiet lines and a clay header underline.`,
  },

  changelog: {
    title: "Changelog",
    path: "recto / notes / changelog.md",
    edited: "Edited today",
    md: String.raw`# Changelog

## 0.4 — *The reading release*

- **New** Sepia and Night reading themes
- **New** Scroll-tracking outline
- **Improved** Measure now adjustable from Display
- Fixed code blocks clipping on narrow windows

## 0.3

- Library sidebar with folders
- Reading progress rule

## 0.2

- First public build`,
  },

  shortcuts: {
    title: "Keyboard",
    path: "recto / keyboard.md",
    edited: "Edited 1 month ago",
    md: String.raw`# Keyboard

recto stays out of the way, but rewards the hands that know it.

| Keys            | Action                    |
|-----------------|---------------------------|
| \`Ctrl\` \`P\`      | Quick open a document     |
| \`Ctrl\` \`\\\`      | Toggle the library        |
| \`Ctrl\` \`.\`      | Toggle the outline        |
| \`Ctrl\` \`+/-\`    | Text size                 |
| \`J\` / \`K\`        | Page down / up            |

> Vim hands: \`j\` and \`k\` move the page, naturally.`,
  },
};
