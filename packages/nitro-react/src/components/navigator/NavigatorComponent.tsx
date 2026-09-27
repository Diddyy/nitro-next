import { RoomQueueWidget } from '#base/components';
import { useNavigatorSearchCodeRequest, useWindowVisibility } from '#base/hooks';
import { NavigatorRoomCreateView } from '#base/views/navigator/NavigatorRoomCreateView';
import { NavigatorRoomEntryDialogs } from '#base/views/navigator/NavigatorRoomEntryDialogs';
import { NavigatorView } from '#base/views/navigator/NavigatorView';

export const NavigatorComponent = () => {
    const { isWindowVisible } = useWindowVisibility('navigator');
    // `RoomCreateViewCtrl` is its own window: it stays up if the navigator is closed under it.
    const { isWindowVisible: isRoomCreateVisible } = useWindowVisibility('room_create');

    // A `navigator/tab/<name>` link travels as this window's parameter; act on it here.
    useNavigatorSearchCodeRequest();

    return (
        <>
            {isWindowVisible && <NavigatorView />}
            {isRoomCreateVisible && <NavigatorRoomCreateView />}
            {/* doorbell / password / cant-connect popups outlive the navigator window */}
            <NavigatorRoomEntryDialogs />
            {/* The queue into a full room is up before the room exists, so it lives out here too. */}
            <RoomQueueWidget />
        </>
    );
};
