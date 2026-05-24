# Character customization and animation iteration

This guide covers how to iterate on the desk character system quickly.

## Source files

- Body SVG source: `asset/char/charprod.svg`
- Headshot / icon SVG source: `asset/char/headshot.svg`
- Generated manifest: `src/features/character/charManifest.generated.ts`
- Manifest generator: `scripts/generate-char-manifest.mjs`

## Adding clothing / visual options

Character options are discovered from Inkscape labels in `charprod.svg`.

- Fill targets: label with `_III`
- Toggle groups: label with `_TOGGLE`
- Global fill groups: toggle-layer labels that also include `_III`
- Excluded shapes: label with `_DNI`

After SVG edits, regenerate metadata:

1. `node scripts/generate-char-manifest.mjs`
2. Confirm `charManifest.generated.ts` changed as expected
3. Verify Character Lab controls in `/character-lab`

The control order/labels for Character Lab live in `src/features/character/charLabControls.ts`.

## Arm animation tuning

- Pose targets: `src/features/character/characterPoses.ts`
- Motion interpolation and pivots: `src/features/character/useArmPoseAnimation.ts`
- Runtime SVG composition / layer promotion: `src/features/character/MentellCharacter.tsx`

If arm layers ever slip behind torso/hair after SVG reorder changes, keep `promoteAnimatedArmLayers()` in sync with your new arm/sleeve IDs.

## Icon framing

- Browser tab icon sync: `src/features/character/CharacterTabIconSync.tsx`

`FAVICON_HEAD_VIEWBOX` controls icon crop. Update it whenever `headshot.svg` layout changes, then verify hair toggles do not shift icon centering.

## Recommended validation flow

1. `npm run build:check`
2. `npm run lint`
3. Manual browser checks:
   - `/character-lab` hair/clothing toggles and pose animation
   - top-nav Character icon alignment
   - browser tab icon updates while changing hair
