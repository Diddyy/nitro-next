/**
 * The reception's packets. `WidgetContainerLayout.activate` refreshes every widget and asks the
 * background schedule's timing code on each activation; each widget's `refresh` then asks the
 * server for what it shows:
 *
 * - `WidgetContainerWidget.refresh`: the timing code of the slot's own schedule. The answer picks
 *   the configuration code the slot shows (`onTimingCode` -> `switchCurrentWidget`), and the widget
 *   that code names is refreshed in turn (`refreshContent`).
 * - `GenericWidget.refresh`: each element's - only `CustomTimerElementHandler` asks anything
 *   (`GetSecondsUntilMessageComposer` for its time string).
 * - `BonusRarePromoWidget`: the bonus rare, from `initialize` and again from `refresh`, so twice
 *   on the first activation as in Flash.
 * - `PromoArticleWidget.refresh`: the articles, at most once in ten minutes.
 * - `CommunityGoalWidget.requestCommunityGoalProgress`: the progress, unless a request is pending.
 *
 * Every answer is filtered on what was asked (the scheduling or time string), as each listener
 * does. The listeners survive entering a room, as do the Flash layout and its current art.
 */
import {
    BonusRareInfoMessage, CommunityGoalProgressMessage, CurrentTimingCodeMessage, GetBonusRareInfoComposer, GetCommunityGoalProgressComposer, GetCurrentTimingCodeComposer, GetPromoArticlesComposer,
    GetSecondsUntilComposer, PromoArticlesMessage, SecondsUntilMessage,
} from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import {
    applyHotelViewTiming, hotelViewCodeWidget, hotelViewGenericConf, hotelViewProperty, hotelViewSlotSchedule, hotelViewSlotWidget, hotelViewTimerTimeStr, initialHotelViewBackgrounds, LANDING_VIEW_DYNAMIC_SLOTS,
    LANDING_VIEW_ELEMENT_CUSTOMTIMER, LandingViewWidgetType, parseHotelViewGenericConf, systemStore,
} from '#base/context/system';

/** `PromoArticleWidget.refresh`: a new request only once the last is ten minutes old. */
const PROMO_ARTICLES_REQUEST_INTERVAL_MS = 600000;

export const registerHotelViewHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { setHotelViewBackgrounds, setHotelViewBonusRare, setHotelViewCommunityGoal, setHotelViewPromoArticles, setHotelViewSecondsUntil, setHotelViewTimingCode } = systemStore.getState();
    let schedulingStr: string | undefined;
    let communityGoalPending = false;
    const promoArticlesRequestedAt = new Map<string, number>();
    const initializedWidgets = new Set<string>();

    /** `WidgetContainer.refresh`: the widget's `initialize` the first time, then its `refresh`. */
    const refreshWidget = (type: string, slot: number, code: string | null) => {
        const { config } = systemStore.getState();
        const key = `${slot}:${code ?? ''}:${type}`;
        const firstTime = !initializedWidgets.has(key);

        initializedWidgets.add(key);

        switch (type) {
            case LandingViewWidgetType.WIDGETCONTAINER:
                send(new GetCurrentTimingCodeComposer({ slotConfig: hotelViewSlotSchedule(config, slot) }));
                return;
            case LandingViewWidgetType.GENERIC:
                for (const element of parseHotelViewGenericConf(hotelViewGenericConf(config, slot, code, 'conf'))) {
                    if (element.type === LANDING_VIEW_ELEMENT_CUSTOMTIMER) send(new GetSecondsUntilComposer({ timeStr: hotelViewTimerTimeStr(element) }));
                }
                return;
            case LandingViewWidgetType.BONUSRARE:
                if (firstTime) send(new GetBonusRareInfoComposer({}));
                send(new GetBonusRareInfoComposer({}));
                return;
            case LandingViewWidgetType.PROMOARTICLE: {
                const now = Date.now();
                const last = promoArticlesRequestedAt.get(key);

                if ((last === undefined) || ((last + PROMO_ARTICLES_REQUEST_INTERVAL_MS) < now)) {
                    send(new GetPromoArticlesComposer({}));
                    promoArticlesRequestedAt.set(key, now);
                }
                return;
            }
            case LandingViewWidgetType.COMMUNITYGOAL:
            case LandingViewWidgetType.COMMUNITYGOALVS:
            case LandingViewWidgetType.COMMUNITYGOALVSVOTE:
                if (!communityGoalPending) {
                    send(new GetCommunityGoalProgressComposer({}));
                    communityGoalPending = true;
                }
                return;
        }
    };

    const activate = () => {
        const { config } = systemStore.getState();

        if (schedulingStr === undefined) {
            schedulingStr = hotelViewProperty(config, 'landing.view.bgtiming');
            setHotelViewBackgrounds(initialHotelViewBackgrounds(config));
        }

        for (const slot of LANDING_VIEW_DYNAMIC_SLOTS) refreshWidget(hotelViewSlotWidget(config, slot), slot, null);

        send(new GetCurrentTimingCodeComposer({ slotConfig: schedulingStr }));
    };

    const unsubscribeTiming = subscribe(CurrentTimingCodeMessage, (data) => {
        const { config, hotelViewBackgrounds } = systemStore.getState();

        if ((schedulingStr !== undefined) && (data.schedulingStr === schedulingStr)) setHotelViewBackgrounds(applyHotelViewTiming(hotelViewBackgrounds, config, data.code));

        for (const slot of LANDING_VIEW_DYNAMIC_SLOTS) {
            if (hotelViewSlotWidget(config, slot) !== LandingViewWidgetType.WIDGETCONTAINER) continue;
            if (hotelViewSlotSchedule(config, slot) !== data.schedulingStr) continue;

            setHotelViewTimingCode(data.schedulingStr, data.code);

            if (data.code !== '') refreshWidget(hotelViewCodeWidget(config, data.code), slot, data.code);
        }
    });
    const unsubscribeStore = systemStore.subscribe((state, previous) => {
        if (state.landingViewVisible && !previous.landingViewVisible) activate();
    });
    const unsubscribeSeconds = subscribe(SecondsUntilMessage, data => setHotelViewSecondsUntil(data.timeStr, { seconds: data.secondsUntil, receivedAt: performance.now() }));
    const unsubscribeBonusRare = subscribe(BonusRareInfoMessage, data => setHotelViewBonusRare(data));
    const unsubscribeArticles = subscribe(PromoArticlesMessage, data => setHotelViewPromoArticles(data.articles.slice(0, 10)));
    const unsubscribeGoal = subscribe(CommunityGoalProgressMessage, (data) => {
        communityGoalPending = false;
        setHotelViewCommunityGoal(data);
    });

    if (systemStore.getState().landingViewVisible) activate();

    return () => {
        unsubscribeTiming();
        unsubscribeStore();
        unsubscribeSeconds();
        unsubscribeBonusRare();
        unsubscribeArticles();
        unsubscribeGoal();
        setHotelViewBackgrounds({});
    };
};
