import {
    AcceptFriendResultMessage, ConsoleMessageHistoryMessage, FindFriendsProcessResultMessage, FollowFriendErrorCodeType, FollowFriendFailedMessage, FriendListErrorCodeType, FriendListFragmentMessage, FriendListUpdateMessage,
    FriendRequestsMessage, HabboGroupDetailsMessage, HabboSearchResultMessage, InstantMessageErrorMessage, MessengerErrorMessage, MessengerInitMessage, NewConsoleMessageMessage, NewFriendRequestMessage, RoomInviteErrorMessage,
    RoomInviteMessage,
} from '@nitrodevco/nitro-packets';

import { addMessengerConsoleMessage, addMessengerInstantMessageError, addMessengerRoomInvite, goToRoom, loadMessengerHistory, setMessengerOnlineStatus } from '#base/commands';
import { WebSocketConnection } from '#base/context/communication';
import { messengerStore } from '#base/context/messenger';
import { systemStore } from '#base/context/system';
import { userStore } from '#base/context/user';

import { on, subscribeAll } from '../packetSubscriptions';

/**
 * The friend list - Flash's `HabboFriendList` message handlers: the initial fragments, updates,
 * requests, the search tab's results and the errors the list reports. The friend data lives in the
 * user store because the room widgets read it too.
 *
 * And `HabboMessenger`'s console: new messages, their history, instant message errors and room
 * invites go to `MainView` (`commands/messengerCommands.ts`); a friend coming online or going
 * offline is noted in an open conversation (`FriendCategories.onFriendListUpdate` ->
 * `setOnlineStatus`); a group chat's follow finishes on the group's details. Mini mail
 * (`client.minimail.embed.enabled`) is not part of this: its unread count has no view yet.
 */
/**
 * `HabboFriendList.showAlertView`: the text a friend list error code is explained with, for a
 * rejected friend request (`AcceptFriendResult`) and a `MessengerError` alike. The codes are
 * `FriendListErrorCodeType`'s (Flash switches on `errorCode - 1`, so its `case 0` is code 1).
 * Checked against Flash by `scripts/drift/constants.py`.
 */
const FRIEND_LIST_ERRORS: Record<number, string> = {
    [FriendListErrorCodeType.YouHitFriendLimit]: 'friendlist.error.friendlistownlimit',
    [FriendListErrorCodeType.TheyHitFriendLimit]: 'friendlist.error.friendlistlimitofrequester',
    [FriendListErrorCodeType.FriendRequestsDisabled]: 'friendlist.error.friend_requests_disabled',
    [FriendListErrorCodeType.FriendRequestNotFound]: 'friendlist.error.requestnotfound',
    [FriendListErrorCodeType.BlockedByThem]: 'friendlist.error.blocked_by_them',
    [FriendListErrorCodeType.BlockedByYou]: 'friendlist.error.blocked_by_you',
};

/** `HabboFriendList.simpleAlert`: the window manager's `simpleAlert` with a caption and a message only. */
const friendListAlert = (title: string, message: string) => systemStore.getState().showSimpleAlert({ caption: title, message });

/** `HabboFriendList.showAlertView`, under `friendlist.alert.title`; an unknown code is shown raw, as Flash did. */
const showFriendListError = (errorCode: number, clientMessageId: number = 0) => {
    const { getLocalizationValue } = systemStore.getState();
    const key = FRIEND_LIST_ERRORS[errorCode];

    friendListAlert(getLocalizationValue('friendlist.alert.title'), key ? getLocalizationValue(key) : `Received messenger error: msg: ${clientMessageId}, errorCode: ${errorCode}`);
};

export const registerMessengerHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { setFriendLimits, setFriendCategories, processFriends, processFriendUpdates, processFriendRequests, setSearchResults } = userStore.getState();

    return subscribeAll(subscribe, [
        on(AcceptFriendResultMessage, (data) => {
            for (const failure of data.failures) showFriendListError(failure.errorCode);
        }),

        // `HabboFriendBarView.onFindFriendsNotification`: `notify`, which is the plain alert with its ok button.
        on(FindFriendsProcessResultMessage, (data) => {
            const { showAlert, getLocalizationValue } = systemStore.getState();
            const title = data.success ? 'friendbar.find.success.title' : 'friendbar.find.error.title';
            const text = data.success ? 'friendbar.find.success.text' : 'friendbar.find.error.text';

            showAlert(getLocalizationValue(title, title), getLocalizationValue(text, text));
        }),

        // `HabboFriendList.onFollowFriendFailed`, with `getFollowFriendErrorText`.
        on(FollowFriendFailedMessage, (data) => {
            const { getLocalizationValue } = systemStore.getState();

            let errorText = '';

            switch (data.errorCode) {
                case FollowFriendErrorCodeType.NotFriend:
                    errorText = 'friendlist.followerror.notfriend';
                    break;
                case FollowFriendErrorCodeType.Offline:
                    errorText = 'friendlist.followerror.offline';
                    break;
                case FollowFriendErrorCodeType.HotelView:
                    errorText = 'friendlist.followerror.hotelview';
                    break;
                case FollowFriendErrorCodeType.Prevented:
                    errorText = 'friendlist.followerror.prevented';
                    break;
            }

            friendListAlert(getLocalizationValue('friendlist.alert.title'), errorText ? getLocalizationValue(errorText) : `Unknown follow friend error ${data.errorCode}`);
        }),

        on(FriendListFragmentMessage, (data) => {
            if (!data.fragment.length) return;

            processFriends(data.fragment);
        }),

        on(FriendListUpdateMessage, (data) => {
            if (data.friendCategories) setFriendCategories(data.friendCategories);

            // `FriendCategories.onFriendListUpdate`: tell the messenger when a friend's online flag flips.
            const { friends } = userStore.getState();

            for (const update of data.updates ?? []) {
                if (!update.friend) continue;

                const wasOnline = friends[update.friend.playerId]?.isOnline ?? false;

                if (wasOnline !== update.friend.isOnline) setMessengerOnlineStatus(send, update.friend.playerId, update.friend.isOnline);
            }

            if (data.updates && data.updates.length > 0) processFriendUpdates(data.updates);
        }),

        on(FriendRequestsMessage, (data) => {
            if (!data.requests.length) return;

            processFriendRequests(data.requests);
        }),

        // `HabboFriendList.onHabboSearchResult`: `AvatarSearchResults.searchReceived`, which redraws the search tab.
        on(HabboSearchResultMessage, data => setSearchResults(data.friends, data.others)),

        // `HabboFriendList.onMessengerError`.
        on(MessengerErrorMessage, data => showFriendListError(data.errorCode, data.clientMessageId)),

        on(MessengerInitMessage, (data) => {
            setFriendLimits(data.userFriendLimit, data.normalFriendLimit, data.extendedFriendLimit);

            if (data.friendCategories) setFriendCategories(data.friendCategories);
        }),

        on(NewFriendRequestMessage, (data) => {
            processFriendRequests([ data.request ]);
        }),

        // `HabboMessenger.onNewConsoleMessage`.
        on(NewConsoleMessageMessage, data => addMessengerConsoleMessage(send, data)),

        // `HabboMessenger.onConsoleHistory`.
        on(ConsoleMessageHistoryMessage, data => loadMessengerHistory(data.chatId, data.messages)),

        // `HabboMessenger.onInstantMessageError`.
        on(InstantMessageErrorMessage, data => addMessengerInstantMessageError(send, data.playerId, data.errorCode, data.message)),

        // `HabboMessenger.onRoomInvite`.
        on(RoomInviteMessage, data => addMessengerRoomInvite(send, data.senderId, data.message)),

        // `HabboMessenger.onHabboGroupDetails`: a group chat's follow goes to the group's room.
        on(HabboGroupDetailsMessage, (data) => {
            if (!messengerStore.getState().followingToGroupRoom) return;

            messengerStore.getState().setFollowingToGroupRoom(false);
            goToRoom(send, data.data.roomId);
        }),

        // `HabboFriendList.onRoomInviteError`: shown raw, the recipients joined the way `Util.arrayToString` does.
        on(RoomInviteErrorMessage, (data) => {
            friendListAlert(systemStore.getState().getLocalizationValue('friendlist.alert.title'), `Received room invite error: errorCode: ${data.errorCode}, recipients: ${data.failedRecipients.join(', ')}`);
        }),
    ]);
};
