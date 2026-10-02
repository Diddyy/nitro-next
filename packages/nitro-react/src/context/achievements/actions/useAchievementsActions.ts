/** Stable actions for the achievement browser and congratulations queue. */
import { achievementsStore } from '../store/AchievementsStore';

const { selectCategory, selectAchievement, close, dismissCongratulations, reset } = achievementsStore.getState();

export const useAchievementsActions = () => ({ selectCategory, selectAchievement, close, dismissCongratulations, reset });
