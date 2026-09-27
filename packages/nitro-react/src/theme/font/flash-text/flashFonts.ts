/**
 * The client's embedded font faces, and the two bundles they arrive in.
 *
 * `fonts.nitro` holds the captured AIR bundles: the outline AIR rendered for every glyph next to
 * the SWF font's advances and kerning, which `theme/font/flash-text` draws from. Nothing can be
 * drawn without them, so they are in the boot preload and `preloadFlashFonts` awaits them.
 *
 * `font-faces.nitro` holds the `.ttf` faces the browser falls back to for a string the exact
 * renderer cannot take (anything outside printable ASCII, or a raw `fontFamily` override). Those
 * are registered with `document.fonts` from the bundle's own bytes, and deliberately not awaited: at ~1.3MB they are far too much to hold up the first
 * frame, and the browser used to fetch them off `@font-face` on first use anyway.
 */
import { NitroLogger } from '@nitrodevco/nitro-api';
import { GetAssetManager } from '@nitrodevco/nitro-renderer';

import { loadAssetBundle } from '#base/utils';

import { NativeFontBundle } from './air32/types';
import { FLASH_FONT_FACES } from './flashFontFaces';
import { registerNativeFontBundle } from './FlashTextRenderer';

/** A `.ttf` face as `document.fonts` needs it declared. */
interface BrowserFontFace {
    family: string;
    file: string;
    weight?: string;
    style?: string;
}

const FONT_BUNDLE = 'fonts';
const FACE_BUNDLE = 'font-faces';

/**
 * The four Flash families with their weights and styles, plus the single-face aliases
 * `TEXT_STYLES` names for Pixi's canvas text.
 */
const BROWSER_FONT_FACES: readonly BrowserFontFace[] = [
    { family: 'Ubuntu', file: 'Ubuntu-R.ttf', weight: '400', style: 'normal' },
    { family: 'Ubuntu', file: 'Ubuntu-B.ttf', weight: '700', style: 'normal' },
    { family: 'Ubuntu', file: 'Ubuntu-I.ttf', weight: '400', style: 'italic' },
    { family: 'Ubuntu', file: 'Ubuntu-BI.ttf', weight: '700', style: 'italic' },
    { family: 'UbuntuCondensed', file: 'Ubuntu-C.ttf' },
    { family: 'Volter', file: 'Volter.ttf', weight: '400' },
    { family: 'Volter', file: 'Volter-Bold.ttf', weight: '700' },
    { family: 'Volter Bold', file: 'Volter-Bold.ttf' },
    { family: 'UbuntuBold', file: 'Ubuntu-B.ttf' },
    { family: 'UbuntuBoldItalics', file: 'Ubuntu-BI.ttf' },
    { family: 'UbuntuItalics', file: 'Ubuntu-I.ttf' },
    { family: 'VolterBold', file: 'Volter-Bold.ttf' },
];

let preloadPromise: Promise<void> | undefined;

/**
 * Adds every `.ttf` face to `document.fonts` from the bundle's bytes. Started by
 * `preloadFlashFonts` and not awaited by it - until it resolves, a string the exact renderer
 * cannot take draws in the browser's default face, exactly as it did before the first
 * `@font-face` fetch finished.
 */
const registerBrowserFonts = async (): Promise<void> => {
    if (!await loadAssetBundle(FACE_BUNDLE)) {
        NitroLogger.error(`Font faces failed to load: ${FACE_BUNDLE}`);

        return;
    }

    const assetManager = GetAssetManager();

    await Promise.all(BROWSER_FONT_FACES.map(async ({ family, file, weight, style }) => {
        const bytes = assetManager.getBundleBinary(FACE_BUNDLE, file);

        if (!bytes) return;

        try {
            document.fonts.add(await new FontFace(family, bytes, { weight, style }).load());
        } catch (err) {
            NitroLogger.error(`Failed to register font face ${family} (${file})`, err);
        }
    }));

    // `FontFace` has parsed the faces; the ~1.3 MB of `.ttf` bytes behind them are dead weight.
    assetManager.releaseBundleData(FACE_BUNDLE);
};

/**
 * Loads the captured bundles and registers every face once. Awaited at boot, before the first
 * view renders, so no text ever has to fall back to the browser's own rendering for want of a
 * font.
 */
export const preloadFlashFonts = (): Promise<void> => {
    preloadPromise ??= (async () => {
        // The browser faces are only a fallback - started here, never waited on. See the module docblock.
        void registerBrowserFonts();

        if (!await loadAssetBundle(FONT_BUNDLE)) {
            NitroLogger.error(`Font bundle failed to load: ${FONT_BUNDLE}`);

            return;
        }

        for (const face of FLASH_FONT_FACES) {
            const bundle = GetAssetManager().getBundleFile<NativeFontBundle>(FONT_BUNDLE, face.bundle);

            if (bundle) registerNativeFontBundle(face.family, face.weight, face.style, bundle);
            else NitroLogger.error(`Missing font bundle in ${FONT_BUNDLE}.nitro: ${face.bundle}`);
        }

        // The renderer holds the bundles it registered; this only drops the asset manager's map.
        GetAssetManager().releaseBundleData(FONT_BUNDLE);
    })();

    return preloadPromise;
};
