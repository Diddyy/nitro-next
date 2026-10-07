import type { IAvatarEffect } from '@nitrodevco/nitro-packets';

/**
 * One avatar effect as the effects window shows it: the server's snapshot plus what
 * `EffectsModel` tracked on top of it - whether it has been switched on, whether it is the one
 * being worn, and how many copies there are in all.
 */
export interface UserAvatarEffect extends IAvatarEffect {
    /** Switched on: it is counting down and can be worn. */
    isActive: boolean;
    /** The one actually on the avatar. */
    isInUse: boolean;
    /**
     * `Effect.amountInInventory`: every copy, the one that is running included. The list's own
     * `inactiveEffectsInInventory` leaves it out, which is why the window never reads that.
     */
    amountInInventory: number;
}

/** `secondsLeftIfActive` of a copy that is not running: the list's `-1`. */
export const NOT_RUNNING = -1;

/** `EffectsModel.lastActivatedEffect` when there is none. */
export const NO_LAST_WORN = -1;

/** The effect to wear again in the next room after the player chose `type`; choosing none (zero or less) leaves none. */
export const lastWornAfterChoice = (type: number): number => ((type > 0) ? type : NO_LAST_WORN);

/** `IncomingMessages.onAvatarEffects`: zero or more seconds left is running; only `-1` is not. */
const toUserEffect = (effect: IAvatarEffect): UserAvatarEffect => {
    const isActive = effect.isPermanent || (effect.secondsLeftIfActive >= 0);

    return {
        ...effect,
        isActive,
        isInUse: false,
        amountInInventory: effect.inactiveEffectsInInventory + (isActive ? 1 : 0),
    };
};

export const effectsFromList = (effects: IAvatarEffect[]): UserAvatarEffect[] => effects.map(toUserEffect);

/**
 * `EffectsModel.addEffect`: one more copy of an effect it has, or a new one that is not running.
 * An effect given for good arrives running, since there is no timer to start.
 */
export const effectsAfterAdded = (effects: UserAvatarEffect[], added: IAvatarEffect): UserAvatarEffect[] => {
    if (effects.some(effect => effect.type === added.type)) {
        return effects.map(effect => ((effect.type === added.type)
            ? { ...effect, amountInInventory: effect.amountInInventory + 1, inactiveEffectsInInventory: effect.inactiveEffectsInInventory + 1 }
            : effect));
    }

    return [
        ...effects,
        toUserEffect({
            ...added,
            inactiveEffectsInInventory: added.isPermanent ? 0 : 1,
            secondsLeftIfActive: added.isPermanent ? added.duration : NOT_RUNNING,
        }),
    ];
};

/**
 * `EffectsModel.setEffectActivated`: every other effect stops being worn, and this one is running
 * and worn. A waiting copy is the one that started, so there is one fewer waiting; the total is
 * the same, because the running copy counts.
 */
export const effectsAfterActivated = (effects: UserAvatarEffect[], type: number, duration: number, isPermanent: boolean): UserAvatarEffect[] => effects.map((effect) => {
    if (effect.type !== type) return effect.isInUse ? { ...effect, isInUse: false } : effect;

    const startsACopy = !effect.isActive && !isPermanent;

    return {
        ...effect,
        isActive: true,
        isInUse: true,
        isPermanent,
        secondsLeftIfActive: effect.isActive ? effect.secondsLeftIfActive : duration,
        inactiveEffectsInInventory: startsACopy ? Math.max(0, effect.inactiveEffectsInInventory - 1) : effect.inactiveEffectsInInventory,
    };
});

/**
 * `EffectsModel.setEffectExpired`: with more than one copy the running one is used up and the
 * rest wait; with the last copy the effect is gone.
 */
export const effectsAfterExpired = (effects: UserAvatarEffect[], type: number): UserAvatarEffect[] => {
    const expired = effects.find(effect => effect.type === type);

    if (!expired) return effects;

    if (expired.amountInInventory <= 1) return effects.filter(effect => effect.type !== type);

    return effects.map(effect => ((effect.type === type)
        ? {
                ...effect,
                isActive: false,
                isInUse: false,
                amountInInventory: effect.amountInInventory - 1,
                inactiveEffectsInInventory: effect.amountInInventory - 1,
                secondsLeftIfActive: NOT_RUNNING,
            }
        : effect));
};

/** The effect now worn; anything else stops being worn. Zero or less means none. */
export const effectsAfterSelected = (effects: UserAvatarEffect[], type: number): UserAvatarEffect[] => effects.map(effect => ((effect.isInUse === (effect.type === type))
    ? effect
    : { ...effect, isInUse: effect.type === type }));

/**
 * `EffectsModel.useEffect` for an effect worn before: what to send to wear it again. Nothing when
 * the effect is gone (it expired, or was never kept); otherwise the select, preceded by the
 * activate when it is not running.
 */
export const wearAgain = (effects: UserAvatarEffect[], type: number): { activate: boolean } | undefined => {
    if (type <= 0) return undefined;

    const effect = effects.find(other => other.type === type);

    return effect ? { activate: !effect.isActive } : undefined;
};
