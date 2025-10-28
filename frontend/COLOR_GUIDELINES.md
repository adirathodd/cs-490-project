# Color Guidelines — ResumeRocket

This document records the project's color system (CSS custom properties), usage guidelines, and accessibility verification steps.

## Palette (CSS variables and hex values)

Primary palette (3 main colors)

- `--primary-gradient-start`: #667eea — brand blue (used for gradients, banners)
- `--primary-gradient-end`: #764ba2 — brand purple (gradient pair)
- `--primary-color`: #667eea — primary solid blue
- `--primary-dark`: #5a67d8
- `--primary-light`: #7c8ff0

Additional primary variants

- `--primary-deep`: #1e40af — deeper primary for headings/links
- `--primary-deeper`: #1e3a8a — accent deep

Secondary / accents

- `--accent-green`: #10b981
- `--accent-green-dark`:#059669
- `--accent-blue`: #3b82f6
- `--accent-purple`: #8b5cf6

Semantic colors

- Success: `--success-bg` #d4edda | `--success-border` #c3e6cb | `--success-text` #155724
- Error: `--error-bg` #f8d7da | `--error-border` #f5c6cb | `--error-text` #721c24
- Warning: `--warning-bg` #fff3cd | `--warning-border` #ffeaa7 | `--warning-text` #856404
- Info: `--info-bg` #d1ecf1 | `--info-border` #bee5eb | `--info-text` #0c5460

Info gradients

- `--info-gradient-start`: #eff6ff
- `--info-gradient-end`: #dbeafe

Neutral scale (text/background)

Surfaces (note: the app uses a subtly blue-tinted surface color rather than pure white as the most prevalent surface color)

- `--white` (legacy name): #e9f2ff — very light blue (used for bright accents where needed)
- `--surface`: #eaf4ff — preferred token name for card/panel backgrounds (subtle blue-tint; not pure white)
- `--surface-2`: #dfeffb — alternate surface for badges/inputs
- `--muted-border`: #d8e6fb — faint border/divider for surfaces

- `--gray-50` #f9fafb
- `--gray-100` #f0f7ff (page background)
- `--gray-200` #edf2f7
- `--gray-300` #e2e8f0
- `--gray-400` #cbd5e0
- `--gray-500` #a0aec0 (muted text)
- `--gray-600` #718096 (subtext)
- `--gray-700` #4a5568 (body text)
- `--gray-800` #2d3748 (heading text)
- `--gray-900` #1a202c (dark background)

The variables are defined in `frontend/src/index.css` under the `:root` selector. Importing `index.css` in `frontend/src/index.js` exposes variables globally.

## Usage guidelines

- Use `--primary-color` for primary interactive elements (primary buttons, links where appropriate).
- Use the primary gradient (start/end variables) for large brand surfaces such as hero/banner backgrounds, cards, and gradient text.
- Reserve `--accent-*` values for secondary callouts and alternative CTA buttons (e.g., `--accent-green` for confirm actions).
- Use semantic variables for messages and alerts (`--error-*`, `--success-*`, `--warning-*`, `--info-*`).
- Use neutral colors for typography and surfaces. Prefer `--gray-900`/`--gray-800` for headings, `--gray-700`/`--gray-600` for body and secondary text.
- For elevated surfaces (cards, modals), use `--surface` (a subtle off-white) or `linear-gradient(...)` on top of `--gray-100` backgrounds; rely on shadows (`--shadow-*`) for depth.

Notes on text over gradients:

- Gradient background + white text is acceptable for large/display text and buttons with sufficient size (>= 14px bold or large). For small body text over gradients, ensure contrast by applying a semi-opaque overlay or switching to a darker foreground color.

Notes about white vs. surface:

- The design intentionally avoids pure white as the most prevalent surface color. Backgrounds and cards use `--gray-100` and `--surface` to create a softer, modern look while preserving contrast.
- Where a bright on-top color is needed over a gradient (e.g., button text), use `--on-primary` (#ffffff) for clarity; otherwise prefer darker text generated from the neutral scale.

## Accessibility (WCAG) guidance

- Neutral text on neutral backgrounds (e.g., `--gray-800` on `--gray-100`) is designed to meet WCAG AA for normal text in most typical usages. Always verify in context.
- For critical interactions (forms, errors), use semantic text colors (e.g., `--error-text`) and background variants (`--error-bg`) defined above.
- When using the primary gradient behind white text (for buttons and banners), ensure the visual weight and size meet AA or provide an additional contrast-enhancing treatment (e.g., darker gradient, outline, or shadow).

Contrast testing checklist (quick manual checks):

1. Install the axe or Lighthouse extension and run an audit on the page.
2. Check primary CTA buttons (gradient background + white text) for ratio >= 3:1 for large text or >= 4.5:1 for regular text; if failing, switch to `--primary-dark` for text or add a darker gradient stop.
3. Verify form labels (`--gray-700`) against input backgrounds (`--white` or `--gray-100`) meet AA.
4. Confirm that error text (`--error-text`) on error backgrounds (`--error-bg`) is readable.

Commands / tools to verify locally:

```
# Run local frontend (create-react-app typical):
cd frontend; npm install; npm start

# Run Chrome Lighthouse (or use DevTools > Lighthouse) and inspect 'Accessibility'

# Use axe DevTools to run automated checks on relevant pages
```

## Where changes were applied in this update

- Updated component styles in `frontend/src/components/Auth.css`, `Dashboard.css`, and `App.css` to reference CSS variables instead of hex literals.
- Global variables remain in `frontend/src/index.css`.

## Visual/verification checklist for reviewer

- [ ] Browse Login page — primary buttons use gradient and white text, inputs use primary outline on focus.
- [ ] Browse Dashboard — banners and CTA buttons use primary gradient and neutral text uses `--gray-800/900`.
- [ ] Check Alerts — success, error, info messages use semantic background and text variables.
- [ ] Run Lighthouse/axe on a representative page and confirm no color-contrast violations for critical UI elements.

If you'd like, I can run a pass across more component CSS files and replace remaining hard-coded hex values with variables (low-risk). I can also run an automated accessibility scan and attach the report.
