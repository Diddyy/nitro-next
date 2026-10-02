/** AS3 AchievementController packet lifecycle and achievement award presentation. */
import { AchievementEventMessage, AchievementsEventMessage, AchievementsScoreEventMessage, EventLogComposer, HabboAchievementNotificationMessage, UserObjectMessage } from '@nitrodevco/nitro-packets';

import { requestAchievements } from '#base/commands';
import { achievementsStore } from '#base/context/achievements';
import { WebSocketConnection } from '#base/context/communication';
import { inventoryStore } from '#base/context/inventory';
import { notificationStore } from '#base/context/notifications';
import { roomStore } from '#base/context/room';
import { systemStore } from '#base/context/system';
import { getBadgeBaseAndLevel, getBadgeName } from '#base/utils';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerAchievementHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { reset, setList, update, finishTransition, setScore, close } = achievementsStore.getState();
    let transition: ReturnType<typeof setTimeout> | undefined;
    let userId: number | undefined;

    const clearTransition = () => {
        clearTimeout(transition);
        transition = undefined;
    };

    reset();
    const unsubscribeStore = achievementsStore.subscribe((state, previous) => {
        if (previous.pending && !state.pending) clearTransition();
    });
    const unsubscribe = subscribeAll(subscribe, [
        on(UserObjectMessage, (data) => {
            // Registration already reset the session. Login score packets may arrive before
            // the user object; preserve those, and do not reset on a repeated object response.
            if (userId !== undefined && userId !== data.userInfo.userId) {
                clearTransition();
                reset();
                systemStore.getState().hideWindow('achievements');
            }

            userId = data.userInfo.userId;
            requestAchievements(send);
        }),
        on(AchievementsEventMessage, (data) => {
            const fresh = systemStore.getState().config['achievements.new'];

            setList(data.achievements, data.defaultCategory, typeof fresh === 'string' ? fresh.split(',') : []);
        }),
        on(AchievementEventMessage, (data) => {
            if (update(data.achievement)) {
                clearTransition();
                transition = setTimeout(finishTransition, 2000);
            }
        }),
        on(AchievementsScoreEventMessage, data => setScore(data.score)),
        on(HabboAchievementNotificationMessage, ({ data }) => {
            // `IncomingMessages.onLevelUp`: the level is logged under the badge's base name.
            send(new EventLogComposer({ event: 'Achievements', data: getBadgeBaseAndLevel(data.badgeCode).base, action: 'Leveled', extraString: '', extraInt: data.level }));

            // `HabboInventory.onAchievementReceived`: the level's badge is added and the level it
            // replaces (`removedBadgeCode`) is removed. The server keeps a single level per
            // achievement and then republishes the directory and worn slots, which has the last word.
            const { updateBadge, removeBadge } = inventoryStore.getState();

            updateBadge({ badgeId: data.badgeId, badgeCode: data.badgeCode, ownerCount: data.ownerCount, badgeRarityId: data.badgeRarityId }, false);
            removeBadge(data.removedBadgeCode);

            const { getLocalizationValue, config } = systemStore.getState();
            const text = getLocalizationValue('notification.new.achievement', '', { achievement_name: getBadgeName(getLocalizationValue, data.badgeCode) });
            const badgeUrl = config['badge.asset.url'];
            const image = (typeof badgeUrl === 'string' ? badgeUrl : '').replace('%badgename%', data.badgeCode);

            notificationStore.getState().addNotification(text, 'achievement', image || undefined, `questengine/achievements/${data.category}`);
        }),
    ]);

    // `IncomingMessages.onRoomExit` closes the achievement window.
    const unsubscribeRoom = roomStore.subscribe((state, previous) => {
        if (!previous.room || state.room === previous.room) return;

        close();
        systemStore.getState().hideWindow('achievements');
    });

    return () => {
        unsubscribe();
        unsubscribeStore();
        unsubscribeRoom();
        clearTransition();
        reset();
        systemStore.getState().hideWindow('achievements');
    };
};
