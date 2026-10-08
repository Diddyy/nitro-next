/**
 * A template text's field size - Flash's `TextField.width` / `height` with the 2px gutters - laid
 * out the way `ThemeText` draws it (`renderFlashTextCanvas` in the element's style), so the rect
 * `layoutTemplate` gives a text is the one its drawing fills.
 */
import { FLASH_TEXT_GUTTER, FlashTextFieldOverrides, HABBO_TEXT_STYLES, parseFlashTextMarkup, renderFlashTextCanvas, resolveFlashTextFormat } from '../font/flash-text';
import { resolveMarkupFace } from '../hooks/useFlashTextCanvas';
import { flashFaceOverride, TextStyleKey, themeDefaultTextStyle } from '../utils';
import type { TemplateElement } from './templateData';
import type { TemplateTextSize } from './templateLayout';

const KNOWN_TEXT_STYLES = new Set(Object.keys(HABBO_TEXT_STYLES));

/** The text style an element draws in: its `text_style`, else its window style's default. */
export const templateTextStyle = (element: TemplateElement): TextStyleKey => {
    const textStyle = element.vars.text_style;

    return typeof textStyle === 'string' && KNOWN_TEXT_STYLES.has(textStyle) ? textStyle as TextStyleKey : themeDefaultTextStyle(element.style);
};

/** A text's `font_size` variable, over its style's size (`TextController.setTextFormatting`); `undefined` when it sets none. */
export const templateFontSize = (element: TemplateElement): number | undefined => {
    const size = Number(element.vars.font_size);

    return element.vars.font_size !== undefined && Number.isFinite(size) && size > 0 ? size : undefined;
};

/** The layout's `font_face` names, as the faces `flashFaceOverride` knows them. */
const FONT_FACES: Readonly<Record<string, string>> = {
    Ubuntu: 'Ubuntu',
    'Ubuntu bold': 'UbuntuBold',
    'Ubuntu condensed': 'UbuntuCondensed',
    UbuntuCondensed: 'UbuntuCondensed',
    Volter: 'Volter',
    'Volter Bold': 'VolterBold',
};

/**
 * Vars that reach the `TextField` even when falsy. `TextController.setTextFormatting` re-applies the
 * style over every recorded property that is falsy, so `sharpness="0"` or `leading="0"` is the
 * style's own value; `setBold` / `setItalic` / `setUnderline` record strings either way, and
 * `setEtchingColor` is guarded by `== null`.
 */
const VAR_COUNTS_WHEN_FALSY = new Set([ 'bold', 'italic', 'underline', 'font_face', 'antialias_type', 'grid_fit_type', 'etching_color', 'etching_position' ]);

/**
 * A text's format vars over its style, as `ThemeText` takes them: `font_face` as `fontFamily`, the
 * rest of `TextController.createPropertySetterTable`'s format vars as `flash` (`bold`, `italic`,
 * `spacing`, `antialias_type`, ...). A label (`TextLabelController`) reads only its style and colour.
 */
export const templateTextFormat = (element: TemplateElement): { fontFamily?: string; flash: FlashTextFieldOverrides } => {
    if (element.tag === 'label') return { flash: {} };

    const vars = element.vars;
    const applies = (key: string): boolean => {
        const value = vars[key];

        if (value === undefined) return false;

        return VAR_COUNTS_WHEN_FALSY.has(key) || (!!value && value !== 'false' && value !== '0');
    };
    const bool = (key: string) => vars[key] === true || vars[key] === 'true';
    const num = (key: string) => Number(vars[key]);
    const str = (key: string) => (typeof vars[key] === 'string' ? vars[key] : undefined);
    const face = applies('font_face') ? str('font_face') : undefined;
    // `setGridFitType` records nothing of its own, so a later `text_style` (re-running
    // `setTextFormatting`) puts an advanced style's grid fit back to `pixel`, unless an
    // `antialias_type` came first. Vars apply in document order.
    const order = Object.keys(vars);
    const at = (key: string) => (order.includes(key) ? order.indexOf(key) : Infinity);
    const gridFitReset = order.includes('text_style')
        && HABBO_TEXT_STYLES[templateTextStyle(element)]?.antiAliasType === 'advanced'
        && at('text_style') > at('grid_fit_type')
        && at('antialias_type') > at('text_style');
    const flash: FlashTextFieldOverrides = {};

    if (applies('bold')) flash.bold = bool('bold');
    if (applies('italic')) flash.italic = bool('italic');
    if (applies('underline')) flash.underline = bool('underline');
    if (applies('spacing')) flash.letterSpacing = num('spacing');
    if (applies('leading')) flash.leading = num('leading');
    if (applies('antialias_type')) flash.antiAliasType = vars.antialias_type === 'normal' ? 'normal' : 'advanced';
    if (applies('grid_fit_type') && !gridFitReset) flash.gridFitType = str('grid_fit_type') as FlashTextFieldOverrides['gridFitType'];
    if (applies('thickness')) flash.thickness = num('thickness');
    if (applies('sharpness')) flash.sharpness = num('sharpness');
    if (applies('kerning')) flash.kerning = bool('kerning');
    if (applies('etching_color')) flash.etchingColor = num('etching_color');
    if (applies('etching_position')) flash.etchingPosition = str('etching_position') as FlashTextFieldOverrides['etchingPosition'];

    return { fontFamily: face ? (FONT_FACES[face] ?? face) : undefined, flash };
};

/** The wrap width `ThemeText` is given for a field `fieldWidth` wide: inside its gutters. */
export const templateWrapWidth = (fieldWidth: number) => Math.max(1, fieldWidth - (FLASH_TEXT_GUTTER * 2));

// Sizes by style, size, wrap and text: a caption measured once is not rasterised again on the next layout.
const MAX_CACHED = 2000;
const cache = new Map<string, TemplateTextSize | undefined>();

/** The texts whose caption is the field's `htmlText` (`FormattedTextController`, `HTMLTextController`), drawn as markup. */
export const isMarkupTemplateText = (element: TemplateElement) => element.tag === 'formatted_text' || element.tag === 'html';

/**
 * The field size of `text` in `element`'s style - parsed as markup for a markup text, or when `markup`
 * says so (a plain text whose code set its `htmlText`); `wrapWidth` is the field's width when it wraps.
 */
export const measureTemplateText = (element: TemplateElement, text: string, wrapWidth: number | undefined, markup: boolean = isMarkupTemplateText(element)): TemplateTextSize | undefined => {
    const style = templateTextStyle(element);
    const fontSize = templateFontSize(element);
    const { fontFamily, flash } = templateTextFormat(element);
    const key = `${markup ? 'markup' : 'plain'}\n${style}\n${fontSize ?? ''}\n${fontFamily ?? ''}\n${JSON.stringify(flash)}\n${wrapWidth ?? ''}\n${text}`;

    if (cache.has(key)) return cache.get(key);

    const format = resolveFlashTextFormat({ style: HABBO_TEXT_STYLES[style], field: flash, face: flashFaceOverride(fontFamily), fontSize });
    const content = markup ? parseFlashTextMarkup(text, format, { resolveFace: resolveMarkupFace }) : text;
    const rendered = content.length ? renderFlashTextCanvas(content, format, wrapWidth === undefined ? {} : { wordWrap: true, wrapWidth: templateWrapWidth(wrapWidth) }) : null;
    const size = rendered ? { width: rendered.width, height: rendered.height, textWidth: rendered.textWidth, textHeight: rendered.textHeight } : undefined;

    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value);

    cache.set(key, size);

    return size;
};
