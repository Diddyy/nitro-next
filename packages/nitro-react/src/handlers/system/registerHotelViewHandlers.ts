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
 * - `ExpiringCatalogPageWidget` (and its small one): the page that expires first, at most once in
 *   thirty seconds.
 * - `NextLimitedRareCountdownWidget`: the next limited rare, from `initialize` and from `refresh`
 *   (at most once in thirty seconds), unless `next.limited.rare.countdown.widget.disabled`; and again
 *   a second after the countdown it was told runs out (`setModeSwitchTimer`).
 *
 * The background schedule's answer also gives `MovingBackgroundObjects` its timing code.
 *
 * Every answer is filtered on what was asked (the scheduling or time string), as each listener
 * does. The listeners survive entering a room, as do the Flash layout and its current art.
 */
import {
    BonusRareInfoMessage, CatalogPageWithEarliestExpiryMessage, CommunityGoalProgressMessage, CommunityVoteReceivedMessage, CurrentTimingCodeMessage, GetBonusRareInfoComposer, GetCatalogPageWithEarliestExpiryComposer,
    GetCommunityGoalProgressComposer, GetCurrentTimingCodeComposer, GetLimitedOfferAppearingNextComposer, GetPromoArticlesComposer, GetSecondsUntilComposer, LimitedOfferAppearingNextMessage, PromoArticlesMessage,
    SecondsUntilMessage,
} from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import {
    applyHotelViewTiming, BOTTOM_SLOT_LANDING_VIEW_WIDGETS, HOTEL_VIEW_BOTTOM_SLOT, hotelViewCodeWidget, hotelViewGenericConf, hotelViewProperty, hotelViewSlotSchedule, hotelViewSlotWidget, hotelViewTimerTimeStr, initialHotelViewBackgrounds, LANDING_VIEW_DYNAMIC_SLOTS,
    LANDING_VIEW_ELEMENT_CUSTOMTIMER, LandingViewWidgetType, parseHotelViewGenericConf, systemStore,
} from '#base/context/system';

/** `PromoArticleWidget.refresh`: a new request only once the last is ten minutes old. */
const PROMO_ARTICLES_REQUEST_INTERVAL_MS = 600000;

/** `ExpiringCatalogPageWidget.refresh` and `NextLimitedRareCountdownWidget.refresh`: a new request only once the last is thirty seconds old. */
const COUNTDOWN_REQUEST_INTERVAL_MS = 30000;

export const registerHotelViewHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const {
        setHotelViewBackgroundCode, setHotelViewBackgrounds, setHotelViewBonusRare, setHotelViewCommunityGoal, setHotelViewCommunityVoted, setHotelViewExpiringPage, setHotelViewNextLimited, setHotelViewPromoArticles,
        setHotelViewSecondsUntil, setHotelViewTimingCode,
    } = systemStore.getState();
    let schedulingStr: string | undefined;
    let communityGoalPending = false;
    let nextLimitedTimer: ReturnType<typeof setTimeout> | undefined;
    const promoArticlesRequestedAt = new Map<string, number>();
    const countdownRequestedAt = new Map<string, number>();

    /** A widget's `refresh` throttle: whether the last request under the key is old enough, marking it if so. */
    const countdownDue = (key: string) => {
        const now = Date.now();
        const last = countdownRequestedAt.get(key);

        if ((last !== undefined) && ((now - last) <= COUNTDOWN_REQUEST_INTERVAL_MS)) return false;

        countdownRequestedAt.set(key, now);

        return true;
    };

    /** `NextLimitedRareCountdownWidget.requestNextLimitedRare`. */
    const requestNextLimited = () => {
        if (hotelViewProperty(systemStore.getState().config, 'next.limited.rare.countdown.widget.disabled') === 'true') return;

        send(new GetLimitedOfferAppearingNextComposer({}));
    };
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
            case LandingViewWidgetType.EXPIRINGCATALOGPAGE:
            case LandingViewWidgetType.EXPIRINGCATALOGPAGESMALL:
                if (countdownDue(key)) send(new GetCatalogPageWithEarliestExpiryComposer({}));
                return;
            case LandingViewWidgetType.NEXTLIMITEDRARECOUNTDOWN:
                // `initialize` asks without marking the time, so the first `refresh` asks again.
                if (firstTime) requestNextLimited();
                if (countdownDue(key)) requestNextLimited();
                return;
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

        // `setupBottomSlotWidgetName`: a fixed widget named for the bottom slot is refreshed with the rest.
        const bottom = hotelViewSlotWidget(config, HOTEL_VIEW_BOTTOM_SLOT);

        if (BOTTOM_SLOT_LANDING_VIEW_WIDGETS.has(bottom)) refreshWidget(bottom, HOTEL_VIEW_BOTTOM_SLOT, null);

        send(new GetCurrentTimingCodeComposer({ slotConfig: schedulingStr }));
    };

    const unsubscribeTiming = subscribe(CurrentTimingCodeMessage, (data) => {
        const { config, hotelViewBackgrounds } = systemStore.getState();

        if ((schedulingStr !== undefined) && (data.schedulingStr === schedulingStr)) {
            setHotelViewBackgrounds(applyHotelViewTiming(hotelViewBackgrounds, config, data.code));
            setHotelViewBackgroundCode(data.code);
        }

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
    const unsubscribeVote = subscribe(CommunityVoteReceivedMessage, (data) => {
        if (data.acknowledged) setHotelViewCommunityVoted(true);
    });
    const unsubscribeExpiring = subscribe(CatalogPageWithEarliestExpiryMessage, data => setHotelViewExpiringPage({ ...data, receivedAt: performance.now() }));
    const unsubscribeNextLimited = subscribe(LimitedOfferAppearingNextMessage, (data) => {
        setHotelViewNextLimited({ ...data, receivedAt: performance.now() });

        // `setModeSwitchTimer`: asked again a second after the countdown runs out.
        if (nextLimitedTimer !== undefined) clearTimeout(nextLimitedTimer);

        nextLimitedTimer = (data.appearsInSeconds > 0) ? setTimeout(requestNextLimited, (data.appearsInSeconds + 1) * 1000) : undefined;
    });

    if (systemStore.getState().landingViewVisible) activate();

    return () => {
        unsubscribeTiming();
        unsubscribeStore();
        unsubscribeSeconds();
        unsubscribeBonusRare();
        unsubscribeArticles();
        unsubscribeGoal();
        unsubscribeVote();
        unsubscribeExpiring();
        unsubscribeNextLimited();
        if (nextLimitedTimer !== undefined) clearTimeout(nextLimitedTimer);
        setHotelViewBackgrounds({});
    };
};
