/**
 * What the landing view (`HabboLandingView`) asks the server for each time it is shown -
 * `WidgetContainerLayout.activate`, which refreshes every widget and then asks for the background
 * schedule's code:
 *
 * - each `widgetcontainer` slot's schedule (`WidgetContainerWidget.refresh`,
 *   `landing.view.dynamic.slot.<n>.conf`);
 * - the bonus rare (`BonusRarePromoWidget.refresh`) when a slot shows one;
 * - the background schedule, `landing.view.bgtiming` (`GetCurrentTimingCodeMessageComposer`),
 *   sent even when the hotel sets none - the answer to the empty schedule is what makes
 *   `setBackgroundGraphics` put the configured backgrounds up.
 *
 * Flash's bonus rare widget also asks once from `initialize`, just before its first `refresh`; the
 * second request of that pair is the same question and is not repeated here. The answers land in
 * `landingViewStore` (`registerLandingViewHandlers`).
 */
import { GetBonusRareInfoComposer, GetCurrentTimingCodeComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { systemStore } from '#base/context/system';
import { configReader } from '#base/utils';

type Send = WebSocketConnection['send'];

/**
 * The dynamic grid's slots (`widget_slot_1` .. `_5`). Flash walks six, but the grid has no sixth
 * container: slot 6 only names the fixed widget `widget_placeholder_bottom_slot` becomes.
 */
export const LANDING_VIEW_DYNAMIC_SLOTS = [ 1, 2, 3, 4, 5 ];

/** `LandingViewWidgetType`: the slot widgets this port draws. */
export const LANDING_VIEW_WIDGET_CONTAINER = 'widgetcontainer';
export const LANDING_VIEW_WIDGET_GENERIC = 'generic';
export const LANDING_VIEW_WIDGET_BONUS_RARE = 'bonusrare';

export const activateLandingView = (send: Send) => {
    const { configString } = configReader(systemStore.getState().config);

    for (const slot of LANDING_VIEW_DYNAMIC_SLOTS) {
        const widget = configString(`landing.view.dynamic.slot.${slot}.widget`);

        if (widget === LANDING_VIEW_WIDGET_CONTAINER) send(new GetCurrentTimingCodeComposer({ slotConfig: configString(`landing.view.dynamic.slot.${slot}.conf`) }));
        else if (widget === LANDING_VIEW_WIDGET_BONUS_RARE) send(new GetBonusRareInfoComposer({}));
    }

    send(new GetCurrentTimingCodeComposer({ slotConfig: configString('landing.view.bgtiming') }));
};
