/**
 * The room chat commands of `ChatInputWidgetHandler` (`RWCM_MESSAGE_CHAT`) that open a chooser or
 * manage the room's furni: a message whose first word is one of these is a command, and is not said.
 *
 * - `:chooser` - the user chooser, unless the room disabled it (`activeRoomHasChooserDisabled`)
 *   for someone without rights;
 * - `:furni` - the furni chooser, for rights, security 2 or an ambassador;
 * - `:pickall`, `:pickallbc`, `:resetscores`, `:ejectall` - `SessionDataManager.pickAllFurniture`,
 *   `pickAllBuilderFurniture`, `resetScores` and `ejectAllFurniture`: for the owner, a controller of
 *   any room or rights, a confirmation and then the command sent as chat
 *   (`sendSpecialCommandMessage`) - `:ejectall` as typed;
 * - `:ejectpets` - `ejectPets`, sent straight away for the owner or a controller of any room.
 *
 * Without the rights each asks for, the command does nothing and is not said either.
 */
import { RoomControllerLevelEnum, RoomObjectVariableEnum } from '@nitrodevco/nitro-api';
import { ChatComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { getRoom, roomStore } from '#base/context/room';
import { systemStore } from '#base/context/system';
import { ClientGates, hasClientGate, userStore } from '#base/context/user';

import { openFurniChooser, openUserChooser } from './roomChooserCommands';

type Send = WebSocketConnection['send'];

/** `sendSpecialCommandMessage`: the command goes to the server as a chat message. */
const sendSpecialCommand = (send: Send, text: string) => send(new ChatComposer({ text, styleId: 0 }));

/** `isRoomOwner || isAnyRoomController || roomControllerLevel >= 1`. */
const mayManageFurni = () => {
    const { isRoomOwner, controllerLevel } = roomStore.getState();

    return isRoomOwner || hasClientGate(ClientGates.AnyRoomController) || (Number(controllerLevel) >= Number(RoomControllerLevelEnum.Guest));
};

/** `windowManager.confirm("${generic.alert.title}", message)`, sending the command on OK. */
const confirmSpecialCommand = (send: Send, messageKey: string, text: string) => {
    const { interpolate, showConfirm } = systemStore.getState();

    showConfirm(interpolate('${generic.alert.title}'), interpolate(`\${${messageKey}}`), () => sendSpecialCommand(send, text));
};

/** Runs `text` when it is one of these room commands; `true` when it was one. */
export const runRoomChatCommand = (send: Send, text: string): boolean => {
    const room = getRoom();

    if (!room) return false;

    const controllerLevel = Number(roomStore.getState().controllerLevel);

    switch (text.split(' ')[0].toLowerCase()) {
        case ':chooser':
            if (((room.getRoomValue<number>(RoomObjectVariableEnum.ChooserDisabled) ?? 0) !== 1) || (controllerLevel >= Number(RoomControllerLevelEnum.Guest))) openUserChooser();
            return true;
        case ':furni':
            if ((controllerLevel >= Number(RoomControllerLevelEnum.Guest)) || hasClientGate(ClientGates.FurniChooserAnyRoom) || userStore.getState().isAmbassador) openFurniChooser();
            return true;
        case ':pickall':
            if (mayManageFurni()) confirmSpecialCommand(send, 'room.confirm.pick_all', ':pickall');
            return true;
        case ':pickallbc':
            if (mayManageFurni()) confirmSpecialCommand(send, 'room.confirm.pick_all_bc', ':pickallbc');
            return true;
        case ':resetscores':
            if (mayManageFurni()) confirmSpecialCommand(send, 'room.confirm.resetscores', ':resetscores');
            return true;
        case ':ejectall':
            if (mayManageFurni()) confirmSpecialCommand(send, 'room.confirm.eject_all', text);
            return true;
        case ':ejectpets':
            if (roomStore.getState().isRoomOwner || hasClientGate(ClientGates.AnyRoomController)) sendSpecialCommand(send, ':ejectpets');
            return true;
    }

    return false;
};
