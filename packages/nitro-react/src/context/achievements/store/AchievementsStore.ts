/** Session-owned achievement browser state, porting AS3 AchievementController. */
import type { IAchievement, IAchievementLevelUpData } from '@nitrodevco/nitro-packets';
import { createStore } from 'zustand';

import { achievementCategories, achievementVisibleInRoom } from './achievementModel';

interface AchievementsState {
    requested: boolean;
    loaded: boolean;
    achievements: IAchievement[];
    category: string;
    selectedId: number | undefined;
    unseen: number[];
    score: number;
    presented: string[];
    congratulations: IAchievementLevelUpData[];
    pending: IAchievement | undefined;
}

interface AchievementsActions {
    reset: () => void;
    request: () => boolean;
    setList: (achievements: IAchievement[], category: string, newCodes?: string[], roomCodes?: string[]) => void;
    update: (achievement: IAchievement, visible: boolean, skipped: string[]) => boolean;
    finishTransition: () => void;
    selectCategory: (category: string, newCodes?: string[], roomCodes?: string[]) => void;
    selectAchievement: (id: number) => void;
    close: () => void;
    setScore: (score: number) => void;
    present: (data: IAchievementLevelUpData) => boolean;
    dismissCongratulations: () => void;
}

const initialState: AchievementsState = {
    requested: false, loaded: false, achievements: [], category: '', selectedId: undefined,
    unseen: [], score: 0, presented: [], congratulations: [], pending: undefined,
};

export const createAchievementsStore = () => createStore<AchievementsState & AchievementsActions>()((set, get) => ({
    ...initialState,
    reset: () => set(initialState),
    request: () => {
        if (get().requested || get().loaded) return false;

        set({ requested: true });

        return true;
    },
    setList: (achievements, category, newCodes = [], roomCodes = []) => {
        const categories = achievementCategories(achievements, newCodes);
        const preferred = get().category || category;
        const selected = categories.find(entry => entry.code === preferred) ?? categories[0];

        set({ loaded: true, achievements, category: selected?.code ?? '', selectedId: selected?.achievements.find(entry => achievementVisibleInRoom(entry, roomCodes))?.achievementId });
    },
    update: (achievement, visible, skipped) => {
        const state = get();
        const old = state.achievements.find(entry => entry.achievementId === achievement.achievementId);
        const selected = visible && state.selectedId === achievement.achievementId;
        const latest = state.pending?.achievementId === achievement.achievementId ? state.pending : old;

        if (latest && (achievement.level < latest.level || (achievement.level === latest.level && achievement.field_EX < latest.field_EX))) return false;
        const unseen = !selected && !skipped.some(code => code && achievement.badgeId.includes(code))
            ? Array.from(new Set([ ...state.unseen, achievement.achievementId ]))
            : state.unseen;

        if (state.pending?.achievementId === achievement.achievementId) {
            set({ pending: achievement, unseen });

            return false;
        }

        if (selected && old && achievement.level > old.level) {
            set({ unseen, pending: achievement, achievements: state.achievements.map(entry => entry === old ? { ...old, field_EX: old.field_V1O } : entry) });

            return true;
        }

        set({ unseen, achievements: old ? state.achievements.map(entry => entry.achievementId === achievement.achievementId ? achievement : entry) : [ ...state.achievements, achievement ] });

        return false;
    },
    finishTransition: () => {
        const { pending, achievements } = get();

        if (pending) set({ pending: undefined, achievements: achievements.map(entry => entry.achievementId === pending.achievementId ? pending : entry) });
    },
    selectCategory: (category, newCodes = [], roomCodes = []) => {
        get().finishTransition();
        const selected = achievementCategories(get().achievements, newCodes).find(entry => entry.code === category);

        set({ category, selectedId: selected?.achievements.find(entry => achievementVisibleInRoom(entry, roomCodes))?.achievementId });
    },
    selectAchievement: selectedId => set({ selectedId }),
    close: () => {
        get().finishTransition();
        set({ unseen: [] });
    },
    setScore: score => set({ score }),
    present: (data) => {
        const key = `${data.achievementID}:${data.level}`;

        if (get().presented.includes(key)) return false;

        set({ presented: [ ...get().presented, key ], congratulations: data.showDialogToUser ? [ ...get().congratulations, data ] : get().congratulations });

        return true;
    },
    dismissCongratulations: () => set({ congratulations: get().congratulations.slice(1) }),
}));

export const achievementsStore = createAchievementsStore();
