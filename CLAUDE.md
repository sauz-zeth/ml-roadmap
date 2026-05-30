# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Serving Locally

No build step. Static files served directly:
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

Deployed on GitHub Pages at `https://sauz-zeth.github.io/ml-roadmap/`

## Architecture

Interactive ML Engineer learning roadmap — a single-page React 18 app that runs entirely in the browser via CDN (React + Babel transpile JSX at runtime). No bundler, no node_modules.

### File Roles

- **index.html** — Entry point. Loads CDN scripts, contains all CSS (design system, animations, layout). Loads the three JSX files via `<script type="text/babel">`.
- **roadmap-data-v2.jsx** — Graph data & layout algorithm. Defines domains, subdomains, topics, edges, quiz questions. Computes node positions via tidy-tree layout (Bellman-Ford + barycenter). Exports everything to `window.*`.
- **roadmap-app-v2.jsx** — Main `App` component. State management, rendering, animations, keyboard shortcuts, localStorage persistence. Consumes globals from data file.
- **tweaks-panel.jsx** — Reusable settings panel with form controls (toggles, sliders, radios, buttons). Exports components to `window.*`.

### Inter-file Communication

All three JSX files communicate through `window` globals (no module system):
- `roadmap-data-v2.jsx` exports: `NODES`, `EDGES`, `ADJ`, `NODE_BY_ID`, `LAYOUT`, `DOMAINS`, `DOMAIN_COLORS`, `QUIZ_DATA`, `START_ID`, `GOAL_ID`, etc.
- `tweaks-panel.jsx` exports: `useTweaks`, `TweaksPanel`, `TweakToggle`, `TweakButton`, etc.
- `roadmap-app-v2.jsx` consumes all of the above as bare globals.

Script load order in index.html matters: tweaks-panel → roadmap-data → roadmap-app.

### State & Persistence

App state lives in React `useState` hooks inside `App`. Key state: `completed` (Set of done node IDs), `current` (selected node ID), `animPhase`, `zoom`. Persisted to `localStorage` key `ml_roadmap_state_v4` as `{ completed, current }`.

### Graph Unlock Logic

Completing a node unlocks adjacent neighbors (BFS). Test gates award stars. Domain tests require minimum star thresholds (`DOMAIN_THRESHOLD`). Star-gated nodes show dashed borders until enough stars are earned.

### Edge Routing

`smartEdgePath(a, b, allNodes)` in the app file detects node obstacles along bezier curves and routes edges around them with waypoints. This avoids visual clutter from edges crossing through nodes.

### Build Animation

Press **R** to trigger. Single `requestAnimationFrame` loop scrolls viewport bottom-to-top at constant speed. Nodes grouped by Y-position (`ANIM_LEVELS`) reveal as camera passes. All nodes render monochrome during animation (`body.anim-active` CSS class).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Complete current node |
| `Ctrl+T` | Quick-complete current (skip quiz) |
| `R` | Build animation |
| `Ctrl+Shift+R` | Reset progress |
| `G` / `S` / `H` | Scroll to Goal / Start / Here |
| `Ctrl+Wheel` | Zoom (30%–100%) |

All letter shortcuts use `e.code` fallback for Russian keyboard layout support.

## Styling

All CSS lives in `index.html`. Dark theme with CSS variables (`:root`). Domain colors: foundations=#5AC8FA, math=#BF5AF2, data=#30D7DD, classical=#FF9F0A, deep=#FF375F, mlops=#66D4CF. Nodes use `--c` / `--c-soft` CSS variables set via inline styles.

## Quiz System

Only `python_core_test` has real quiz data (15 questions: MCQ, text input, matching). All other tests are stubs that auto-complete. Quiz data is defined in `QUIZ_DATA` object in the data file. Pass threshold is typically 75%.
