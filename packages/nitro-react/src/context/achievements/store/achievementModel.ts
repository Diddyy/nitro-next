/** Pure presentation rules from AS3 AchievementData, AchievementCategories and AchievementCategory. */
import type { IAchievement } from '@nitrodevco/nitro-packets';

export const achievementProgress = (achievement: IAchievement) => ({
    current: Math.max(0, achievement.field_EX - achievement.scoreAtStartOfLevel),
    limit: Math.max(1, achievement.field_V1O - achievement.scoreAtStartOfLevel),
    earned: achievement.finalLevel ? achievement.level : Math.max(0, achievement.level - 1),
});

export const achievedBadgeCode = (achievement: IAchievement) => {
    if (achievement.finalLevel || achievement.levelCount === 1) return achievement.badgeId;

    return achievement.badgeId.replace(/\d+$/, String(Math.max(1, achievement.level - 1)));
};

export interface AchievementCategory {
    code: string;
    achievements: IAchievement[];
}

export const achievementCategories = (achievements: IAchievement[], newCodes: string[] = []): AchievementCategory[] => {
    const categories = new Map<string, IAchievement[]>();
    const fresh: IAchievement[] = [];

    for (const achievement of achievements) {
        if (!achievement.category || achievement.state === 0 || (achievement.state === 4 && achievement.category !== 'wired_games')) continue;

        const category = achievement.state === 2 ? 'archive' : achievement.category;
        const entries = categories.get(category) ?? [];

        entries.push(achievement);
        categories.set(category, entries);

        if (newCodes.includes(achievement.code)) fresh.push(achievement);
    }

    const ordered = Array.from(categories.keys()).filter(code => ![ 'misc', 'archive', 'wired_games', 'new' ].includes(code));

    for (const code of [ 'misc', 'archive', 'wired_games' ]) if (categories.has(code)) ordered.push(code);

    if (fresh.length) {
        categories.set('new', fresh);
        ordered.push('new');
    }

    return ordered.map(code => ({ code, achievements: categories.get(code) ?? [] }));
};

/** AS3 AchievementController.achievementIsVisible: only room-enabled WF achievements. */
export const achievementVisibleInRoom = (achievement: IAchievement, roomCodes: string[]) => achievement.category !== 'wired_games'
    || (achievement.code.startsWith('WF_') && roomCodes.includes(achievement.code.slice(3)));
