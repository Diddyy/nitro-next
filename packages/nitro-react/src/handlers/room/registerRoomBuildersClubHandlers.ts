import { BUILDERS_CLUB_PLACEMENT_FLOOR, BuildersClubPlacementWarningMessage, BuildersClubPlaceRoomItemComposer, BuildersClubPlaceWallItemComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { systemStore } from '#base/context/system';

import { on, subscribeAll } from '../packetSubscriptions';

/**
 * `RoomMessageHandler.onBCPlacementWarning`: the server held a Builders Club placement back until
 * the user agrees to what it costs - a trial or lapsed member building alone takes the room off the
 * navigator. The user is asked (`${room.confirm.hide_room}`), and on OK the same placement is sent
 * again, confirmed; cancelling places nothing. Without this the furni the user dropped never
 * appears and nothing says why.
 */
export const registerRoomBuildersClubHandlers = ({ send, subscribe }: WebSocketConnection) => subscribeAll(subscribe, [
    on(BuildersClubPlacementWarningMessage, (warning) => {
        const { interpolate, showConfirm } = systemStore.getState();

        const composer = (warning.typeCode === BUILDERS_CLUB_PLACEMENT_FLOOR)
            ? new BuildersClubPlaceRoomItemComposer({ pageId: warning.pageId, offerId: warning.offerId, extraParam: warning.extraParam, x: warning.x, y: warning.y, direction: warning.direction, confirmed: true })
            : new BuildersClubPlaceWallItemComposer({ pageId: warning.pageId, offerId: warning.offerId, extraParam: warning.extraParam, location: warning.wallLocation, confirmed: true });

        showConfirm(interpolate('${generic.alert.title}'), interpolate('${room.confirm.hide_room}'), () => send(composer));
    }),
]);
