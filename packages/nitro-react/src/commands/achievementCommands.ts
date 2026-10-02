/** AS3 AchievementController.show and ensureAchievementsInitialized. */
import { GetAchievementsComposer, GetBadgePointLimitsComposer } from '@nitrodevco/nitro-packets';

import { achievementsStore } from '#base/context/achievements';
import { WebSocketConnection } from '#base/context/communication';
import { systemStore } from '#base/context/system';
import { wiredStore } from '#base/context/wired';

export const requestAchievements = (send: WebSocketConnection['send']) => {
    if (!achievementsStore.getState().request()) return;

    send(new GetBadgePointLimitsComposer({}));
    send(new GetAchievementsComposer({}));
};

export const openAchievements = (send: WebSocketConnection['send'], category?: string) => {
    if (category) {
        const fresh = systemStore.getState().config['achievements.new'];

        achievementsStore.getState().selectCategory(category, typeof fresh === 'string' ? fresh.split(',') : [], wiredStore.getState().wiredAchievements);
    }

    requestAchievements(send);
    systemStore.getState().showWindow('achievements');
};
