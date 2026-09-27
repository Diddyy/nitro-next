/**
 * The landing view's answers - the listeners `WidgetContainerLayout`, `WidgetContainerWidget` and
 * `BonusRarePromoWidget` add for themselves in Flash. The requests go out when the landing view
 * activates (`activateLandingView` in `commands/landingViewCommands.ts`); each answer is kept in
 * `landingViewStore`, and the views read the one they asked for.
 */
import { BonusRareInfoMessage, CurrentTimingCodeMessage } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { landingViewStore } from '#base/context/landing-view';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerLandingViewHandlers = ({ subscribe }: WebSocketConnection) => {
    const { setTimingCode, setBonusRare } = landingViewStore.getState();

    return subscribeAll(subscribe, [
        on(CurrentTimingCodeMessage, data => setTimingCode(data.schedulingStr, data.code)),

        on(BonusRareInfoMessage, data => setBonusRare({
            productType: data.productType,
            productClassId: data.productClassId,
            totalCoinsForBonus: data.totalCoinsForBonus,
            coinsStillRequiredToBuy: data.coinsStillRequiredToBuy,
        })),
    ]);
};
