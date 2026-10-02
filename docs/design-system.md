# Design system

How PL Games looks and behaves, and the rules that keep it consistent. The
styles live in [`src/styles/`](../src/styles), imported in cascade order by
[`main.css`](../src/styles/main.css):

```
tokens.css          every raw value: colours, spacing, motion, type, layers
base.css            reset, document defaults, focus
layout.css          header, main, footer, toasts, loading skeleton
components/         buttons, controls, navigation, player card, pitch, …
games/              one file per game
pages/              home, how it works
motion.css          keyframes, and the reduced-motion switch
```

## Rules

1. **No raw values outside `tokens.css`.** Components use semantic names that
   say what a colour is *for* (`--color-primary`, `--color-text-muted`), never
   hex codes. Alpha comes from channel tokens:
   `rgb(var(--primary-rgb) / 0.16)`.
2. **Variants, not overrides.** A button is `.btn` plus one role
   (`--primary`, `--accent`, `--ghost`, `--danger`) and at most one size
   (`--sm`, `--big`, `--huge`). New looks become new variants.
3. **One component, one file.** Context-specific tweaks (`.road .picker`) live
   with the game or page, which loads after the components.
4. **Every style change is checked against the snapshot.** The refactor into
   this structure changed no computed style on seven pages, phone and desktop;
   keep it that way unless a change is meant.

## Colour

| Token | Use | Why |
|---|---|---|
| `--color-bg`, `--color-surface`, `--color-surface-raised` | backgrounds, cards, raised cards | deep purple: a night match, premium |
| `--color-primary` (electric green) | the main action, correct, success, the pitch | go, right, growth |
| `--color-accent` (magenta) | the opposite answer, wrong, lower | energy, contrast to green |
| `--color-accent-strong` | filled accent buttons | white text on it is 5.1:1 |
| `--color-info` (cyan) | focus rings, links, "spinning" | information, attention without judgement |
| `--color-warning` (amber) | "close", reader corrections, top scorer | caution, nearly |
| `--color-text`, `--color-text-muted` | body and secondary text | 17:1 and 8:1 on the background |
| `--color-border`, `--color-border-strong` | decorative lines; control outlines | controls need 3:1 (WCAG 1.4.11) |

**Two palettes**, chosen in Settings → Colours: *Night* (the default above)
and *Premier League*, the league's own purple `#37003c` for the surfaces with
its green, raspberry and cyan. A theme only redefines tokens
(`:root[data-theme='pl']` in `tokens.css`); no component knows which is on. A
tiny script in `index.html` applies the saved theme before the first paint.

**Scrolling stays cheap**: no `background-attachment: fixed` (the page glow is
a fixed `body::before` layer instead) and no `backdrop-filter` on the bars over
scrolling content (header, bottom bar, answer bar), which re-render on every
frame and made phones stutter.

Colour is never the only signal: Guess the Player marks correct tiles ✓ and
close ones ≈, progress dots carry screen-reader text, results have titles.

## Type

Inter for text, Barlow Condensed for display numbers and titles; three weights
only (`--weight-regular`, `--weight-semibold`, `--weight-bold`). Body and rules
text is at least 16px; smaller sizes are for labels and captions.

## Icons

Line icons from [Tabler Icons](https://tabler.io/icons) (MIT), one stroke
weight (2px on a 24px grid), drawn in the current text colour through
`<Icon name="…" />` ([`src/components/Icon.tsx`](../src/components/Icon.tsx)).
Games, navigation, badges and buttons use them instead of emoji, which look
different on every phone. Emoji stay only in share texts, where a picture
cannot go. To add one, put its Tabler name in `pipeline/icons.mjs` and run
`npm run icons`.

## Space and touch

An 8px grid (`--space-1` 4px … `--space-7` 48px). Nothing tappable is smaller
than `--touch-min` (44px, Apple's guideline); the bottom bar's items are 56px.

## Motion

| Token | Use |
|---|---|
| `--dur-fast` 120ms | press feedback, colour changes |
| `--dur-base` 200ms | hovers, toggles |
| `--dur-slow` 300ms | entrances, a reel landing, a verdict |
| `--ease-out`, `--ease-spring` | settling; a small overshoot for things that "land" |

Feedback never takes longer than 300ms. Longer sequences are celebrations
(results ticking in, confetti) or ambient loops (the kick-off button's pulse).
Animations only move `transform` and `opacity`. With "reduce motion" on, all of
it stops, haptics included.

## Navigation

- **Phones (≤720px):** a bottom tab bar in thumb reach with at most five
  items: Games, Guess, Road to 100, Budget XI, and More, which opens a bottom
  sheet with the other games, How it works and Settings.
- **Wider screens:** the header's links.
- **Every game** starts with the same header (back, icon, title, score,
  one-line pitch), keeps its rules folded under "How to play", and ends with
  links to the other games. On a return visit the header shrinks to one line
  (back, icon, title, ⓘ for the rules): the game itself starts higher.

## Phone layouts

- **The answer is always in thumb reach.** A game's answer buttons carry
  `.action-bar`: on phones they stick above the bottom bar however long the
  card above them is (Higher or Lower, Beat the Model).
- **What the question is about comes first.** `PlayerCard`'s `head` slot sits
  between the name and the record: Beat the Model's two prices, Price Tag's
  slider. The record follows for whoever wants it.
- **Pickers are bottom sheets.** Budget XI's player list opens as a sheet over
  the pitch (backdrop, ✕, Escape), so choosing never scrolls away from the slot.
- **`.page` must not keep a transform**: its entrance animation fills
  `backwards` only, or `position: fixed` children would be fixed to the page
  instead of the screen.
- **Choices in a row are chips** (`Chips`, a radio group): Higher or Lower's
  themes, the Players page's positions. They scroll sideways rather than wrap.

## Accessibility checklist

- [x] Contrast: text 4.5:1, controls 3:1
- [x] Visible focus rings (`:focus-visible`, cyan)
- [x] Tabs and radio groups: arrow keys, Home/End, one Tab stop
- [x] Dialogs are native `<dialog>`: focus trapped, Escape closes
- [x] Live regions for spins, toasts and results
- [x] Touch targets 44px and up
- [x] Not colour alone
- [x] `prefers-reduced-motion` respected
