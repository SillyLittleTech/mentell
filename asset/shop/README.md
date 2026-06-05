# Shoppe item catalog format

`shoppe-items.json` defines purchasable items for the in-app Shoppe.

Default cosmetics are **not** stored in this catalog:

- Default stamp artwork comes from `asset/shop/stamp.svg`.
- Default cursor artwork comes from `asset/shop/pointer.svg`.

Keep those defaults out of `shoppe-items.json` so unlockable items stay additive.

## Root format

- `version` (number): schema version.
- `items` (array): list of shop item objects.

## Shared item fields

Each item includes:

- `id` (string, unique)
- `type` (`image` | `theme` | `stamp` | `cursor`)
- `name` (string)
- `description` (string)
- `cost` (number, points)
- `preview` (optional string, usually `/asset/...`, currently used by `image` items)

## Item-specific fields

### `theme`

```json
{
  "type": "theme",
  "theme": {
    "light": {
      "deskBg": "#...",
      "paperBg": "#...",
      "paperBorder": "rgba(...)",
      "accent": "#...",
      "overlay": "radial-gradient(...)"
    },
    "dark": {
      "deskBg": "#...",
      "paperBg": "#...",
      "paperBorder": "rgba(...)",
      "accent": "#...",
      "overlay": "radial-gradient(...)"
    }
  }
}
```

Theme preview cards are generated from the four desk/paper colors (`light` + `dark`) and do not depend on `preview` images.

### `stamp`

```json
{
  "type": "stamp",
  "stamp": {
    "text": "Airmail",
    "ink": "#...",
    "outline": "#...",
    "textColor": "#...",
    "tiltDeg": -14,
    "opacity": 0.24
  }
}
```

Stamp previews and submit-animation stamps are generated from these fields. Keep `text` short (recommended <= 12 chars) for best fit.

### `cursor`

```json
{
  "type": "cursor",
  "cursor": {
    "primary": "#...",
    "secondary": "#...",
    "outline": "#...",
    "textPrimary": "#...",
    "hotspot": {
      "default": [3, 3],
      "pointer": [4, 2],
      "text": [8, 14]
    }
  }
}
```

Cursor preview cards render a live hover box by generating `default`, `pointer`, and `text` cursors from `asset/shop/pointer.svg`.

### `image`

```json
{
  "type": "image",
  "image": {
    "url": "/asset/..."
  }
}
```

## Asset contracts

### `asset/shop/pointer.svg`

- Preferred: groups with `data-context="default|pointer|text"`.
- Supported fallback: per-shape `inkscape:label` hints containing `point` / `pointer` / `text`.
- Optional color hooks:
  - `data-fill="primary|secondary|outline|text"`
  - `data-stroke="primary|outline"`

### `asset/shop/stamp.svg`

- Used directly as the default non-shop stamp artwork.
- Unlockable stamp items are generated from catalog values (`stamp.text`, `ink`, `outline`, etc.).

## Iteration checklist

1. Edit `shoppe-items.json` (add/remove/update items).
2. If changing default art, edit `asset/shop/stamp.svg` and/or `asset/shop/pointer.svg`.
3. Run `npm run build:check` to verify parsing/rendering.
4. Verify `/shop` preview cards and submit animation manually in the browser.
