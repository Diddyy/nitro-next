/**
 * Reception state: the background art `WidgetContainerLayout.setBackgroundGraphics` chose, and
 * what the reception's widgets were told by the server - the timing code each scheduled slot
 * shows (`WidgetContainerWidget.onTimingCode`), the countdowns `CustomTimerElementHandler` asked
 * for, the bonus rare (`BonusRarePromoWidget`), the promo articles and the community goal.
 * Retained while a room is open, like the Flash window. `MovingBackgroundObjects` is not ported.
 */
import { BonusRareInfoMessageType, CommunityGoalProgressMessageType, PromoArticleData } from '@nitrodevco/nitro-packets';
import { StateCreator } from 'zustand';

export interface HotelViewBackground {
    uri: string;
    visible: boolean;
}

export type HotelViewBackgrounds = Record<string, HotelViewBackground>;

/** `SecondsUntilMessage`, with when it arrived (`performance.now()`) so a countdown can run on from it. */
export interface HotelViewSecondsUntil {
    seconds: number;
    receivedAt: number;
}

export interface HotelViewSlice {
    hotelViewBackgrounds: HotelViewBackgrounds;
    /** The last timing code per scheduling string - a container slot shows the widget its code names. */
    hotelViewTimingCodes: Record<string, string>;
    hotelViewSecondsUntil: Record<string, HotelViewSecondsUntil>;
    hotelViewBonusRare: BonusRareInfoMessageType | undefined;
    hotelViewCommunityGoal: CommunityGoalProgressMessageType | undefined;
    hotelViewPromoArticles: PromoArticleData[];
    setHotelViewBackgrounds: (backgrounds: HotelViewBackgrounds) => void;
    setHotelViewTimingCode: (schedulingStr: string, code: string) => void;
    setHotelViewSecondsUntil: (timeStr: string, value: HotelViewSecondsUntil) => void;
    setHotelViewBonusRare: (info: BonusRareInfoMessageType) => void;
    setHotelViewCommunityGoal: (goal: CommunityGoalProgressMessageType) => void;
    setHotelViewPromoArticles: (articles: PromoArticleData[]) => void;
}

/** `CoreConfigurationManager` property interpolation for external reception images. */
export const hotelViewProperty = (config: Record<string, unknown>, key: string, fallback = ''): string => {
    const property = (name: string): string | undefined => {
        const value = config[name];

        return (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') ? String(value) : undefined;
    };
    let value = property(key) ?? fallback;

    for (let pass = 0; pass < 10; pass++) {
        const next = value.replace(/\$\{([^}]+)\}/g, (match, name: string) => property(name) ?? match);

        if (next === value) break;

        value = next;
    }

    return value;
};

/** Initial asset_uri values in `landing_view_default_dynamic_layout_xml`. */
export const initialHotelViewBackgrounds = (config: Record<string, unknown>): HotelViewBackgrounds => ({
    background_gradient_top: { uri: '', visible: true },
    background_gradient: { uri: '', visible: true },
    background_right: { uri: '', visible: true },
    background_horizon: { uri: '', visible: true },
    background_hotel_top: { uri: hotelViewProperty(config, 'image.library.url') + 'reception/reception_backdrop_hotel_top_stretch.png', visible: true },
    background_left: { uri: '', visible: true },
});

/** `WidgetContainerLayout.setBackgroundGraphics`: absent/empty URIs keep the last asset. */
export const applyHotelViewTiming = (previous: HotelViewBackgrounds, config: Record<string, unknown>, code: string): HotelViewBackgrounds => {
    const prefix = `landing.view.${code ? `${code}.` : ''}`;

    return Object.fromEntries(Object.entries(previous).map(([ name, background ]) => {
        const visible = hotelViewProperty(config, `${prefix}${name}.visible`) !== 'false';
        const uri = visible ? hotelViewProperty(config, `${prefix}${name}.uri`) : '';

        return [ name, { visible, uri: uri || background.uri } ];
    }));
};

export const createHotelViewSlice: StateCreator<HotelViewSlice, [], [], HotelViewSlice> = set => ({
    hotelViewBackgrounds: {},
    hotelViewTimingCodes: {},
    hotelViewSecondsUntil: {},
    hotelViewBonusRare: undefined,
    hotelViewCommunityGoal: undefined,
    hotelViewPromoArticles: [],
    setHotelViewBackgrounds: hotelViewBackgrounds => set({ hotelViewBackgrounds }),
    setHotelViewTimingCode: (schedulingStr, code) => set(state => ({ hotelViewTimingCodes: { ...state.hotelViewTimingCodes, [schedulingStr]: code } })),
    setHotelViewSecondsUntil: (timeStr, value) => set(state => ({ hotelViewSecondsUntil: { ...state.hotelViewSecondsUntil, [timeStr]: value } })),
    setHotelViewBonusRare: hotelViewBonusRare => set({ hotelViewBonusRare }),
    setHotelViewCommunityGoal: hotelViewCommunityGoal => set({ hotelViewCommunityGoal }),
    setHotelViewPromoArticles: hotelViewPromoArticles => set({ hotelViewPromoArticles }),
});
