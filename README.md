# Puzzle of Fortune

A browser-based phrase puzzle game with multiple categories, game modes, daily puzzles, achievements, and local progress saving.

## Play

```bash
# From this directory
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

A static server is required (multi-file JS/CSS + service worker). On phone/desktop Chrome you can **Install app** / **Add to Home Screen** after the first visit (PWA).

## Tests

```bash
node tests/run-tests.js
```

Covers scoring, answer matching (accents / aliases / “or” variants), mode rules, session puzzle picking, save normalize/migrate, and puzzle-bank sanity (no browser required).

## Project layout

```text
index.html              # Page shell + markup
manifest.webmanifest    # PWA manifest
sw.js                   # Service worker (offline shell)
icons/                  # App icons
css/styles.css          # Custom styles (Tailwind via CDN)
js/
  data/puzzles.js       # Puzzle bank (640 questions)
  scoring.js            # Modes, points, accents, achievements data
  state.js              # Session + localStorage save/load
  game.js               # Sessions, submit, reveals, navigation
  ui.js                 # Board, modals, toasts, dashboards
  main.js               # Bootstrap + SW registration
tests/
  run-tests.js          # Node unit tests
```

Scripts are classic globals (not ES modules) so existing `onclick="..."` handlers keep working without a build step.

## Features

- **640 puzzles** across 8 categories (80 each)
- **Modes**: Normal, Challenge, Time Attack, No Mistakes, Marathon
- **Daily Puzzle** with streak tracking
- Achievements, session recap, stats dashboard
- Progress in `localStorage` (`puzzleOfFortuneState`; migrates older `yuletideFortuneState`)

## Scoring (summary)

| Difficulty | Base points |
|------------|-------------|
| Easy | 8 |
| Medium | 10 |
| Hard | 12 |

- Reveal letter: −1 · Extra hint: −2 · Full reveal / timeout: 0  
- Multipliers: Challenge 1.5×, No Mistakes 2×  
- Minimum 4 points before multipliers (unless fully revealed)

## Development notes

- No bundler required — edit files and refresh.
- Load order is fixed in `index.html` (puzzles → scoring → state → game → ui → main).
- Save schema is versioned (`version: 2`) with normalization on load.
- After changing shell assets, bump `CACHE_VERSION` in `sw.js` so clients pick up updates.
- First offline visit needs a successful online load (CDN CSS/icons get cached on use).
- Destructive / mode prompts use in-app `showConfirm` / `showAlert` (not `window.confirm`).

## License

Personal / project use unless otherwise noted.
