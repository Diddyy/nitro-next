import { AvatarEffectActivatedComposer, AvatarEffectSelectedComposer } from '@nitrodevco/nitro-packets';

import { useWebSocketContext } from '#base/context/communication';
import { useIsWindowVisible, useToolbarAreaWidth, useWindowActions } from '#base/context/system';
import { useAvatarEffects, userStore } from '#base/context/user';
import { RoomEffectsView } from '#base/views/room-widgets/effects/RoomEffectsView';

/** `EffectsModel.stopUsingEffect` takes an effect off by selecting -1; the server also takes 0. */
const NO_EFFECT = -1;

/**
 * The effects wardrobe - `EffectsWidget`. Opened from the avatar's own menu and kept beside the
 * toolbar, as Flash parked it against the toolbar's right edge.
 */
export const RoomEffectsWidget = () => {
    const effects = useAvatarEffects();
    const isVisible = useIsWindowVisible('avatar_effects');
    const { hideWindow } = useWindowActions();
    const toolbarAreaWidth = useToolbarAreaWidth();
    const { send } = useWebSocketContext();

    if (!isVisible) return null;

    const remember = (type: number) => userStore.getState().setLastWornEffect(type);

    return (
        <RoomEffectsView
            effects={effects}
            onActivate={(type) => {
                // Activating wears it, and Flash remembers it as the one to put on in the next room.
                remember(type);
                send(new AvatarEffectActivatedComposer({ effectType: type }));
            }}
            onToggleWear={(type, isInUse) => {
                remember(isInUse ? NO_EFFECT : type);
                send(new AvatarEffectSelectedComposer({ effectType: isInUse ? NO_EFFECT : type }));
            }}
            onClose={() => hideWindow('avatar_effects')}
            left={toolbarAreaWidth + 2}
        />
    );
};
