/** AS3 AchievementController.show, ensureAchievementsInitialized and the category/achievement selection log. */
import { EventLogComposer, GetAchievementsComposer, GetBadgePointLimitsComposer } from '@nitrodevco/nitro-packets';

import { achievementsStore } from '#base/context/achievements';
import { WebSocketConnection } from '#base/context/communication';
import { systemStore } from '#base/context/system';

export const requestAchievements = (send: WebSocketConnection['send']) => {
    if (!achievementsStore.getState().request()) return;

    send(new GetBadgePointLimitsComposer({}));
    send(new GetAchievementsComposer({}));
};

/** `HabboQuestEngine.linkReceived` `achievements[/category]`: `show`, then `selectCategoryInternalLink`. */
export const openAchievements = (send: WebSocketConnection['send'], category?: string) => {
    achievementsStore.getState().show();
    requestAchievements(send);
    systemStore.getState().showWindow('achievements');

    if (category) achievementsStore.getState().selectCategoryLink(category);
};

/** `onSelectCategory` / `pickCategory`: logs `Category selected`. */
export const pickAchievementCategory = (send: WebSocketConnection['send'], code: string) => {
    achievementsStore.getState().pickCategory(code);
    send(new EventLogComposer({ event: 'Achievements', data: code, action: 'Category selected', extraString: '', extraInt: 0 }));
};

/** `onSelectAchievement`: logs `Achievement selected`. */
export const pickAchievement = (send: WebSocketConnection['send'], id: number) => {
    achievementsStore.getState().selectAchievement(id);
    send(new EventLogComposer({ event: 'Achievements', data: String(id), action: 'Achievement selected', extraString: '', extraInt: 0 }));
};
