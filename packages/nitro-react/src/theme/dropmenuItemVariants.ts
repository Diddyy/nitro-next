/**
 * The `dropmenu_item` rows of `habbo_element_description` - each style's item skin states, its
 * `_BTN_TEXT` label margins (`habbo_window_layout_dropmenu_item*`) and text style - and the height
 * Flash gives an item. Kept out of `DropmenuItem.tsx` so the dropmenu can size its list without
 * importing a component module for a function.
 */
import { FLASH_TEXT_GUTTER, FlashTextRenderer, HABBO_TEXT_STYLES, resolveFlashTextFormat } from './font/flash-text';
import { Stretch } from './layer';
import { expandSides, ThemeVariants, ThemeWithStatesVariant } from './utils';
import { TextStyleKey } from './utils/textStyles';

export type DropmenuItemVariant = ThemeWithStatesVariant;

export const DROPMENU_ITEM_VARIANTS: ThemeVariants<DropmenuItemVariant> = {
    0: {
        states: {
            default: Stretch('dropmenuitem-0-default-src'),
            hovering: Stretch('dropmenuitem-0-hovering-src'),
            pressed: Stretch('dropmenuitem-0-selected-src'),
            selected: Stretch('dropmenuitem-0-selected-src'),
        },
        layout: {
            paddingLeft: 4,
            paddingTop: 1,
            paddingRight: 4,
            paddingBottom: 2,
        },
        textStyle: 'regular',
    },
    1: {
        states: {
            default: Stretch('dropmenuitem-1-default-src'),
            hovering: Stretch('dropmenuitem-1-hovering-src'),
            pressed: Stretch('dropmenuitem-1-selected-src'),
            selected: Stretch('dropmenuitem-1-selected-src'),
        },
        layout: {
            paddingLeft: 4,
            paddingTop: 1,
            paddingRight: 4,
            paddingBottom: 2,
        },
        textStyle: 'regular',
        textColor: '#ffffff',
    },
    3: {
        states: {
            default: Stretch('dropmenuitem-0-default-src'),
            hovering: Stretch('dropmenuitem-3-hovering-src'),
            pressed: Stretch('dropmenuitem-3-selected-src'),
            selected: Stretch('dropmenuitem-3-selected-src'),
        },
        layout: {
            paddingLeft: 4,
            paddingTop: 2,
            paddingRight: 4,
            paddingBottom: 4,
        },
        textStyle: 'u_regular',
    },
    100: {
        states: {
            default: Stretch('dropmenuitem-0-default-src'),
            hovering: Stretch('dropmenuitem-3-hovering-src'),
            pressed: Stretch('dropmenuitem-3-selected-src'),
            selected: Stretch('dropmenuitem-3-selected-src'),
        },
        layout: {
            paddingLeft: 4,
            paddingTop: 1,
            paddingRight: 4,
            paddingBottom: 2,
        },
        textStyle: 'il_regular',
    },
};

/** The height an item falls back to while its face's metrics are not in yet. */
const FALLBACK_ITEM_HEIGHT = 19;

/**
 * An item's height as Flash sizes it: the item is its `_BTN_TEXT` label, and
 * `TextLabelController.refresh` makes a label its text field's height plus the margins' top and
 * bottom. The field holds one line of the style - `ascent + descent` - with the `TextField`
 * gutter above and below it. Volter's `regular` in the default
 * item comes to 16, the spacing of Flash's open list.
 */
export const dropmenuItemHeight = (variant: keyof ThemeVariants<DropmenuItemVariant> | undefined, textStyle?: TextStyleKey): number => {
    const config = ((variant !== undefined) ? DROPMENU_ITEM_VARIANTS[variant] : undefined) ?? DROPMENU_ITEM_VARIANTS[0];
    const style = textStyle ?? (config.textStyle) ?? 'regular';
    const metrics = FlashTextRenderer.metrics(resolveFlashTextFormat({ style: HABBO_TEXT_STYLES[style] }));

    if (!metrics) return FALLBACK_ITEM_HEIGHT;

    const margins = expandSides(config.layout) ?? {};

    // `Math.floor(textField.height)`: the field is the line plus its gutters, floored as a whole.
    return Math.floor(metrics.ascent + metrics.descent + (FLASH_TEXT_GUTTER * 2)) + Number(margins.paddingTop ?? 0) + Number(margins.paddingBottom ?? 0);
};
