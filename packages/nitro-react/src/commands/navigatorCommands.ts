import { CreateFlatComposer, CreateFlatComposerType, GetGuestRoomComposer, GetHabboGroupDetailsComposer, NewNavigatorSearchComposer, OpenFlatConnectionComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { groupStore } from '#base/context/groups';
import { navigatorStore } from '#base/context/navigator';
import { systemStore } from '#base/context/system';

type Send = WebSocketConnection['send'];

/** The prefixes a tag and an owner search carry, as the navigator's own filter menu sends them. */
const TAG_FILTER_PREFIX = 'tag:';
const OWNER_FILTER_PREFIX = 'owner:';

/** The All Rooms tab - where `HabboNewNavigator` sends every search made from outside the window. */
const HOTEL_VIEW_SEARCH_CODE = 'hotel_view';
/** The navigator's My World tab. */
const MY_WORLD_SEARCH_CODE = 'myworld_view';

/**
 * `HabboNavigator.goToRoom` -> `RoomSessionManager.gotoRoom` -> `RoomSession.start()`: sends
 * the OpenFlatConnection (unless the server is opening the connection itself, Flash's
 * `skipOpc`) and starts the room session right away - RSE_STARTED is what makes the room
 * engine create the room and the UI leave the hotel view, before any reply from the server.
 */
export const goToRoom = (send: Send, roomId: number, password: string = '', skipOpenConnection: boolean = false) => {
    if (!skipOpenConnection) send(new OpenFlatConnectionComposer({ roomId, password, unknown1: -1 }));

    systemStore.getState().startRoomSession(roomId);
};

/**
 * `HabboNewNavigator.goToRoom(roomId)` / `IncomingMessages.forwardToRoom`: a room forward
 * asks for the room info with roomForward set and closes the navigator window. The
 * GetGuestRoomResult handler then starts the session, or shows the doorbell / password
 * popup first for a locked room.
 */
export const forwardToRoom = (send: Send, roomId: number) => {
    send(new GetGuestRoomComposer({ roomId, enterRoom: false, roomForward: true }));

    systemStore.getState().hideWindow('navigator');
};

/**
 * `HabboNavigator.goToHomeRoom` -> `HabboNewNavigator.goToHomeRoom`: the home room is entered
 * through a room forward (`goToRoom(homeRoomId, "external")`), so a locked or password
 * protected home room still shows its popup. Returns false when no home room is set.
 */
export const goToHomeRoom = (send: Send) => {
    const { homeRoomId } = systemStore.getState();

    if (homeRoomId < 1) return false;

    forwardToRoom(send, homeRoomId);

    return true;
};

/**
 * `HabboNewNavigator.performSearch`: sends the search and opens the navigator. The window is not
 * touched until the results land - `setSearchResult` then selects the tab they answer and puts
 * their filter back in the drop menu and the field, as `NavigatorView.onSearchResults` does, so
 * a search made from anywhere reads as though it was typed there.
 */
export const performNavigatorSearch = (send: Send, searchCode: string, filteringData: string = '') => {
    navigatorStore.getState().setIsSearching(true);

    send(new NewNavigatorSearchComposer({ searchCodeOriginal: searchCode, filteringData }));

    systemStore.getState().showWindow('navigator');
};

/**
 * Clicking one of a room's tags searches every room for it - the new navigator's
 * `performTagSearch`, which (unlike the legacy one) sends the tag unquoted.
 */
export const searchRoomTag = (send: Send, tag: string) => performNavigatorSearch(send, HOTEL_VIEW_SEARCH_CODE, TAG_FILTER_PREFIX + tag);

/**
 * A free-text navigator search, as `navigator/search/<text>` links ask for - the rentable bots'
 * search skill (14) uses one. `HabboNewNavigator.linkReceived` searches `hotel_view` with it.
 */
export const searchNavigator = (send: Send, text: string) => performNavigatorSearch(send, HOTEL_VIEW_SEARCH_CODE, text);

/** `LegacyNavigator.showOwnRooms` - the Me menu's rooms button: the navigator opened on My World. */
export const showOwnRooms = (send: Send) => performNavigatorSearch(send, MY_WORLD_SEARCH_CODE);

/**
 * `ExtendedProfileWindowCtrl`'s rooms link: every room the user owns, in the All Rooms tab with
 * the owner filter selected and their name in the field.
 */
export const searchRoomsByOwner = (send: Send, userName: string) => performNavigatorSearch(send, HOTEL_VIEW_SEARCH_CODE, OWNER_FILTER_PREFIX + userName);

/**
 * `NavigatorView.showRoomInfoBubbleAt`: a room of a group whose details the client has not been
 * told yet asks for them (`getGuildInfo(habboGroupId, false)` - the answer only, no window), so
 * the room info bubble can show the group's mode icons once they arrive. `HabboNewNavigator` kept
 * its own cache of `HabboGroupDetailsData`; here it is the groups' one, filled by the same packet.
 */
export const requestRoomGroupDetails = (send: Send, groupId: number) => {
    if ((groupId <= 0) || groupStore.getState().detailsById[groupId]) return;

    send(new GetHabboGroupDetailsComposer({ groupId, openDetails: false }));
};

/** `RoomCreateViewCtrl.onCreateButtonClick`: the server answers with `FlatCreatedMessage`. */
export const createFlat = (send: Send, room: CreateFlatComposerType) => send(new CreateFlatComposer(room));
