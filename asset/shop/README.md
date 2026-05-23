# Shoppe item catalog format

`shoppe-items.json` defines purchasable items for the in-app Shoppe.

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
- `preview` (optional string, usually `/asset/...`)

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

### `stamp`

```json
{
  "type": "stamp",
  "stamp": {
    "text": "Gotcha",
    "ink": "#...",
    "outline": "#...",
    "textColor": "#...",
    "tiltDeg": -14,
    "opacity": 0.24
  }
}
```

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

### `image`

```json
{
  "type": "image",
  "image": {
    "url": "/asset/..."
  }
}
```
