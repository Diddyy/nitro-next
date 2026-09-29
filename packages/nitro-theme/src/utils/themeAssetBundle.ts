import { GetAssetManager } from '@nitrodevco/nitro-renderer';
import { SpritesheetData } from 'pixi.js';

import { registerThemeTexture } from '../hooks/usePixiTexture';
import { themeHost } from '../host';
import { registerThemeVariants, themeTextureAliases, ThemeVariantsData } from './themeRegistry';
import { registerThemeAtlas, themeTextureKeys } from './themeSprites';

/**
 * Loads the `theme` asset bundle and hands its contents to the registries the chrome reads, once at
 * boot, on both render targets.
 *
 * Nitro Studio builds the bundle from the client release (`server/theme/clientTheme.ts` there): the
 * sprites the theme draws packed into one sheet plus a Pixi `SpritesheetData` manifest, and
 * `theme-variants.json` - every variant, the cascade and the icon set (`themeRegistry.ts`).
 * `AssetManager` has already made the sheet one GPU upload and cut a `Texture` per sprite out of it
 * by the time this runs. What is left is naming them the way the theme does - a sprite `theme-<x>` is
 * the texture key `<x>-src`, and the file's `textures` name the keys drawn from another sprite:
 *
 * - the variants: into `themeRegistry`, which every theme component reads its variant from;
 * - Pixi: each sprite's `Texture` goes into `usePixiTexture`'s cache under its theme key, so a
 *   lookup during render is a synchronous `Map` read and no component ever builds a texture.
 * - DOM: `themeSprites.ts` gets the decoded sheet, its rects and a `blob:` URL of its bytes.
 *   Chrome then references that one URL (`background-position`/`-size` picks the rect), and the
 *   few places needing a standalone image (`border-image`, `background-repeat`, a tinted copy)
 *   slice it out of the decoded sheet on demand, once per key.
 *
 * There is no fallback behind this: the client ships no theme of its own, and the hotel serves the
 * bundle from `ui.theme.url` (`assetBundleUrl`). If the bundle fails, the chrome is missing and the
 * error is on the console - which is the intent, an asset silently taking the slow path is how a
 * regression hides.
 */
const BUNDLE_NAME = 'theme';

/** `theme-variants.json`, by the name `getBundleFile` knows a bundle's JSON by. */
const THEME_VARIANTS_FILE = 'theme-variants';

export const preloadThemeAssets = async (): Promise<void> => {
    if (!await themeHost().loadAssetBundle(BUNDLE_NAME)) return;

    const assetManager = GetAssetManager();
    const manifest = assetManager.getBundleFile<SpritesheetData>(BUNDLE_NAME, `${BUNDLE_NAME}_spritesheet`);
    // `processNitroBundle` registers the sheet itself under the manifest's own name.
    const sheet = assetManager.getTexture(`${BUNDLE_NAME}_spritesheet`);

    const variants = assetManager.getBundleFile<ThemeVariantsData>(BUNDLE_NAME, THEME_VARIANTS_FILE);

    if (!manifest?.frames || !sheet) return;

    if (variants) registerThemeVariants(variants);

    for (const [ key, asset ] of themeTextureKeys(Object.keys(manifest.frames), themeTextureAliases())) {
        const texture = assetManager.getTexture(asset);

        if (texture) registerThemeTexture(key, texture);
    }

    // The `ImageBitmap` the bundle decoded to: a `CanvasImageSource`, which is all a slice needs.
    const image: CanvasImageSource | undefined = sheet.source.resource;

    if (!image) return;

    registerThemeAtlas({ image, width: sheet.source.width, height: sheet.source.height }, manifest.frames, themeTextureAliases());

    // The rects are in `themeSprites` now; the manifest they were read out of is not needed again.
    assetManager.releaseBundleData(BUNDLE_NAME);
};
