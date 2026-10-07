import { IMessengerFriend, MessengerFriendRelationType } from '@nitrodevco/nitro-packets';
import { Container as PixiContainer } from 'pixi.js';
import { memo, useRef, useState } from 'react';

import { followFriend, openMessengerConversation, openProfile, setRelationship } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useFriendsActions, useFriendsStore } from '#base/context/friend';
import { Border, FloatingPopup, getGlobalRect, GlobalRect, Icon, LayoutImage, Region, ThemeImage } from '#base/theme';

import { FriendListItem } from '../components/FriendListItem';

/**
 * `HabboFriendList.refreshRelationshipRegion`: the `relationship_status` bitmap's `assetUri` is
 * one of the four `relationship_status_*` library assets, picked by `relationshipStatus - 1`.
 */
const RELATIONSHIP_IMAGES = {
    none: LayoutImage('habbo-window-manager-com/relationship_status_none.png'),
    heart: LayoutImage('habbo-window-manager-com/relationship_status_heart.png'),
    smile: LayoutImage('habbo-window-manager-com/relationship_status_smile.png'),
    bobba: LayoutImage('habbo-window-manager-com/relationship_status_bobba.png'),
} as const;

const relationshipImage = (type: MessengerFriendRelationType): string => {
    switch (type) {
        case MessengerFriendRelationType.One: return RELATIONSHIP_IMAGES.heart;
        case MessengerFriendRelationType.Two: return RELATIONSHIP_IMAGES.smile;
        case MessengerFriendRelationType.Three: return RELATIONSHIP_IMAGES.bobba;
        default: return RELATIONSHIP_IMAGES.none;
    }
};

/**
 * `relationship_chooser`'s four `itemlist_vertical` rows (25x15, one pixel apart, shaded
 * `0xffececec` / `0xffffffff` in turn) with their `static_bitmap`s at y 1.
 */
const RELATIONSHIP_CHOOSER_ITEMS = [
    { name: 'item_none', color: '#ececec', src: RELATIONSHIP_IMAGES.none, status: MessengerFriendRelationType.Zero },
    { name: 'item_heart', color: '#ffffff', src: RELATIONSHIP_IMAGES.heart, status: MessengerFriendRelationType.One },
    { name: 'item_smile', color: '#ececec', src: RELATIONSHIP_IMAGES.smile, status: MessengerFriendRelationType.Two },
    { name: 'item_bobba', color: '#ffffff', src: RELATIONSHIP_IMAGES.bobba, status: MessengerFriendRelationType.Three },
] as const;

export interface FriendListFriendItemProps {
    friend: IMessengerFriend;
    showRelationshipIcon?: boolean;
    showFollowIcon?: boolean;
    showMessageIcon?: boolean;
    zebraColor?: string;
}

/**
 * A friend's `friend_entry` row (`FriendsView.refreshFriendEntry`): the three right-anchored
 * regions at their layout rects - `start_chat` (right 3), `follow_friend` (right 20) and
 * `relationship_status` (right 39, the status bitmap with the style-7 `drop` triangle after it).
 *
 * The relationship region opens `RelationshipStatusSelector`: the `relationship_chooser` window
 * built on the desktop at the region's global position (`appearAt`), here a `FloatingPopup` so the
 * list's clipping does not cut it. Picking an item sends it (`RelationshipStatusSelector.onWindowEvent`
 * -> `HabboFriendList.setRelationshipStatus`) and closes it; the row redraws from the server's
 * friend update, as Flash's did. `start_chat` opens a conversation with the friend
 * (`FriendsView.onChatButtonClick` -> `messenger.startConversation`); `follow_friend` follows them
 * (`onFollowButtonClick`).
 */
export const FriendListFriendItem = memo(({ friend, showRelationshipIcon = true, showFollowIcon = true, showMessageIcon = true, zebraColor }: FriendListFriendItemProps) => {
    const relationshipRef = useRef<PixiContainer | null>(null);
    const [ chooserAt, setChooserAt ] = useState<GlobalRect | null>(null);

    const relationshipDropdownId = useFriendsStore(x => x.relationshipDropdownId);
    const selectedFriendIds = useFriendsStore(x => x.selectedFriendIds);
    const { setRelationshipDropdownId, toggleSelectedFriendId, tooltipHandlers } = useFriendsActions();
    const { send } = useWebSocketContext();

    // `Friend.isGroupFriend`: a group chat, listed with the group's negative id; `FriendsView.onEntry` selects only real friends.
    const isGroupFriend = friend.playerId < 0;
    const isSelected = selectedFriendIds.indexOf(friend.playerId) >= 0;
    const isDropdownVisible = relationshipDropdownId === friend.playerId;

    const relationshipHover = tooltipHandlers('friendlist.tip.relationship');
    const followHover = tooltipHandlers('friendlist.tip.follow');
    const messageHover = tooltipHandlers('friendlist.tip.im');

    const toggleChooser = () => {
        if (relationshipRef.current) setChooserAt(getGlobalRect(relationshipRef.current));

        setRelationshipDropdownId(isDropdownVisible ? 0 : friend.playerId);
    };

    return (
        <FriendListItem
            entry="friend_entry"
            user={friend}
            selected={isSelected}
            showAvatarHead={friend.isOnline}
            groupBadge={isGroupFriend}
            zebraColor={zebraColor}
            onPress={isGroupFriend ? undefined : () => toggleSelectedFriendId(friend.playerId)}
            onProfilePress={isGroupFriend ? undefined : () => openProfile(send, friend.playerId)}
        >
            {showMessageIcon && (
                <Region
                    name="start_chat"
                    cursor="pointer"
                    onPointerTap={() => openMessengerConversation(send, friend.playerId)}
                    onPointerOver={messageHover.onMouseEnter}
                    onPointerOut={messageHover.onMouseLeave}
                    layout={{ position: 'absolute', right: 3, top: 2, width: 16, height: 14 }}
                >
                    {/* `refreshButton(_, "start_chat")`: the `start_chat_png` speech bubble. */}
                    <ThemeImage
                        name="start_chat"
                        src={LayoutImage('habbo-friend-list-com/start_chat.png')}
                        bitmap={{}}
                        layout={{ position: 'absolute', right: 0, top: 0, width: 16, height: 14 }}
                    />
                </Region>
            )}
            {showFollowIcon && (
                <Region
                    cursor="pointer"
                    onPointerTap={() => followFriend(send, friend.playerId)}
                    onPointerOver={followHover.onMouseEnter}
                    onPointerOut={followHover.onMouseLeave}
                    layout={{ position: 'absolute', right: 20, top: 2, width: 16, height: 14 }}
                >
                    {/* `refreshButton(_, "follow_friend")`: the `follow_friend_png` library bitmap. */}
                    <ThemeImage
                        name="follow_friend"
                        src={LayoutImage('habbo-friend-list-com/follow_friend.png')}
                        bitmap={{}}
                        layout={{ position: 'absolute', right: 0, top: 0, width: 16, height: 14 }}
                    />
                </Region>
            )}
            {showRelationshipIcon && (
                <Region
                    ref={relationshipRef}
                    cursor="pointer"
                    onPointerTap={toggleChooser}
                    onPointerOver={relationshipHover.onMouseEnter}
                    onPointerOut={relationshipHover.onMouseLeave}
                    layout={{ position: 'absolute', right: 39, top: 2, width: 26, height: 16 }}
                >
                    <ThemeImage
                        name="status"
                        src={relationshipImage(friend.relationshipType)}
                        bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                        layout={{ position: 'absolute', left: 0, top: 1, width: 16, height: 14 }}
                    />
                    <Icon
                        name="drop"
                        variant={7}
                        tintColor="#000000"
                        layout={{ position: 'absolute', left: 16, top: 5, width: 10, height: 5 }}
                    />
                </Region>
            )}
            {showRelationshipIcon && isDropdownVisible && chooserAt && (
                <FloatingPopup
                    x={chooserAt.x}
                    y={chooserAt.y}
                    onOutsideClick={() => setRelationshipDropdownId(0)}
                >
                    <Border
                        variant="100"
                        backgroundColor="#ffffff"
                        layout={{ position: 'relative', width: 30, height: 68 }}
                    >
                        {RELATIONSHIP_CHOOSER_ITEMS.map((item, index) => (
                            <Region
                                key={item.name}
                                backgroundColor={item.color}
                                cursor="pointer"
                                onPointerTap={() => {
                                    setRelationship(send, friend.playerId, item.status);
                                    setRelationshipDropdownId(0);
                                }}
                                layout={{ position: 'absolute', left: 2, top: 2 + (index * 16), width: 25, height: 15 }}
                            >
                                <ThemeImage
                                    src={item.src}
                                    bitmap={{ stretchedX: false, stretchedY: false }}
                                    layout={{ position: 'absolute', left: 0, top: 1, width: 16, height: 14 }}
                                />
                            </Region>
                        ))}
                    </Border>
                </FloatingPopup>
            )}
        </FriendListItem>
    );
});

FriendListFriendItem.displayName = 'FriendListFriendItem';
