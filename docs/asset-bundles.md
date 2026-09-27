# Asset bundles

Everything the client draws that is not downloaded from the hotel ships in a `.nitro` bundle -
the same zip archive the room engine already loads furniture, pets and figures from, so there is
one `AssetManager` holding every bitmap and `GetAssetManager().getTexture(<name>)` reaches any of
them from anywhere. `scripts/build-asset-bundles.ts` writes them:

```sh
yarn workspace @nitrodevco/nitro-react build-asset-bundles     # all of them
node scripts/build-asset-bundles.ts theme chat-styles          # or just these
```

| Bundle | Mode | Holds |
|---|---|---|
| `theme` | atlas | `assets/theme` - the skin chrome `THEME_ASSETS` names |
| `chat-styles` | atlas | `assets/chat-styles`, plus every style's `chat_definition.json` merged into one `chat-style-definitions.json` |
| `effect-icons` | atlas | `assets/effect-icons` |
| `nitro-renderer` | atlas | `assets/renderer/**` - the avatar additions and the Variable FX bitmaps, plus the FX icon/renderer tables as `variable-fx-tables.json` |
| `nitro-wired` | atlas | `assets/wired` |
| `nitro-layouts` | loose | every `assets/<component>` layout folder, the catalog's included |
| `fonts` | loose | the captured `*.air51.json` AIR bundles |
| `font-faces` | loose | the `.ttf` faces the browser falls back to |

An **atlas** bundle packs its PNGs into one sheet plus a Pixi `SpritesheetData` manifest
(`<name>.png` + `<name>_spritesheet.json`), which is one GPU upload the per-asset textures share.
A **loose** bundle is one PNG entry per asset, its own texture. `<name>.json` is the asset data
(the collection's name and its assets); every other JSON entry is a table for that bundle's own
consumer, read back with `getBundleFile`, and anything else is bytes (`getBundleBinary`).

Which mode a bundle wants is a measured question, not a rule. Packing shrank `wired` by a quarter
(427 -> 316 KiB) and grew `nitro-layouts` by a third (699 -> 902 KiB): many small homogeneous PNGs
deflate better than one big sheet of mixed art, whose ~7-18% of unused space is real pixels that
still have to encode. Re-measure before flipping a bundle over, and keep the atlas where the win
is the texture count rather than the bytes.

Rules that come out of that:

- **An asset's name is its path under `public/assets`**, extension dropped, `/` and any remaining
  `.` turned into `-`: `room-ui/roomtools_gear.png` -> `room-ui-roomtools_gear`. That makes it
  unique across every bundle by construction, and the build fails on a collision. `LayoutImage`
  builds exactly that name, so a call site still names the file the Flash layout named. The dot
  matters: `GraphicAssetCollection.removeFileExtension` cuts a name at its last dot, which is how
  `border/15-default-shade-0.12.png` and its `0.2` sibling would arrive as one asset.
- **Art the room engine looks up by its bare Flash name keeps that name.** `AvatarVisualization`'s
  additions ask for `avatar_addition_user_typing` and the FX renderers for `variablefx_*`, so the
  folders that group them under `assets/renderer/` are listed in the bundle's `strip` and dropped
  from the name rather than prefixed onto it. A name built at run time (`'avatar_addition_number_'
  + n`) has no folder in front of it either, which `scripts/drift/assets.py` has to allow for.
- **The loose PNGs are build input, not files the client fetches.** They stay under
  `public/assets/<component>/` - the layout generator writes them there, and the drift checks read
  them - but `vite.config.ts`'s `pruneBundledAssets` deletes every one of them from `dist/` after
  the build, by the `absorbed` list in `public/assets/bundles/bundles.json`. There is no url
  fallback behind a bundle any more: a missing asset is a console error, not a slow path.
- **Rebuild after touching anything under `public/assets/**`.** A bundle that is a revision behind
  does not fail; it draws the old art. `bundles.json` records the file behind every asset, the way
  `layout-images.json` does for the layout bitmaps, so the pack is auditable rather than trusted.
- **What is preloaded is `asset.bundles.preload` in `nitro-config.json`**, fetched by
  `preloadAssetBundles()` before the first view renders. `effect-icons` and `font-faces` are
  deliberately out of it: a texture request for one of their assets pulls the bundle in on its own
  (`lazyBundleForAsset` in `utils/assetBundles.ts`), so adding a lazy bundle means adding its name
  prefix there.
- **The builder owns `public/assets/bundles/`.** A full run drops the archives the previous
  `bundles.json` lists and the current table no longer builds, so a renamed bundle does not leave
  its old file behind to be served. A `.nitro` no manifest ever named is left alone.
- **A `ThemeImage`'s `src` is an asset name or a url**, told apart by `isAssetName` - a name has no
  scheme, no `/` and no `.`. Either way it resolves to a `Texture` through the asset manager; a
  bundled bitmap is never fetched by url.
- **A table a bundle carries is the one copy, and it lives beside the art it describes.** Each
  chat style's row is a `chat_definition.json` in its own folder - `{ id, flags, regPoints,
  bitmaps }`, with the folder name as the `assetId`, so that name is written once. The builder
  merges them in id order (which is `chatstyles_xml` order) into `chat-style-definitions.json`
  inside `chat-styles.nitro`, and `ChatStyleLibrary` reads that back; `ChatStyleDefinitions.ts` is
  only the types and the two id predicates. Adding a style is a folder with its bitmaps and its
  row - no TS to edit.
