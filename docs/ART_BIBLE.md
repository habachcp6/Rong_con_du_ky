# Art Bible — Rồng Con Du Ký

## M1 visual contract

Rồng Con Du Ký uses a top-down, 2D pixel-art visual language. Every gameplay tile is **32 × 32 logical pixels**. The internal game camera remains 640 × 360 and must render with nearest-neighbour sampling, `pixelArt: true`, `antialias: false`, and integer-rounded positions. Assets may be scaled only by an integer in game; CSS must never blur a canvas or sprite.

The M1 assets under `public/assets/` are deliberately geometric development placeholders. They are complete enough to load and test the scene contract, but are not licensed tourism photography. Replacing a placeholder requires updating the manifest and source registry, then passing `npm run validate:assets` and `npm run validate:content`.

## Palette and lighting

The working palette has 24 named colours (below the 32-colour cap). New production art should reuse these values before adding a documented exception.

| Group                | Colours                                               |
| -------------------- | ----------------------------------------------------- |
| Outline / UI ink     | `#182433`, `#314158`, `#5A6B7F`, `#F5F0D8`            |
| Ocean blue           | `#0C4A6E`, `#0B6E99`, `#1595C5`, `#61C8E8`, `#C7F4FF` |
| Dragon gold / orange | `#7A3511`, `#B95719`, `#E8891D`, `#FFC94A`, `#FFF1A6` |
| Sơn Trà green        | `#153D2E`, `#24613A`, `#3E8A4F`, `#83B85A`, `#D2DE8A` |
| Sand / stone         | `#6E5140`, `#9A7455`, `#C9A77B`, `#E8D3A3`, `#FAEBC9` |
| Accent / warning     | `#8E294E`, `#D44F65`, `#8D5CB6`, `#C58BE1`            |

Highlights come from the **top-left at about 45°**. Shadows sit down-right, use a hard 1–2 px edge, and must not use a soft blur or a smooth gradient. Dithering is permitted only as intentional, discrete pixels. All pixels that touch an exterior silhouette use the dark outline colours.

## Pixel and UI rules

- No anti-aliasing, blur, fractional transforms, soft gradients, or photographic textures inside the game map.
- Gameplay sprites use a 1–2 px dark outline. Landmark postcards may use a 2 px frame because they are not collision sprites.
- UI frames use wood/stone-inspired pixel borders, but text stays in a legible system sans-serif at a responsive size. Decorative pixel font is never the only readable text.
- Every interaction state needs a non-colour cue: icon, short label, focus ring, or animation. This preserves keyboard and low-vision clarity.
- Do not mix 16 px and 64 px pixel grids, or mix an isometric asset into the top-down map.
- Transparent pixels are part of sprite bounds; assets must not bake a coloured rectangular background merely to look opaque.

## Required asset layouts

| Asset family     | Logical dimensions | Grid / layout                                                                 | Current M1 asset               |
| ---------------- | -----------------: | ----------------------------------------------------------------------------- | ------------------------------ |
| Player           |          128 × 128 | 4 rows × 4 columns, 32 × 32 cells; down, left, right, up; idle/walk/idle/walk | `characters/dragon-boy.svg`    |
| Four NPCs        |       32 × 32 each | Single intentional idle pose; later animation sheets retain 32 × 32 cells     | `characters/*-npc.svg`         |
| Tileset          |          512 × 512 | 16 × 16 cells, 32 × 32 grid                                                   | `tilesets/da-nang-starter.svg` |
| Memory fragments |       32 × 32 each | one icon per landmark                                                         | `fragments/*.svg`              |
| UI icons         |       32 × 32 each | interaction, map, passport, settings, sound                                   | `ui/*.svg`                     |
| Landmark cards   |          320 × 180 | postcard ratio, no collision grid                                             | `landmarks/*.svg`              |

`public/assets/manifest.json` is the machine-readable contract: exact path, dimensions, grid, alpha expectation, ownership, placeholder flag, and attribution ID. It is the only asset inventory that validators use.

## Landmark and attribution policy

- M1 landmark art is original, geometric placeholder art created for development. It intentionally does **not** claim to depict a photographic scene.
- Tourism facts are in `content/locations.vi.json` and `content/locations.en.json`; the source registry is `content/sources.md`.
- No Google Images result, place photo, review, rating, opening hour, or unverified social image may be copied into `public/assets/`.
- Before replacing a landmark placeholder with a real image, record the author, canonical source URL, license/permission, local asset path, and attribution presentation requirement. Obtain the D-004 rights approval before public release.
- If the Standard track later displays a Google Place Photo, it must be fetched ephemerally through the server and its required attribution must be rendered; it must not be added to this local manifest as a persisted image.

## Replacement checklist

1. Preserve the manifest asset ID and update its path, dimensions, grid, and `placeholder` field.
2. Keep dimensions divisible by the declared grid; sprite sheet frames cannot silently change size.
3. Update `content/sources.md` with author, URL, license, and visible-attribution requirement.
4. Validate with `npm run validate:assets` and `npm run validate:content`.
5. Test the asset in Phaser using nearest-neighbour scaling on desktop and mobile.
