/**
 * The new user flow's answers - the message events `friendbar/onBoardingHc/NameChangeDialog` and
 * `onBoardingHcSteps/RoomPicker` listen to while the flow is up.
 *
 * - `CheckUserNameResult` (`NameChangeDialog.onCheckUserNameResult`): kept for the name box, which
 *   shows it only while it still holds that name.
 * - `SelectInitialRoom` (`RoomPicker.onSelectInitialRoomResponse`): a room made for the player
 *   becomes their home (`UpdateHomeRoom`) and the flow is over (`roomPickingCompleted`). The
 *   server's `FlatCreated` that follows takes them into it, as it does for any new room.
 *
 * `ChangeUserNameResult` needs nothing here: the flow does not wait for it (`claimName` moves on at
 * once), and `SessionDataManager`'s own listener renames the session.
 */
import { CheckUserNameResultMessage, SelectInitialRoomMessage, UpdateHomeRoomComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { onboardingStore } from '#base/context/onboarding';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerOnboardingHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { setNameCheck, finish } = onboardingStore.getState();

    return subscribeAll(subscribe, [
        on(CheckUserNameResultMessage, data => setNameCheck({ resultCode: data.resultCode, name: data.name })),

        on(SelectInitialRoomMessage, (data) => {
            if (data.roomId > 0) send(new UpdateHomeRoomComposer({ roomId: data.roomId }));

            finish();
        }),
    ]);
};
