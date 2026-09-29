/**
 * The inventory's badge list - the badges half of Flash `inventory/IncomingMessages` (`onBadges`,
 * `onUserBadges`, `onBadgeReceived`, `onAchievementReceived`) and what `BadgesModel` does with each.
 * The catalogue's `UserBadgeSelectorCatalogWidget` listens to the same messages only to re-read the
 * model (`onUserBadgesUpdated`), which the port's widget does by reading the store.
 *
 * - `Badges` comes in fragments, which are collected (`addMessageFragment`, the buffer sized by the
 *   first fragment's total) and handed to `initBadges` once all are in. The list does not say which
 *   badges are worn, and `initBadges` empties the worn list.
 * - `HabboUserBadges` for the user (`onUserBadges`) is what fills it: each badge in it is
 *   `updateBadge(code, true)`, in the order the message lists them. The server sends it after the
 *   list, and on the other occasions it sends the user's badges; one for anyone else is left to the
 *   infostand and the profile.
 * - `BadgeReceived` is `updateBadge(code, false)`: one badge added, or updated and taken off.
 * - `HabboAchievementNotification` (`onAchievementReceived`): the level's badge is added the same
 *   way and the level it replaces (`removedBadgeCode`) is removed.
 * - `BadgePointLimits` is `onBadgePointLimits`: each badge's point limit goes to the localization,
 *   which fills a description's `%limit%` with it (`utils/badgeLocalization`).
 *
 * Who asks for the list: `HabboInventory.getAllMyBadgeIds` the first time it finds the model empty,
 * and the badges tab when it opens (`commands/inventoryBadgeCommands`).
 */
import { BadgePointLimitsEventMessage, BadgeReceivedEventMessage, BadgesEventMessage, HabboAchievementNotificationMessage, HabboUserBadgesMessage, IInventoryBadge } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { inventoryStore } from '#base/context/inventory';
import { systemStore } from '#base/context/system';
import { userStore } from '#base/context/user';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerInventoryBadgesHandlers = ({ subscribe }: WebSocketConnection) => {
    const { initBadges, updateBadge, removeBadge } = inventoryStore.getState();
    const { setBadgePointLimits } = systemStore.getState();
    // `IncomingMessages`' badge fragment buffer: the fragments of the list on its way in.
    let fragments: (IInventoryBadge[] | undefined)[] | undefined;

    /** `addMessageFragment`: the whole list once every fragment is in. */
    const addFragment = (fragment: IInventoryBadge[], totalFragments: number, fragmentNo: number): IInventoryBadge[] | undefined => {
        if (totalFragments === 1) return fragment;

        fragments ??= new Array<IInventoryBadge[] | undefined>(totalFragments).fill(undefined);
        fragments[fragmentNo] = fragment;

        if (fragments.some(received => !received)) return undefined;

        return fragments.flatMap(received => received ?? []);
    };

    return subscribeAll(subscribe, [
        on(BadgesEventMessage, (data) => {
            const badges = addFragment(data.badges, data.totalFragments, data.fragmentNo);

            if (!badges) return;

            fragments = undefined;
            initBadges(badges);
        }),

        on(HabboUserBadgesMessage, (data) => {
            if (data.userId !== userStore.getState().userId) return;

            // The message carries no numeric id (Flash passes 0), so a badge it names keeps the one it has.
            for (const badge of data.selectedBadges) updateBadge({ badgeId: 0, badgeCode: badge.badgeCode, ownerCount: badge.ownerCount, badgeRarityId: badge.badgeRarityId }, true);
        }),

        on(BadgeReceivedEventMessage, data => updateBadge(data, false)),

        on(HabboAchievementNotificationMessage, ({ data }) => {
            updateBadge({ badgeId: data.badgeId, badgeCode: data.badgeCode, ownerCount: data.ownerCount, badgeRarityId: data.badgeRarityId }, false);
            removeBadge(data.removedBadgeCode);
        }),

        on(BadgePointLimitsEventMessage, data => setBadgePointLimits(Object.fromEntries(data.data.map(entry => [ entry.badgeId, entry.limit ])))),
    ]);
};
