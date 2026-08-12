# Mentell Design Guide

## Intent
Mentell should feel like a modern stationery workspace: soft paper surfaces, clean spacing, rounded geometry, restrained accents, and motion that feels friendly without becoming noisy.

This document is the implementation guide for the current UI refresh. It is meant to keep future work visually consistent across routes and features.

## Core UX Principles
- Keep every existing product feature visible and usable, even when the visual shell changes.
- Prefer semantic design tokens over hardcoded colors in feature components.
- Use one shared shell language across all primary routes: desktop sidebar, mobile bottom nav, compact utility header, and softly elevated content cards.
- Let the app feel playful through shape and motion, not through clutter.
- Respect reduced-motion and non-pointer devices with simpler fallbacks.

## Navigation Model

### Desktop
- At `md` and above, show a persistent left sidebar.
- Sidebar order stays: `Envelope`, `Projector`, `Notepad`, `Shoppe`, `Settings`, `Character`.
- The desk companion sits below the sidebar nav, occupying the empty gutter area.

### Mobile
- Below `md`, hide the sidebar and show a fixed bottom nav.
- Keep the header compact and reserve the title-bar area for score, theme toggle, feedback, and the route-aware desk companion.
- Mobile bottom nav should favor icon clarity and touch comfort over text density.

## Color and Surface System

### Base tokens
Use and extend the CSS custom properties in `src/index.css`:
- `--desk-bg`: primary page canvas
- `--paper-bg`: card/surface base
- `--paper-ink`: primary text
- `--paper-ink-muted`: secondary text
- `--paper-border`: low-contrast borders
- `--accent`: decorative highlight / icon accent (swaps to a purchased theme's accent when one is equipped)
- `--primary-action`: key action color
- `--success`, `--warn`, `--danger`: semantic states
- `--link-accent`: footer/inline link color, tuned per theme mode for AA contrast

### Added desk-effect tokens
- `--desk-dot`: repeating dot color
- `--desk-spot-dot`: cursor spotlight tint for dots
- `--spot-x`, `--spot-y`: cursor-following focal point

### Surface rules
- Main content containers should generally use `.paper`.
- Cards should feel slightly tinted rather than flat-white or fully opaque.
- Borders should stay soft and low-contrast.
- Shadows should imply elevation but stay diffused and rounded.

## Background Rules
- The desk background should be layered:
  1. base desk color
  2. optional equipped shop theme overlay
  3. repeating dotted field
  4. cursor-following spotlight that brightens dots only
- The spotlight is decorative and must not alter layout or text readability.
- Disable the animated spotlight for reduced-motion users and coarse pointers.

## Typography
- Keep existing type families:
  - `font-paper` for headings and product personality
  - sans UI fonts for body copy
  - `font-mono` for compact labels, counters, and metadata
- Headings should remain warm and editorial; controls should stay crisp and readable.

## Icons
- Prefer `MaterialIcon` for navigation and general UI actions.
- Keep custom character/brand visuals only where they provide product-specific value.
- Use accent color selectively: active states, highlighted actions, and feature moments.

## Motion Language
- Motion should feel buoyant, soft, and polished.
- Route transitions: gentle fade + small slide + slight scale.
- Modals: fade backdrop, soft pop/float on entry, restrained exit.
- Hover states: subtle lift and shadow, never aggressive bounce.
- Respect `useMotionPrefs` and reduce all nonessential movement when motion is disabled.

## Card and Control Rules
- Use large rounded corners for primary containers.
- Group related data inside nested rounded sections rather than crowded inline rows.
- Buttons should read as tactile but simple:
  - primary actions use `--primary-action`
  - destructive actions use `--danger`
  - secondary actions rely on border + tint
- Inputs should stay calm and minimal, with focus states driven by `focus-ring`.

## Shoppe Preview Rules
- Theme previews should use solid color blocks, not blended gradients.
- Show the desk color first, then imply the paper surface with an angled card/paper tile and shadow.
- Light/dark behavior can be summarized through labels and swatches instead of split gradients.

## Character Companion Rules
- The desk companion is part of the shell, not a floating afterthought.
- On desktop it belongs in the sidebar gutter under navigation.
- On mobile it belongs near the title/utility header area.
- The character should stay route-aware and use current saved appearance/accessories.

## Implementation Notes
- Prefer shared shell components under `src/components/shell/` for navigation/background/chrome.
- Keep route pages focused on content, not shell concerns.
- New visual styling should remain compatible with shop theme overrides in `src/features/shop/shopCosmetics.tsx`.
- When adding new tokens, name them by purpose rather than by raw color.
