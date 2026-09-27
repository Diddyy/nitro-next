import { RoomQueueWidget } from '#base/components';
import { useNavigatorSearchCodeRequest, useWindowVisibility } from '#base/hooks';
import { NavigatorRoomCreateView } from '#base/views/navigator/NavigatorRoomCreateView';
import { NavigatorRoomEntryDialogs } from '#base/views/navigator/NavigatorRoomEntryDialogs';
import { NavigatorView } from '#base/views/navigator/NavigatorView';

export const NavigatorComponent = () => {
    const { isWindowVisible } = useWindowVisibility('navigator');
    const { isWindowVisible: isRoomCreateVisible } = useWindowVisibility('navigator_room_create');

    // A `navigator/tab/<name>` link travels as this window's parameter; act on it here.
    useNavigatorSearchCodeRequest();

    return (
        <>
            {isWindowVisible && <NavigatorView />}
            {/* `RoomCreateViewCtrl` is a window of its own: it stays when the navigator closes. */}
            {isRoomCreateVisible && <NavigatorRoomCreateView />}
            {/* doorbell / password / cant-connect popups outlive the navigator window */}
            <NavigatorRoomEntryDialogs />
            {/* The queue into a full room is up before the room exists, so it lives out here too. */}
            <RoomQueueWidget />
        </>
    );
};
