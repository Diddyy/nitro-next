/**
 * The friend bar's list - `HabboFriendBarData`'s friend array, kept as the ids of the friends it
 * holds, in its order. It holds only friends who are online, and it is never sorted
 * (`sortByName` hands its argument back unchanged), so the order is the order they arrived in:
 *
 * - `buildFriendList` (a `FriendListFragment`) appends each online friend.
 * - `onFriendListUpdate` takes the removed ids out, then goes through the updated friends - one
 *   still online stays where it is, one gone offline leaves, and one the list does not hold yet
 *   (they have just come online) goes to the front - and then appends each added friend who is
 *   online and not held yet.
 *
 * Kept free of runtime imports so it can be tested under Node as it stands.
 */
import type { IMessengerFriend, IMessengerUpdate } from '@nitrodevco/nitro-packets';

/** `FriendListUpdateActionType`'s values, as numbers so this module needs no runtime import. */
const REMOVED = -1;
const UPDATED = 0;
const ADDED = 1;

/** `buildFriendList`: the fragment's online friends after the ones already held. */
export const friendBarAfterFragment = (ids: readonly number[], fragment: readonly IMessengerFriend[]): number[] => {
    const next = [ ...ids ];

    for (const friend of fragment) {
        if (friend.isOnline && !next.includes(friend.playerId)) next.push(friend.playerId);
    }

    return next;
};

/** `onFriendListUpdate`: removals, then updates, then additions, as the parser groups them. */
export const friendBarAfterUpdates = (ids: readonly number[], updates: readonly IMessengerUpdate[]): number[] => {
    let next = [ ...ids ];

    for (const update of updates) {
        if (Number(update.actionType) === REMOVED) next = next.filter(id => id !== update.friendId);
    }

    for (const update of updates) {
        if ((Number(update.actionType) !== UPDATED) || !update.friend) continue;

        const held = next.includes(update.friend.playerId);

        if (update.friend.isOnline) {
            if (!held) next.unshift(update.friend.playerId);
        } else if (held) {
            next = next.filter(id => id !== update.friend?.playerId);
        }
    }

    for (const update of updates) {
        if ((Number(update.actionType) !== ADDED) || !update.friend) continue;

        if (update.friend.isOnline && !next.includes(update.friend.playerId)) next.push(update.friend.playerId);
    }

    return next;
};
