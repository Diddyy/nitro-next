/**
 * The inventory's furni list - the furni half of Flash `inventory/IncomingMessages`
 * (`onFurniList`, `onFurnitureAddOrUpdate`, `onFurniListRemove`, `onFurniListInvalidate`,
 * `onPostItPlaced`) and
 * what `FurniModel` does with each, plus the trade locks `WiredTradingModel` asks it for.
 *
 * - `onFurniList`: the list comes in fragments; they are collected (`addMessageFragment`, the
 *   buffer sized by the first fragment's total) and inserted once all are in.
 * - `onFurniListRemove`: an item the list held going resets the furni page's unseen items
 *   (`FurniModel.resetUnseenItems`), whichever page is showing - `ResetUnseenItems` for category 1
 *   when anything in it was new.
 * - `onFurniListInvalidate`: the list is no longer current; it is asked for again straight away
 *   while the inventory is open (`setInventoryCategoryInit('furni', false)`), otherwise when the
 *   furni page next opens.
 * - `WiredTradingModel.updateItemGroupMaps` ends in `FurniModel.updateItemLocks`; a trade that is
 *   cancelled or completed closes its sub page, whose `'empty'` switch is `removeAllLocks`. The
 *   user's own cancel is answered by `WiredTradeCancelled`, so it clears the locks here too.
 *   These run after `registerWiredTradeHandlers`, which has stored the offer by then.
 *
 * Not handled: `FurniListRemoveMultipleMessage`, which this client has no packet class for.
 */
import { FurniListAddOrUpdateEventMessage, FurniListEventMessage, FurniListInvalidateEventMessage, FurniListRemoveEventMessage, IFurniListAddOrUpdateFurni, PostItPlacedEventMessage, WiredTradeCancelledMessage, WiredTradeCompletedMessage, WiredTradeItemsUpdateMessage } from '@nitrodevco/nitro-packets';

import { removeAllInventoryFurniLocks, requestFurniInventory, resetInventoryFurniUnseenItems, updateInventoryFurniLocks } from '#base/commands';
import { WebSocketConnection } from '#base/context/communication';
import { inventoryStore } from '#base/context/inventory';
import { systemStore } from '#base/context/system';

import { on, subscribeAll } from '../packetSubscriptions';

type Fragment = Map<number, IFurniListAddOrUpdateFurni>;

export const registerInventoryFurniHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { insertFurniture, addOrUpdateFurni, removeFurni, invalidateFurni, updatePostItCount } = inventoryStore.getState();
    // `IncomingMessages.§_-M1Y§`: the fragments of the list on its way in.
    let fragments: (Fragment | undefined)[] | undefined;

    /** `addMessageFragment`: the whole list once every fragment is in. */
    const addFragment = (fragment: Fragment, totalFragments: number, fragmentNo: number): Fragment | undefined => {
        if (totalFragments === 1) return fragment;

        fragments ??= new Array<Fragment | undefined>(totalFragments).fill(undefined);
        fragments[fragmentNo] = fragment;

        if (fragments.some(received => !received)) return undefined;

        return new Map(fragments.flatMap(received => [ ...(received ?? []) ]));
    };

    return subscribeAll(subscribe, [
        on(FurniListEventMessage, (data) => {
            const furni = addFragment(data.furniFragment, data.totalFragments, data.fragmentNo);

            if (!furni) return;

            insertFurniture(furni);
            fragments = undefined;
            // `insertFurniture` re-reads the locks when it added items; reading them again when it did not changes nothing.
            updateInventoryFurniLocks();
        }),

        on(FurniListAddOrUpdateEventMessage, data => addOrUpdateFurni(data.furni)),

        // `IncomingMessages.onPostItPlaced` -> `FurniModel.updatePostItCount`.
        on(PostItPlacedEventMessage, data => updatePostItCount(data.id, data.itemsLeft)),

        on(FurniListRemoveEventMessage, (data) => {
            if (removeFurni(data.stripId)) resetInventoryFurniUnseenItems(send);
        }),

        on(FurniListInvalidateEventMessage, () => {
            invalidateFurni();

            if (systemStore.getState().visibleWindows.inventory) requestFurniInventory(send);
        }),

        on(WiredTradeItemsUpdateMessage, () => updateInventoryFurniLocks()),

        on(WiredTradeCancelledMessage, () => removeAllInventoryFurniLocks()),

        on(WiredTradeCompletedMessage, () => removeAllInventoryFurniLocks()),
    ]);
};
