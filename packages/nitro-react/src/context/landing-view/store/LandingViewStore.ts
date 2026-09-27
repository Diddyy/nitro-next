/**
 * What the landing view (`HabboLandingView`) has been told by the server:
 *
 * - `timingCodes`: the answer to each `GetCurrentTimingCodeComposer` it asked, by the schedule it
 *   asked about (`CurrentTimingCodeMessage`). Flash's `WidgetContainerLayout` (the backgrounds, on
 *   `landing.view.bgtiming`) and every `WidgetContainerWidget` (a slot's `.conf`) each listen for
 *   the answer to their own schedule and ignore the rest; keeping every answer by its schedule lets
 *   each of them read its own.
 * - `bonusRare`: `BonusRareInfoMessage`, which `BonusRarePromoWidget` shows. `productClassId` stays
 *   -1 until the server has said which rare it is, and the widget stays hidden until then.
 *
 * An app-wide singleton: the landing view is built once and lives until logout.
 */
import { createStore } from 'zustand';

/** `BonusRareInfoMessageParser`'s fields. */
export interface LandingViewBonusRare {
    productType: string;
    productClassId: number;
    totalCoinsForBonus: number;
    coinsStillRequiredToBuy: number;
}

type State = {
    timingCodes: Record<string, string>;
    bonusRare: LandingViewBonusRare;
};

type Actions = {
    setTimingCode: (schedulingStr: string, code: string) => void;
    setBonusRare: (bonusRare: LandingViewBonusRare) => void;
};

export const LandingViewInitialState: State = {
    timingCodes: {},
    bonusRare: { productType: '', productClassId: -1, totalCoinsForBonus: 0, coinsStillRequiredToBuy: 0 },
};

export type LandingViewStore = State & Actions;

export const createLandingViewStore = () => createStore<LandingViewStore>()(set => ({
    ...structuredClone(LandingViewInitialState),
    setTimingCode: (schedulingStr, code) => set(x => ({ timingCodes: { ...x.timingCodes, [schedulingStr]: code } })),
    setBonusRare: bonusRare => set({ bonusRare }),
}));

export const landingViewStore = createLandingViewStore();
