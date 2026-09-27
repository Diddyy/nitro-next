/**
 * The reception's widget configuration, read from the hotel's `landing.view.*` variables the way
 * `WidgetContainerLayout.registerDynamicWidgets`, `WidgetContainerWidget.createWidgetContainer`
 * and `GenericWidget.configureContentColumn` / `configureLayout` read them. Pure functions of the
 * config, shared by the reception's packet handler (what each widget asks the server for) and its
 * views (what each widget draws).
 */
import type { ColorableTextFormat } from '#base/theme';

import { hotelViewProperty } from './HotelViewSlice';

/** `LandingViewWidgetType`: the widget names a slot's `.widget` variable can carry. */
export const LandingViewWidgetType = {
    AVATARIMAGE: 'avatarimage',
    EXPIRINGCATALOGPAGE: 'expiringcatalogpage',
    EXPIRINGCATALOGPAGESMALL: 'expiringcatalogpagesmall',
    COMMUNITYGOAL: 'communitygoal',
    COMMUNITYGOALVS: 'communitygoalvsmode',
    COMMUNITYGOALVSVOTE: 'communitygoalvsmodevote',
    CATALOGPROMO: 'catalogpromo',
    CATALOGPROMOSMALL: 'catalogpromosmall',
    ACHIEVEMENTCOMPETITIONHALLOFFAME: 'achievementcompetition_hall_of_fame',
    ACHIEVEMENTCOMPETITIONPRIZES: 'achievementcompetition_prizes',
    DAILYQUEST: 'dailyquest',
    NEXTLIMITEDRARECOUNTDOWN: 'nextlimitedrarecountdown',
    HABBOMODERATIONPROMO: 'habbomoderationpromo',
    HABBOTALENTSPROMO: 'habbotalentspromo',
    HABBOWAYPROMO: 'habbowaypromo',
    ROOMHOPPERNETWORK: 'roomhoppernetwork',
    SAFETYQUIZPROMO: 'safetyquizpromo',
    GENERIC: 'generic',
    WIDGETCONTAINER: 'widgetcontainer',
    PROMOARTICLE: 'promoarticle',
    BONUSRARE: 'bonusrare',
} as const;

/**
 * The widget types this port draws in a slot. `LandingViewWidgetType.getWidgetForType` builds
 * every name above; the ones missing here are widgets whose windows are not ported yet
 * (the catalogue promos, daily quest, the competition and moderation promos), and a slot naming
 * one stays empty - which `DynamicLayoutManager` treats exactly like an unconfigured slot.
 */
export const PORTED_LANDING_VIEW_WIDGETS: ReadonlySet<string> = new Set([
    LandingViewWidgetType.GENERIC,
    LandingViewWidgetType.WIDGETCONTAINER,
    LandingViewWidgetType.BONUSRARE,
    LandingViewWidgetType.PROMOARTICLE,
    LandingViewWidgetType.COMMUNITYGOAL,
    LandingViewWidgetType.COMMUNITYGOALVS,
    LandingViewWidgetType.COMMUNITYGOALVSVOTE,
]);

/**
 * The slots `DynamicLayoutManager` has containers for (`widget_slot_1` .. `_5`).
 * `registerDynamicWidgets` also reads `landing.view.dynamic.slot.6.widget`, but
 * `dynamic_widget_grid` has no `widget_slot_6`, so that widget never initializes; slot 6 is
 * instead the default layout's `widget_placeholder_bottom_slot` (`setupBottomSlotWidgetName`).
 */
export const LANDING_VIEW_DYNAMIC_SLOTS = [ 1, 2, 3, 4, 5 ] as const;

/** `landing.view.dynamic.slot.<slot>.widget`. */
export const hotelViewSlotWidget = (config: Record<string, unknown>, slot: number): string => hotelViewProperty(config, `landing.view.dynamic.slot.${slot}.widget`);

/** `WidgetContainerWidget.initialize`: the scheduling string a container slot asks the timing code for. */
export const hotelViewSlotSchedule = (config: Record<string, unknown>, slot: number): string => hotelViewProperty(config, `landing.view.dynamic.slot.${slot}.conf`);

/** `WidgetContainerWidget.createWidgetContainer`: the widget a timing code names. */
export const hotelViewCodeWidget = (config: Record<string, unknown>, code: string): string => hotelViewProperty(config, `landing.view.${code}.widget`);

/**
 * `GenericWidget.getConf`: a generic widget's `conf` or `layout`, under its configuration code
 * when a container chose it, else under its own slot.
 */
export const hotelViewGenericConf = (config: Record<string, unknown>, slot: number, code: string | null, name: 'conf' | 'layout'): string => hotelViewProperty(config, (code !== null) ? `landing.view.${code}.${name}` : `landing.view.dynamic.slot.${slot}.${name}`);

/** `GenericWidget.isWideSlot`: slots 3 and 5 are the right pane, the rest the left. */
export const isWideHotelViewSlot = (slot: number) => (slot !== 3) && (slot !== 5);

/** One `type,arg,arg...` entry of a generic widget's `conf`. */
export interface HotelViewGenericElement {
    type: string;
    args: string[];
}

/** `configureContentColumn`'s split: `;` between elements, `,` between an element's arguments. */
export const parseHotelViewGenericConf = (conf: string): HotelViewGenericElement[] => {
    if (!conf) return [];

    return conf.split(';').map((entry) => {
        const [ type, ...args ] = entry.split(',');

        return { type, args };
    });
};

/** `configureLayout`: the bitmap and the content column's placement, and the container's minimum height. */
export interface HotelViewGenericLayout {
    bitmapUri: string;
    bitmapX: number;
    bitmapY: number;
    bitmapWidth: number | null;
    bitmapHeight: number | null;
    contentX: number | null;
    contentY: number;
    contentWidth: number;
    containerHeight: number;
}

/** `generic_widget`'s own geometry: the bitmap at (10, 10), the content column 250 wide at the top. */
export const parseHotelViewGenericLayout = (layout: string): HotelViewGenericLayout => {
    const result: HotelViewGenericLayout = { bitmapUri: '', bitmapX: 10, bitmapY: 10, bitmapWidth: null, bitmapHeight: null, contentX: null, contentY: 0, contentWidth: 250, containerHeight: 30 };

    for (const entry of layout.split(';')) {
        const [ key, value ] = entry.split(',');
        const number = parseInt(value, 10) | 0;

        switch (key) {
            case 'bitmap.uri': result.bitmapUri = value ?? ''; break;
            case 'bitmap.width': result.bitmapWidth = number; break;
            case 'bitmap.height': result.bitmapHeight = number; break;
            case 'bitmap.x': result.bitmapX = number; break;
            case 'bitmap.y': result.bitmapY = number; break;
            case 'content.x': result.contentX = number; break;
            case 'content.y': result.contentY = number; break;
            case 'content.width': result.contentWidth = number; break;
            case 'container.height': result.containerHeight = Math.max(number, result.containerHeight); break;
        }
    }

    return result;
};

/** `CustomTimerElementHandler`: `customtimer,<floating>,<x>,<y>,<remainingKey>,<expiredKey>,<timeStr>`. */
export const hotelViewTimerTimeStr = (element: HotelViewGenericElement): string => element.args[5] ?? '';

/** `LandingViewElementType.CUSTOMTIMER`. */
export const LANDING_VIEW_ELEMENT_CUSTOMTIMER = 'customtimer';

/**
 * `CommonWidgetSettings`: the hotel-wide colours every `COLORABLE`-tagged widget text is given.
 * An empty variable keeps the class default, and a value equal to that default reads as unset.
 */
export interface HotelViewCommonSettings {
    textColor: number | null;
    etchingColor: number | null;
    etchingPosition: string | null;
}

const TEXTCOLOR_DEFAULT = 0xFF000000;
const ETCHINGCOLOR_DEFAULT = 0xFFFFFFFF;
const ETCHINGPOSITION_DEFAULT = 'bottom';

export const hotelViewCommonSettings = (config: Record<string, unknown>): HotelViewCommonSettings => {
    const textColor = hotelViewProperty(config, 'landing.view.common.textcolor');
    const etchingColor = hotelViewProperty(config, 'landing.view.common.etchingcolor');
    const etchingPosition = hotelViewProperty(config, 'landing.view.common.etchingposition');
    const text = textColor ? (parseInt(textColor, 16) >>> 0) : TEXTCOLOR_DEFAULT;
    const etching = etchingColor ? (parseInt(etchingColor, 16) >>> 0) : ETCHINGCOLOR_DEFAULT;
    const position = etchingPosition || ETCHINGPOSITION_DEFAULT;

    return {
        textColor: (text !== TEXTCOLOR_DEFAULT) ? text : null,
        etchingColor: (etching !== ETCHINGCOLOR_DEFAULT) ? etching : null,
        etchingPosition: (position !== ETCHINGPOSITION_DEFAULT) ? position : null,
    };
};

/** `HabboLandingView.dynamicLayoutLeftPaneWidth` / `RightPaneWidth`: `getInteger` with 500 / 250. */
export const hotelViewPaneWidths = (config: Record<string, unknown>) => {
    const read = (key: string, fallback: number) => {
        const value = parseInt(hotelViewProperty(config, key), 10);

        return Number.isNaN(value) ? fallback : value;
    };

    return { left: read('landing.view.dynamic.leftPaneWidth', 500), right: read('landing.view.dynamic.rightPaneWidth', 250) };
};

/** `WidgetContainerLayout.applyCommonWidgetSettings` as ThemeText props, for a `COLORABLE` text. */
export const hotelViewColorableFormat = (settings: HotelViewCommonSettings): ColorableTextFormat => ({
    fill: (settings.textColor !== null) ? `#${(settings.textColor & 0xFFFFFF).toString(16).padStart(6, '0')}` : undefined,
    flashFormat: {
        ...((settings.etchingColor !== null) ? { etchingColor: settings.etchingColor } : {}),
        ...((settings.etchingPosition !== null) ? { etchingPosition: settings.etchingPosition as NonNullable<NonNullable<ColorableTextFormat['flashFormat']>['etchingPosition']> } : {}),
    },
});
