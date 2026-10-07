import { GetConfigValue } from '@nitrodevco/nitro-api';
import { AvatarEffectActivatedComposer, AvatarEffectActivatedMessage, AvatarEffectAddedMessage, AvatarEffectExpiredMessage, AvatarEffectSelectedComposer, AvatarEffectSelectedMessage, AvatarEffectsMessage, RoomEntryInfoMessage } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { userStore } from '#base/context/user';
import { wearAgain } from '#base/context/user/store/avatarEffectsModel';

import { on, subscribeAll } from '../packetSubscriptions';

/**
 * The avatar's effects wardrobe - `AvatarEffectsHandler` feeding `EffectsModel`. The list arrives
 * whole on login and is patched from there: one added, one used up, one switched on, one worn.
 */
export const registerAvatarEffectsHandlers = ({ subscribe, send }: WebSocketConnection) => {
    const { setAvatarEffects, addAvatarEffect, expireAvatarEffect, activateAvatarEffect, selectAvatarEffect } = userStore.getState();

    return subscribeAll(subscribe, [
        on(AvatarEffectsMessage, (data) => {
            setAvatarEffects(data.effects);
        }),

        on(AvatarEffectAddedMessage, (data) => {
            // One copy: a new effect starts with the one, an owned one gains it. The store works the
            // rest out, because what a copy is worth depends on what is already held.
            addAvatarEffect({
                type: data.type,
                subType: data.subType,
                duration: data.duration,
                inactiveEffectsInInventory: 1,
                secondsLeftIfActive: -1,
                isPermanent: data.isPermanent,
            });
        }),

        on(AvatarEffectExpiredMessage, (data) => {
            expireAvatarEffect(data.type);
        }),

        on(AvatarEffectActivatedMessage, (data) => {
            activateAvatarEffect(data.type, data.duration, data.isPermanent);
        }),

        on(AvatarEffectSelectedMessage, (data) => {
            selectAvatarEffect(data.type);
        }),

        // `HabboInventory`: on entering a room, `effects.reactivate.on.room.entry` puts the effect
        // the player last chose back on - activating it first if it is not running - because the
        // server keeps nothing of what an avatar wore in the room it left.
        on(RoomEntryInfoMessage, () => {
            if (GetConfigValue<boolean>('effects.reactivate.on.room.entry') !== true) return;

            const { avatarEffects, lastWornEffect } = userStore.getState();
            const again = wearAgain(avatarEffects, lastWornEffect);

            if (!again) return;

            if (again.activate) send(new AvatarEffectActivatedComposer({ effectType: lastWornEffect }));

            send(new AvatarEffectSelectedComposer({ effectType: lastWornEffect }));
        }),
    ]);
};
