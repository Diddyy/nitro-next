# Asset bundles

Everything the client draws that is not downloaded from the hotel ships in a `.nitro` bundle -
the same zip archive the room engine already loads furniture, pets and figures from, so there is
one `AssetManager` holding every bitmap and `GetAssetManager().getTexture(<name>)` reaches any of
them from anywhere. `scripts/build-asset-bundles.ts` writes them:

```sh
yarn workspace @nitrodevco/nitro-react build-asset-bundles     # all of them
node scripts/build-asset-bundles.ts theme effect-icons         # or just these
```

| Bundle | Mode | Holds |
|---|---|---|
| `theme` | atlas | `assets/theme` - the skin chrome `THEME_ASSETS` names |
| `effect-icons` | atlas | `assets/effect-icons` |
| `nitro-wired` | atlas | `assets/wired` |
| `nitro-layouts` | loose | every `assets/<component>` layout folder, the catalog's included |
| `fonts` | loose | the captured `*.air51.json` AIR bundles |
| `font-faces` | loose | the `.ttf` faces the browser falls back to |
| `loading-screen` | loose | `assets/loading-screen` - the loading screen's frame, loaded by name before anything else |
| `loading-screen-photos` | loose | `assets/loading-screen-photos` - the loading screen's photos |
| `sounds` | loose | the `.mp3` sounds under `assets/sounds`, loaded by name the first time one plays |

`chat-styles` and `nitro-renderer` (the avatar additions and the Variable FX bitmaps with their
tables) are not built here: Nitro Studio builds and publishes them from the client release's art
and the hotel's own, and the client loads them from `chat.styles.url` and `renderer.assets.url`
(see [Nitro Studio](nitro-studio.md)). The client ships no copy: with a key unset, that bundle is
not loaded.

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
- **The loose PNGs are build input, not files the client fetches.** They stay under
  `public/assets/<component>/` - the layout generator writes them there, and the drift checks read
  them - but `vite.config.ts`'s `pruneBundledAssets` deletes every one of them from `dist/` after
  the build, by the `absorbed` list in `public/assets/bundles/bundles.json`. There is no url
  fallback behind a bundle any more: a missing asset is a console error, not a slow path.
- **Rebuild after touching anything under `public/assets/**`.** A bundle that is a revision behind
  does not fail; it draws the old art. `bundles.json` records the file behind every asset, the way
  `layout-images.json` does for the layout bitmaps, so the pack is auditable rather than trusted.
- **What is preloaded is `asset.bundles.preload` in `nitro-config.json`**, fetched by
  `preloadAssetBundles()` before the first view renders. `effect-icons` is
  deliberately out of it: a texture request for one of its assets pulls the bundle in on its own
  (`lazyBundleForAsset` in `utils/assetBundles.ts`), so adding a lazy bundle means adding its name
  prefix there. `font-faces` is out of it too; `preloadFlashFonts` starts it in the background.
  `scripts/drift/bundle_loading.py` holds every bundle to one of those ways in (preloaded, a lazy
  prefix every one of its assets carries and no other bundle's does, or loaded by name in code):
  a bundle reached by none of them is art that never draws.
- **The builder owns `public/assets/bundles/`.** A full run drops the archives the previous
  `bundles.json` lists and the current table no longer builds, so a renamed bundle does not leave
  its old file behind to be served. A `.nitro` no manifest ever named is left alone.
- **A `ThemeImage`'s `src` is an asset name or a url**, told apart by `isAssetName` - a name has no
  scheme, no `/` and no `.`. Either way it resolves to a `Texture` through the asset manager; a
  bundled bitmap is never fetched by url.
