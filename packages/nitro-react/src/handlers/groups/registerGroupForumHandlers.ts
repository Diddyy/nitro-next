/**
 * `GroupForumController.initComponent`'s unread count: it asks for the count at once and again every
 * `groupforum.poll.period` seconds (300 when unset - `startPollingForUnreadForumsCount`), and each
 * answer (`onUnreadForumsCountMessage`) is `updateUnreadForumsCount`, which the toolbar shows on the
 * me menu (`HabboToolbar.onUnseenForumsCountUpdate`).
 *
 * While the forums window is open Flash polls with `GetForumsListMessageComposer(2, 0, 20)` instead
 * and counts the list's unread forums; that window is not ported, so the count is always asked for.
 */
import { GetUnreadForumsCountComposer, UnreadForumsCountMessage } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { groupStore } from '#base/context/groups';
import { systemStore } from '#base/context/system';

import { on, subscribeAll } from '../packetSubscriptions';

/** `getInteger("groupforum.poll.period", 300)`. */
const DEFAULT_POLL_PERIOD = 300;

export const registerGroupForumHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const unsubscribe = subscribeAll(subscribe, [
        on(UnreadForumsCountMessage, data => groupStore.getState().setUnreadForumsCount(data.unreadForumsCount)),
    ]);

    const period = Number(systemStore.getState().config['groupforum.poll.period'] ?? DEFAULT_POLL_PERIOD);
    const poll = () => send(new GetUnreadForumsCountComposer({}));
    const timer = setInterval(poll, (Number.isFinite(period) ? period : DEFAULT_POLL_PERIOD) * 1000);

    poll();

    return () => {
        clearInterval(timer);
        unsubscribe();
    };
};
