---
name: StructureGrid
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15600'
  on-tertiary-container: '#ffe6d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-md-medium:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  data-mono:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-header:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-badge:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system targets commercial construction project managers, estimators, structural engineers, and field operations directors. The interface evokes precision, structural integrity, and executive clarity. It balances the density and immediate utility of classic spreadsheet software like Excel and Airtable with the refined typographic craft of modern engineering software.

The design movement is **Precision Functionalism**: pure optical clarity, rigid grid discipline, zero skeuomorphic distraction, and pure white canvases without yellowed or sepia-tinted undertones. Contrast is purposeful, signaling state transitions, numeric variances, and structural dependencies with mathematical fidelity.

## Colors

The palette establishes an ultra-clean, clinical workspace optimized for prolonged analytical work.

- **Primary (`#0f766e` - Deep Emerald Teal):** Signifies precision, completed calculations, primary actions, and confirmed status. It avoids the generic blue of generic enterprise tools while projecting authority and stability.
- **Secondary (`#0f172a` - Slate 900):** Anchors high-priority data points, primary headings, sheet titles, and core numeric readings.
- **Tertiary (`#d97706` - Amber/Ochre):** Reserved strictly for structural warnings, schedule variances, change order flags, and pending approvals.
- **Neutral Surface Palette:**
  - Base canvas: `#ffffff` (pure white, zero tint)
  - Sub-surface / table header fills: `#f8fafc`
  - Subtle gridlines and borders: `#e2e8f0`
  - Secondary text / column headers: `#64748b`
  - Body data and field entries: `#334155`
  - High-emphasis labels: `#0f172a`

Color application is strictly utilitarian: grid lines remain locked to `#e2e8f0` at 1px thickness; status fills use muted pastel tints (e.g., `#f0fdf4` for active, `#fffbeb` for pending review) paired with their corresponding saturated text tokens.

## Typography

The type scale relies entirely on Inter, leveraging its geometric consistency, tall x-height, and open counters to achieve complete legibility at dense 11px–13px data scales.

- **Data Cells & Numeric Formats:** All numeric columns (quantities, linear footage, cost estimations, tolerances) utilize CSS OpenType tabular figures (`font-feature-settings: 'tnum' 1, 'cv05' 1`) to ensure vertical alignment of decimal points across rows.
- **Column Headers:** Configured in `label-header` at 11px uppercase with `letterSpacing: 0.04em` to distinctly separate structural schema metadata from data payload rows.
- **Hierarchy Rules:** Sheet and view titles top out at 24px (`headline-xl`). Scale increases are purposefully compressed to preserve screen estate for grid visibility.

## Layout & Spacing

The layout employs an edge-to-edge functional framework configured around maximum visual density and instant cell navigation:

- **App Shell Structure:** A fixed 48px global utility toolbar, followed by an adjustable 36px contextual action bar (filters, grouping, view presets, sorting), anchoring directly above a fluid virtualized spreadsheet canvas.
- **Grid Density Rules:**
  - Standard row height: 32px (8px vertical padding, 16px line height).
  - Compact row height (field log / takeoff view): 26px.
  - Column header height: 28px.
  - Inner cell horizontal padding: `space-md` (8px).
- **Responsive Adaptations:**
  - **Desktop (1280px+):** Full multi-pane spreadsheet with pinned columns, frozen header rows, and collapsible right-hand inspection drawer (360px fixed).
  - **Tablet (768px–1279px):** Auto-collapsing sidebars into icon-only rails; grid supports horizontal smooth panning with fixed identifier columns (e.g., Spec Code, Task Name).
  - **Mobile (<768px):** Reflows individual row items into structured card records, locking `margin` to 12px with stacked metric summaries.

## Elevation & Depth

Visual hierarchy does not rely on diffused drop shadows or blurred planes; depth is created using structural lines, boundary clipping, and precise micro-borders.

- **Base Flatness:** The primary grid canvas, pinned column boundaries, and nested sub-rows use zero box-shadow. Visual separation is maintained strictly with 1px borders in `#e2e8f0`.
- **Pinned Columns & Sticky Headers:** Delimited using a 1px solid `#cbd5e1` right-border combined with a micro drop line (`0 1px 2px rgba(15, 23, 42, 0.04)`).
- **Floating Overlays & Popovers:** Dropdowns, formula builders, date pickers, and filter modals employ a crisp outline (`1px solid #cbd5e1`) alongside a controlled, minimal shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Active / Focused Cell Selection:** Signified by a 2px outline in `#0f766e` with an inset `0 0 0 1px #ffffff` highlight ring, preserving absolute clarity without obscuring bordering data cells.

## Shapes

The design uses tight, technical corners (`roundedness: 1`, 0.25rem / 4px) to preserve data alignment and emulate high-precision CAD and professional engineering tools.

- **Spreadsheet Grid Cells:** 0px radius (sharp corners) to form continuous, uninterrupted grid lines.
- **Buttons, Form Controls, and Search Inputs:** 4px radius (`rounded-sm`).
- **Contextual Badges & Phase Tags:** 3px radius to sit comfortably within 32px and 26px row heights without feeling circular or casual.
- **Drawers & Modals:** 6px radius max on floating panels; 0px along edge-docked inspection drawers.

## Components

- **Spreadsheet Data Table:**
  - Header cells: `#f8fafc` background, 1px border `#e2e8f0`, text in `#64748b` uppercase 11px font with interactive sort/filter icons appearing on hover.
  - Alternating/Hover states: Default row `#ffffff`, hover row `#f8fafc`, multi-row selection `#f0fdfa`.
  - Cell editing: Direct inline edit mode with `#ffffff` fill, 2px `#0f766e` border, and automatic cursor retention.

- **Buttons:**
  - Primary: `#0f766e` fill, white text, 4px corner radius, 28px height (compact tool mode) or 32px height (global actions). Hover state: `#115e59`.
  - Secondary/Outline: `#ffffff` fill, 1px `#e2e8f0` border, `#334155` text. Hover state: `#f8fafc` with border `#cbd5e1`.
  - Destructive: `#ef4444` text with `#fee2e2` hover fill.

- **Status & Phase Chips:**
  - Compact 20px height, 3px border radius.
  - Active / On-Schedule: `#f0fdf4` surface, `#15803d` text, 1px border `#bbf7d0`.
  - Delay / RFI Pending: `#fffbeb` surface, `#b45309` text, 1px border `#fde68a`.
  - Critical / Structural Issue: `#fef2f2` surface, `#b91c1c` text, 1px border `#fecaca`.

- **Form Fields & Inputs:**
  - Background `#ffffff`, border 1px `#e2e8f0`, text `#0f172a`. Height 30px.
  - Focus state: Border color `#0f766e`, subtle ring `0 0 0 1px #0f766e`.

- **Checkboxes:**
  - Square 14px size, 2px radius, 1px border `#cbd5e1`. Active checked state: `#0f766e` background with pure white SVG checkmark.

- **Formula & Takeoff Summary Bar:**
  - Fixed horizontal strip pinned above the table footer. `#f8fafc` background with 1px top border `#e2e8f0`. Displays instant calculations: Total Volume, Linear Run, Man-Hours, and Net Budget formatted in tabular monospace digits.