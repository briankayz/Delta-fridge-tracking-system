---
name: Executive Industrial IoT Sentinel
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bfc7d3'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8a919d'
  outline-variant: '#404752'
  surface-tint: '#9ccaff'
  primary: '#9ccaff'
  on-primary: '#003257'
  primary-container: '#2995eb'
  on-primary-container: '#002b4c'
  inverse-primary: '#0062a1'
  secondary: '#e9c349'
  on-secondary: '#3c2f00'
  secondary-container: '#af8d11'
  on-secondary-container: '#342800'
  tertiary: '#ffb781'
  on-tertiary: '#4e2500'
  tertiary-container: '#da7716'
  on-tertiary-container: '#442000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d0e4ff'
  primary-fixed-dim: '#9ccaff'
  on-primary-fixed: '#001d35'
  on-primary-fixed-variant: '#00497b'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb781'
  on-tertiary-fixed: '#2f1400'
  on-tertiary-fixed-variant: '#703800'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  gutter-tablet: 1.25rem
  margin-tablet: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets enterprise field technicians, logistics directors, and asset managers deploying and monitoring critical cold-chain infrastructure. The aesthetic balances rugged industrial precision with high-level executive analytics. The visual direction leverages high-contrast utilitarian minimalism merged with telemetry styling—projecting precision, extreme reliability, and automated intelligence.

Surfaces convey operational readiness through low-noise surfaces, deliberate hierarchy, and deterministic signaling. Visual clutter is stripped away in favor of immediate scanning, calibrated data density, and mission-critical state recognition under variable field lighting conditions.

## Colors

The palette leverages a deep slate base (`#0F172A`) to minimize glare in industrial and field contexts while maximizing contrast for telemetry indicators. Delta Blue (`#0087DC`) drives standard interactions, Bluetooth pairing sequences, and primary operational actions. Warm Gold (`#D4AF37`) functions as an executive accent, highlighting AI anomaly inferences, warranty tiers, and high-value asset flags.

```
Base Canvas:        #0F172A (Deep Slate)
Card & Module:      #1E293B (Layered Surface)
Structural Rule:    #334155 (Subtle Stroke / Dividers)
Signal Primary:     #0087DC (Delta Blue)
Sentinel Accent:    #D4AF37 (Warm Gold)
Telemetry Pass:     #10B981 (Nominal / Synced)
Telemetry Alert:    #F59E0B (Threshold Warning)
Telemetry Fault:    #EF4444 (Critical / Anomaly)
```

Functional status colors are reserved strictly for device states (battery health, signal strength, temperature breaches, telemetry errors) and must never be applied decoratively.

## Typography

The type system relies entirely on Inter for uncompromised legibility on compact touchscreens under bright outdoor glare or dim warehouse lighting. Numeric metrics, temperature telemetry, and MAC addresses utilize tabular numeric features (`tnum`) to eliminate layout jitter during active data streaming.

All telemetry identifiers, hardware IDs, and system status tags use uppercase styling via `label-md` and `label-xs` with expanded tracking to maintain structural clarity.

## Layout & Spacing

Provisioning workflows demand rapid thumb interaction and uninhibited navigation. The layout adopts a 4-column fluid mobile grid with 16px lateral canvas margins, scaling to an 8-column layout on tablets with 20px gutters. 

Primary hardware action zones (such as beacon pairing triggers, manual diagnostic inputs, and sensor calibrations) anchor to the bottom 25% of the viewport to facilitate one-handed operational ergonomics in the field. Critical diagnostics and radar signal indicators occupy the top two-thirds.

## Elevation & Depth

Visual hierarchy uses tonal surface layering combined with low-contrast structural outlines rather than heavy blurred drop shadows. The background sits at `#0F172A`, active cards and data panels rest at `#1E293B`, and elevated modal sheets elevate to `#27354A`.

Every card, chip, and operational container uses a 1px solid stroke (`#334155`). When an IoT beacon enters discovery or pairing mode, the container border transitions to `#0087DC` accompanied by a localized ambient glow: `0 0 12px rgba(0, 135, 220, 0.25)`. Anomaly alerts swap this stroke to `#EF4444` with a corresponding subtle crimson perimeter tint.

## Shapes

The design uses an explicit 8px base corner radius (`roundedness: 2`). This boundary preserves an enterprise instrument feel without appearing brittle or overly sharp. 

Containers, inputs, diagnostic tiles, and buttons maintain an 8px (`0.5rem`) radius. Status badges and metric chips reduce this slightly to 4px (`0.25rem`) to reinforce an integrated hardware-tag feel. Circular shapes are strictly restricted to RSSI signal meters, beacon radar sweeps, and round battery percentage rings.

## Components

### Buttons
- **Primary Beacon Action:** Background `#0087DC`, text `#FFFFFF`, 8px radius, height 48px, label `label-md`. Displays an integrated loading spinner during BLE handshake sequences.
- **Secondary Action:** Transparent background with 1px border in `#334155`, text `#E2E8F0`. On press, surface flashes to `#1E293B`.
- **Destructive/De-provision:** Transparent surface, 1px border `#EF4444`, text `#EF4444`.

### Cards & Telemetry Tiles
- **Sensor Card:** Base background `#1E293B`, 1px border `#334155`, 8px border-radius, 16px internal padding.
- **Header Structure:** Asset Tag / Beacon UUID in `label-xs` muted grey (`#94A3B8`) paired with an RSSI signal glyph on the right.
- **Body Metric:** Primary variable (e.g., `-18.4°C`) rendered in `display-lg` with `tnum`, stacked above threshold ranges (`title-sm`).

### Input Fields
- **Container:** Height 48px, background `#0F172A`, border 1px solid `#334155`, text `#F8FAFC`. Focus ring transitions border to `#0087DC` without offset shadows.
- **Placeholder:** `#64748B`, tracking regular.

### Status Chips & Telemetry Pills
- **Container:** Height 24px, padding 2px 8px, 4px border-radius.
- **Nominal State:** Background `rgba(16, 185, 129, 0.12)`, text `#10B981`, border `1px solid rgba(16, 185, 129, 0.3)`.
- **Threshold Warning:** Background `rgba(245, 158, 11, 0.12)`, text `#F59E0B`, border `1px solid rgba(245, 158, 11, 0.3)`.
- **Critical Anomaly:** Background `rgba(239, 68, 68, 0.12)`, text `#EF4444`, border `1px solid rgba(239, 68, 68, 0.3)`.

### Checkboxes & Radio Selection
- **Box/Ring:** 20px by 20px, surface `#0F172A`, border 1.5px solid `#475569`.
- **Selected State:** Border and inner glyph fill in `#0087DC`.

### Domain-Specific Components
- **Beacon RSSI Proximity Bar:** 4-segment segmented step bar visualizing BLE proximity in real-time, dynamic color shifting from `#64748B` (Out of Range) to `#10B981` (Immediate/Calibrated).
- **AI Anomaly Indicator:** Compact diagnostic ribbon across the upper edge of sensor modules, surfaced in `#D4AF37` text on dark gold tint (`rgba(212, 175, 55, 0.1)`), indicating temperature variance predictions.