# ResumeRocket Branding

This app uses a simple brand system centered around a primary indigo/blue palette and a crisp SVG logo for sharp rendering at all sizes.

## Logo Assets

- public/logo.svg — Primary vector logo (scales cleanly at all DPIs)
- public/logo.png — Raster fallback (transparent background)
- public/logo192.png, public/logo512.png — PWA icons referenced by manifest.json
- Favicon: public/logo.png (declared in public/index.html)

The NavBar and Dashboard headers render the logo and brand name side-by-side.

## Brand Colors

Color tokens are defined in `src/index.css` (CSS variables):

- --primary-color: #667eea (indigo)
- --primary-dark: #5a67d8
- --primary-light: #7c8ff0
- Accent tokens: --accent-green, --accent-blue, --accent-purple

Feel free to adjust these to better match the ResumeRocket palette:

- Suggested alternatives:
  - --primary-color: #2563eb
  - --primary-dark: #1e40af
  - --primary-light: #60a5fa

## Usage

- Navigation background uses `var(--primary-color)`.
- Links and emphasis states leverage the primary tokens.
- Loading spinner inherits `var(--primary-color)` to present a branded indicator.

## Loading States

Branded spinner component: `src/components/LoadingSpinner.js` with styles in `src/components/LoadingSpinner.css`.

- PrivateRoute, Dashboard, and upload buttons reference this spinner.
- For skeletons (e.g., Profile form), keep neutral surfaces; optional accent borders can use `--muted-border`.

## Accessibility

- Maintain sufficient contrast (WCAG AA) for text on `--primary-color` backgrounds; use `--on-primary` (#ffffff) for nav text.
- All logos include descriptive `alt` text.

