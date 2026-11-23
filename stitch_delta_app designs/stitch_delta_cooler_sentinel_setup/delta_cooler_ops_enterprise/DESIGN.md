---
name: Delta Cooler Ops Enterprise
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#42474d'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#72787e'
  outline-variant: '#c2c7ce'
  surface-tint: '#396283'
  primary: '#154363'
  on-primary: '#ffffff'
  primary-container: '#315b7c'
  on-primary-container: '#a9d2f9'
  inverse-primary: '#a2cbf1'
  secondary: '#0062a1'
  on-secondary: '#ffffff'
  secondary-container: '#47a8ff'
  on-secondary-container: '#003c65'
  tertiary: '#735c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cca830'
  on-tertiary-container: '#4f3e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#a2cbf1'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#1e4a6a'
  secondary-fixed: '#d0e4ff'
  secondary-fixed-dim: '#9ccaff'
  on-secondary-fixed: '#001d35'
  on-secondary-fixed-variant: '#00497b'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an executive, mission-critical operations cockpit for managing commercial beverage cooler fleets across global territories. The brand personality conveys total institutional reliability, clinical operational clarity, and executive oversight. The UI evokes confidence, control, and precision for enterprise fleet managers, field engineers, and executive directors who monitor asset telemetry, temperature compliance, and maintenance lifecycles in real time.

The aesthetic follows an **Executive Corporate Modern** framework:
- **Pristine Canvas Clarity:** Light mode only, engineered with uncompromising visual hygiene to maintain cognitive stamina during sustained analytical review.
- **Architectural Hierarchy:** Strict elevation tiers, crisp 1px structural framing, and deliberate data grouping ensure mission-critical telemetry (power failure, temperature spikes, compliance dips) surfaces instantly above baseline asset metrics.
- **Operational Polish:** Functional micro-details, low-noise typography, and refined status badging reflect high-value physical infrastructure management.

## Colors

The color architecture is built exclusively for high-clarity daylight visibility, with strict functional separation between operational status, brand authority, and analytical telemetry.

### Core Swatches
- **Primary Navy Blue (`#315B7C`):** Institutional anchor used for navigation surfaces, structural brand headers, primary control triggers, and active container selection.
- **Secondary Delta Cyan (`#0087DC`):** High-engagement interactive indicator applied to action buttons, focus halos, live data links, active tab underlines, and real-time connectivity beacons.
- **Warm Gold Accent (`#D4AF37`):** Reserved for executive insights, certified audit badges, premium tier filtering, and KPI targets.
- **Surface Canvas (`#F8FAFC`):** Universal application background; eliminates optical strain while offering high contrast against white card modules.
- **Surface Elevation Cards (`#FFFFFF`):** Pure white container surfaces for all modular widgets, metric cards, and operational tables.
- **Structural Border (`#E2E8F0`):** Subtle defining boundary line separating panels, data cells, and header toolbars.
- **Text Primary (`#0F172A`):** Deep slate providing high readability for core numerical figures, labels, and table values.
- **Text Secondary (`#64748B`):** Muted cool slate for unit labels, timestamps, metadata, and inactive icons.

### Status & Telemetry Indicators
- **Compliant (`#10B981`):** Optimal refrigeration range, live connectivity, scheduled service verified.
- **Warning (`#F59E0B`):** Temperature drift, defrost delay, door-open alert, inspection due within 48h.
- **Critical Risk (`#EF4444`):** Compressor failure, food safety temperature breach, power cut, lost telemetry.

## Typography

The design system implements **Inter** across all UI tiers to achieve clean, systematic clarity and reliable tabular data alignment across dense enterprise matrices.

- **Tabular Figures:** All tabular and telemetry readouts (temperatures, uptime percentages, asset IDs) must enforce OpenType `tnum` (tabular lining numbers) to eliminate horizontal jitter during live streaming updates.
- **Metric Scaling:** KPI figures utilize `data-metric` paired with adjacent `label-sm` uppercase unit tags (e.g., `°C`, `kWh`, `%`).
- **Hierarchy Rhythm:** Page headers lean on `display-lg` (`display-lg-mobile` on mobile viewports) with negative letter-spacing for tight executive presence, while data tables default strictly to `body-md` and `body-sm` to maintain dense information displays.

## Layout & Spacing

The layout model is governed by a **12-column fluid enterprise grid** designed for dense multi-metric dashboards and data tables, adapting gracefully down to dedicated field viewports.

### Grid & Breakpoints
- **Desktop (1280px and above):** 12-column grid, `margin: 2rem`, `gutter: 1.5rem`. Maximum canvas container capped at `1600px` for ultra-wide command monitors. Left navigation rail is fixed at `260px`.
- **Tablet / Laptop (768px – 1279px):** 8-column layout, `margin: 1.5rem`, `gutter: 1rem`. Side navigation collapses into an icon-only rail (`72px`).
- **Mobile Handheld (< 768px):** 4-column layout, `margin: 1rem`, `gutter: 1rem`. Navigation transitions to a bottom bar or slide-over drawer for field technicians checking unit serial numbers on-site.

### Internal Component Spacing
- Micro padding within status badges, table cells, and form controls strictly adheres to the 4px baseline (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 32px).
- Density across operational tables uses `0.75rem` vertical cell padding to optimize row capacity per screen height.

## Elevation & Depth

This system avoids dark ambient layering and instead pairs high-definition surface borders (`#E2E8F0`) with crisp, low-opacity, blue-tinted micro-shadows.

### Elevation Levels
- **Level 0 (Canvas Base):** Plain `#F8FAFC` background without shadow.
- **Level 1 (Surface Cards & Panels):** Pure white (`#FFFFFF`) interior with a 1px solid border (`#E2E8F0`) and subtle floor shadow:
  `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03);`
- **Level 2 (Hover States & Flyouts):** Used for interactive card states, elevated table rows on hover, and active filter panels:
  `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04);`
- **Level 3 (Dropdown Menus, Popovers, & Drawers):** Contextual telemetry drill-downs and action menus:
  `box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03);`
- **Level 4 (Modal Overlays & System Alerts):** Emergency diagnostic alerts and cooler dispatch modals, anchored against a high-contrast `#0F172A` backdrop scrim at 40% opacity:
  `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04);`

## Shapes

The interface embraces a disciplined **0.5rem (8px) base corner radius** to reinforce a balanced, high-precision engineering tone. 

- **Default Elements (`rounded` / 8px):** Cards, primary buttons, input fields, select dropdowns, search bars, and dialog modals.
- **Compact Badges (`rounded-sm` / 4px):** Status chips, tabular pill counters, temperature tags, and icon containers.
- **Pill Formats (`rounded-full`):** Reserved exclusively for live status indicator dots (e.g., flashing green telemetry dot), avatar profiles, and quick filter toggle pills.

## Components

### Buttons
- **Primary:** Solid `#315B7C` background, white label, 8px radius, `0.5rem 1rem` padding. Hover: `#24455E`. Focus: ring with 2px offset in `#0087DC`.
- **Secondary / Action:** Solid `#0087DC` background, white label. Used for dispatching technicians or clearing warnings. Hover: `#0073BC`.
- **Outline / Ghost:** Transparent background, 1px solid border `#E2E8F0`, text `#0F172A`. Hover: `#F1F5F9`.

### Telemetry Status Chips
- Height: 24px, 4px corner radius, bold 11px uppercase type.
- **Compliant:** Background `#ECFDF5`, border `#A7F3D0`, text `#065F46`, paired with an optional 6px solid `#10B981` dot.
- **Warning:** Background `#FFFBEB`, border `#FDE68A`, text `#92400E`, with `#F59E0B` icon.
- **Critical Risk:** Background `#FEF2F2`, border `#FECACA`, text `#991B1B`, with `#EF4444` icon.

### Form Inputs & Search Fields
- Crisp `#FFFFFF` surface, 1px solid `#E2E8F0` border, 8px radius, 36px/40px standard heights.
- Placeholder text in `#64748B`. Active focus state drops border color and applies a `2px solid #0087DC` outer glow with zero canvas shift.

### Metric Cards (KPI Displays)
- Pure `#FFFFFF` background with 1px `#E2E8F0` border and Level 1 elevation.
- Structure: Header row containing title (`label-md` in `#64748B`) and status badge or icon; middle section displaying numerical metric (`data-metric` in `#0F172A`); footer row displaying trend comparisons (e.g., `+1.4°C vs 24h avg` in `#EF4444`).

### Data Tables (Cooler Fleet Matrix)
- Header: `#F8FAFC` background with subtle bottom border (`1px solid #E2E8F0`), uppercase `#64748B` typography at `11px` with sort arrows.
- Rows: `#FFFFFF` background, hover state `#F8FAFC`, transition time 150ms.
- Cell density: `12px 16px` padding. Telemetry cells format numeric temperature readings with inline warning indicators for rapid row scanning.

### Checkboxes & Radios
- Crisp 16px boxes with 4px radius (checkbox) or circular (radio), `#E2E8F0` inactive border.
- Checked state: Solid `#315B7C` with crisp white checkmark / center dot.