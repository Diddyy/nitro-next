/** AS3 AchievementController packet lifecycle and achievement award presentation. */
import { AchievementEventMessage, AchievementsEventMessage, AchievementsScoreEventMessage, HabboAchievementNotificationMessage, UserObjectMessage } from '@nitrodevco/nitro-packets';

import { requestAchievements } from '#base/commands';
import { achievementsStore } from '#base/context/achievements';
import { WebSocketConnection } from '#base/context/communication';
import { inventoryStore } from '#base/context/inventory';
import { notificationStore } from '#base/context/notifications';
import { systemStore } from '#base/context/system';
import { wiredStore } from '#base/context/wired';
import { getBadgeName } from '#base/utils';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerAchievementHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { reset, setList, update, finishTransition, setScore, present } = achievementsStore.getState();
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

            setList(data.achievements, data.defaultCategory, typeof fresh === 'string' ? fresh.split(',') : [], wiredStore.getState().wiredAchievements);
        }),
        on(AchievementEventMessage, (data) => {
            const { config, visibleWindows } = systemStore.getState();
            const skippedValue = config['toolbar.unseen_notification.skipped_badge_ids'];
            const skipped = (typeof skippedValue === 'string' ? skippedValue : '').split(',');

            if (update(data.achievement, !!visibleWindows.achievements, skipped)) {
                clearTransition();
                transition = setTimeout(finishTransition, 2000);
            }
        }),
        on(AchievementsScoreEventMessage, data => setScore(data.score)),
        on(HabboAchievementNotificationMessage, ({ data }) => {
            if (!present(data)) return;

            // One owner for achievement badge changes: directory packets remain authoritative.
            // The server refreshes the directory when replacing entitlements so independent
            // grants and worn slots are preserved; a notification alone cannot describe them.
            const { updateBadge } = inventoryStore.getState();

            updateBadge({ badgeId: data.badgeId, badgeCode: data.badgeCode, ownerCount: data.ownerCount, badgeRarityId: data.badgeRarityId }, inventoryStore.getState().wornBadgeCodes.includes(data.badgeCode));

            const { getLocalizationValue, config } = systemStore.getState();
            const text = getLocalizationValue('notification.new.achievement', '', { achievement_name: getBadgeName(getLocalizationValue, data.badgeCode) });
            const badgeUrl = config['badge.asset.url'];
            const image = (typeof badgeUrl === 'string' ? badgeUrl : '').replace('%badgename%', data.badgeCode);

            notificationStore.getState().addNotification(text, 'achievement', image || undefined, `questengine/achievements/${data.category}`);
        }),
    ]);

    return () => {
        unsubscribe();
        unsubscribeStore();
        clearTransition();
        reset();
        systemStore.getState().hideWindow('achievements');
    };
};
