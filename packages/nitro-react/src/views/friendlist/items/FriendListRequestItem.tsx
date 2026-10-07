import { FriendRequestStateType, IFriendRequest } from '@nitrodevco/nitro-packets';

import { acceptFriendRequest, declineFriendRequest, openProfile } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useFriendsActions } from '#base/context/friend';
import { useTranslation } from '#base/context/system';
import { Icon, Region, ThemeText } from '#base/theme';

import { FriendListItem } from '../components/FriendListItem';

export interface FriendListRequestItemProps {
    request: IFriendRequest;
    zebraColor?: string;
}

/** `FriendRequestsView.refreshRequestEntry`: the `info_text` an answered request shows, by `FriendRequest.state`. */
const REQUEST_STATE_TEXT: Partial<Record<FriendRequestStateType, string>> = {
    [FriendRequestStateType.Accepted]: 'friendlist.request.accepted',
    [FriendRequestStateType.Declined]: 'friendlist.request.declined',
    [FriendRequestStateType.Failed]: 'friendlist.request.failed',
};

/**
 * A request's `friend_request_entry` row (`FriendRequestsView.refreshRequestEntry`): the eye at
 * x 0, the requester's name at x 17 and, for an open request, the `accept` / `reject` containers
 * at right 25 / right 0 holding icon-set styles 8 and 9, tinted `0x33cc00` and `0xff3333` - the
 * same pair the requests footer's accept-all / dismiss-all buttons use. An answered request shows
 * its outcome in the `info_text` label (right 13, y 3) instead, until the tab is clicked.
 */
export const FriendListRequestItem = ({ request, zebraColor }: FriendListRequestItemProps) => {
    const { send } = useWebSocketContext();
    const { tooltipHandlers } = useFriendsActions();
    const acceptHover = tooltipHandlers('friendlist.tip.accept');
    const declineHover = tooltipHandlers('friendlist.tip.decline');
    const t = useTranslation();
    const stateText = REQUEST_STATE_TEXT[request.state];

    return (
        <FriendListItem
            entry="friend_request_entry"
            user={request}
            hideAvatarElement
            zebraColor={zebraColor}
            // `FriendRequestsView.onEntry`: a click on the row opens the requester's profile.
            onPress={() => openProfile(send, request.playerId)}
            onProfilePress={() => openProfile(send, request.playerId)}
        >
            {stateText
                ? (
                        <ThemeText
                            name="info_text"
                            text={t(stateText)}
                            textStyle="regular"
                            textOptions={{ fill: '#000000' }}
                            verticalAlign="top"
                            layout={{ position: 'absolute', right: 13, top: 3 }}
                        />
                    )
                : (
                        <>
                            <Region
                                cursor="pointer"
                                onPointerTap={(event) => {
                                    event.stopPropagation();
                                    acceptFriendRequest(send, request.playerId);
                                }}
                                onPointerOver={acceptHover.onMouseEnter}
                                onPointerOut={acceptHover.onMouseLeave}
                                layout={{ position: 'absolute', right: 25, top: 4, width: 16, height: 14 }}
                            >
                                <Icon
                                    name="icon"
                                    variant={8}
                                    tintColor="#33cc00"
                                    layout={{ position: 'absolute', left: 0, top: 0, width: 16, height: 14 }}
                                />
                            </Region>
                            <Region
                                cursor="pointer"
                                onPointerTap={(event) => {
                                    event.stopPropagation();
                                    declineFriendRequest(send, request.playerId);
                                }}
                                onPointerOver={declineHover.onMouseEnter}
                                onPointerOut={declineHover.onMouseLeave}
                                layout={{ position: 'absolute', right: 0, top: 4, width: 16, height: 14 }}
                            >
                                <Icon
                                    name="icon"
                                    variant={9}
                                    tintColor="#ff3333"
                                    layout={{ position: 'absolute', left: 0, top: 0, width: 16, height: 14 }}
                                />
                            </Region>
                        </>
                    )}
        </FriendListItem>
    );
};
