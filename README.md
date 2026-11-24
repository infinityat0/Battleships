# Battleships

Battleships against the computer, in the browser. Five ships a side, one
shot per turn, sunk ships revealed. The computer has two strengths: Easy
fires at random; Normal hunts on a checkerboard, then targets around hits
and follows the line once two hits line up.

## Play locally

No build step. Serve `public/` over HTTP (ES modules don't load from `file://`):

```sh
npm start          # or: python3 -m http.server -d public
```

## Test

```sh
npm test           # Node 18+, built-in test runner
```

## Layout

- `public/engine.js` – pure rules (fleet placement, firing, sinking) and the computer's strategy
- `public/main.js` – UI: both grids, turns, fleet status, keyboard aiming
- `public/index.html`, `public/base.css`, `public/style.css` – page and styling (light and dark)
- `test/` – engine and strategy tests

## Deploy

Static site; `vercel.json` serves `public/` with no build. Import the
repository in Vercel, or run `vercel --prod`.
