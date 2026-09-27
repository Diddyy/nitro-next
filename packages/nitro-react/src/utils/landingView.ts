/**
 * The landing view's configuration, read the way `HabboLandingView` and its widgets read the
 * hotel's variables - pure functions over `configString` (see `configReader`):
 *
 * - `landingViewCommonSettings`: `CommonWidgetSettings`, the text colour, etching colour and
 *   etching position every `COLORABLE` text of a widget takes. A value equal to Flash's default
 *   counts as unset, as `isTextColorSet` & co. test it.
 * - `landingViewPaneWidths`: `dynamicLayoutLeftPaneWidth` / `RightPaneWidth`.
 * - `parseLandingViewElements`: a `GenericWidget` `conf` - `type,arg,arg;type,...` - one element per
 *   entry, `args[0]` the type, as `configureContentColumn` splits it.
 * - `parseGenericWidgetLayout`: `GenericWidget.configureLayout` - the bitmap, the content column's
 *   place and the container's width and least height.
 */

/** `CommonWidgetSettings`' defaults - a value equal to one is "not set". */
const TEXTCOLOR_DEFAULT = 0xFF000000;
const ETCHINGCOLOR_DEFAULT = 0xFFFFFFFF;
const ETCHINGPOSITION_DEFAULT = 'bottom';

/** `HabboLandingView.dynamicLayoutLeftPaneWidth` / `RightPaneWidth`'s defaults. */
const LEFT_PANE_WIDTH_DEFAULT = 500;
const RIGHT_PANE_WIDTH_DEFAULT = 250;

/** `generic_widget`'s `bitmap` window and `content_container` as the layout places them. */
const GENERIC_BITMAP_X = 10;
const GENERIC_BITMAP_Y = 10;
const GENERIC_CONTENT_WIDTH = 250;

/** `configureLayout`: the content column of a wide slot starts right of the picture. */
const GENERIC_WIDE_CONTENT_X = 230;

type ConfigString = (key: string) => string;

export interface LandingViewCommonSettings {
    textColor?: number;
    etchingColor?: number;
    etchingPosition?: string;
}

export const landingViewCommonSettings = (configString: ConfigString): LandingViewCommonSettings => {
    const settings: LandingViewCommonSettings = {};
    const textColor = configString('landing.view.common.textcolor');
    const etchingColor = configString('landing.view.common.etchingcolor');
    const etchingPosition = configString('landing.view.common.etchingposition');

    if (textColor !== '') {
        const value = parseInt(textColor, 16);

        if (value !== TEXTCOLOR_DEFAULT) settings.textColor = value;
    }

    if (etchingColor !== '') {
        const value = parseInt(etchingColor, 16);

        if (value !== ETCHINGCOLOR_DEFAULT) settings.etchingColor = value;
    }

    if ((etchingPosition !== '') && (etchingPosition !== ETCHINGPOSITION_DEFAULT)) settings.etchingPosition = etchingPosition;

    return settings;
};

/** `getInteger(key, default)`: a key that is not a number is the default. */
const configInteger = (configString: ConfigString, key: string, defaultValue: number) => {
    const value = parseInt(configString(key));

    return Number.isNaN(value) ? defaultValue : value;
};

export const landingViewPaneWidths = (configString: ConfigString) => ({
    left: configInteger(configString, 'landing.view.dynamic.leftPaneWidth', LEFT_PANE_WIDTH_DEFAULT),
    right: configInteger(configString, 'landing.view.dynamic.rightPaneWidth', RIGHT_PANE_WIDTH_DEFAULT),
});

/** `GenericWidget.isWideSlot`: every slot but the two in the right column. */
export const isWideLandingViewSlot = (slot: number) => (slot !== 3) && (slot !== 5);

export interface LandingViewElement {
    type: string;
    /** The whole entry, the type first - element handlers index it as Flash's `param3` does. */
    args: string[];
}

export const parseLandingViewElements = (conf: string): LandingViewElement[] => {
    if (conf === '') return [];

    return conf.split(';').map((entry) => {
        const args = entry.split(',');

        return { type: args[0], args };
    });
};

export interface GenericWidgetLayout {
    bitmapUri: string;
    bitmapX: number;
    bitmapY: number;
    bitmapWidth?: number;
    bitmapHeight?: number;
    contentX: number;
    contentY: number;
    contentWidth: number;
    width: number;
    /** `container.height`: the container is at least this high, and taller when its content is. */
    minHeight: number;
}

export const parseGenericWidgetLayout = (layout: string, slot: number, paneWidths: { left: number; right: number }): GenericWidgetLayout => {
    const wide = isWideLandingViewSlot(slot);
    const result: GenericWidgetLayout = {
        bitmapUri: '',
        bitmapX: GENERIC_BITMAP_X,
        bitmapY: GENERIC_BITMAP_Y,
        contentX: wide ? GENERIC_WIDE_CONTENT_X : 0,
        contentY: 0,
        contentWidth: GENERIC_CONTENT_WIDTH,
        width: wide ? paneWidths.left : paneWidths.right,
        minHeight: 0,
    };

    for (const entry of layout.split(';')) {
        const [ key, value ] = entry.split(',');

        switch (key) {
            case 'bitmap.uri': result.bitmapUri = value; break;
            case 'bitmap.width': result.bitmapWidth = parseInt(value); break;
            case 'bitmap.height': result.bitmapHeight = parseInt(value); break;
            case 'bitmap.x': result.bitmapX = parseInt(value); break;
            case 'bitmap.y': result.bitmapY = parseInt(value); break;
            case 'content.x': result.contentX = parseInt(value); break;
            case 'content.y': result.contentY = parseInt(value); break;
            case 'content.width': result.contentWidth = parseInt(value); break;
            case 'container.height': result.minHeight = Math.max(parseInt(value), result.minHeight); break;
        }
    }

    return result;
};
