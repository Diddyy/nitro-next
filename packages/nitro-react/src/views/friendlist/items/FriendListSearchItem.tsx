import { IMessengerSearchResult } from '@nitrodevco/nitro-packets';

import { useFriendsActions } from '#base/context/friend';
import { LayoutImage, ThemeImage } from '#base/theme';

import { FriendListItem } from '../components/FriendListItem';

export interface FriendListSearchItemProps {
    result: IMessengerSearchResult;
    showStartChat: boolean;
    showAskForFriend: boolean;
    onAskForFriend: () => void;
    onStartChat: () => void;
    onPress: () => void;
    zebraColor?: string;
}

/**
 * A result's `search_entry` row (`SearchView.refreshEntry`): the face of anyone with a figure
 * (`refreshFigure`), the name, and the buttons its caller works out. `SearchView` fills the row's
 * two `<bitmap>` slots from the friend list's asset library - `start_chat_png` (right 4, y 3) and
 * `ask_for_friend_png` (right 5, y 2). Neither is an icon-set style. The chat button opens a
 * messenger conversation (`SearchView.onChatButtonClick`).
 */
export const FriendListSearchItem = ({ result, showStartChat, showAskForFriend, onAskForFriend, onStartChat, onPress, zebraColor }: FriendListSearchItemProps) => {
    const { tooltipHandlers } = useFriendsActions();
    const chatHover = tooltipHandlers('friendlist.tip.im');
    const askHover = tooltipHandlers('friendlist.tip.addfriend');

    return (
        <FriendListItem
            entry="search_entry"
            user={result}
            showAvatarHead={!!result.figure}
            zebraColor={zebraColor}
            onPress={onPress}
        >
            {showStartChat && (
                <ThemeImage
                    name="start_chat"
                    src={LayoutImage('habbo-friend-list-com/start_chat.png')}
                    bitmap={{}}
                    hitThreshold={10}
                    cursor="pointer"
                    onPointerOver={chatHover.onMouseEnter}
                    onPointerOut={chatHover.onMouseLeave}
                    onPointerTap={(event) => {
                        event.stopPropagation();
                        onStartChat();
                    }}
                    layout={{ position: 'absolute', right: 4, top: 3, width: 16, height: 14 }}
                />
            )}
            {showAskForFriend && (
                <ThemeImage
                    name="ask_for_friend"
                    src={LayoutImage('habbo-friend-list-com/ask_for_friend.png')}
                    bitmap={{}}
                    hitThreshold={10}
                    cursor="pointer"
                    onPointerOver={askHover.onMouseEnter}
                    onPointerOut={askHover.onMouseLeave}
                    onPointerTap={(event) => {
                        event.stopPropagation();
                        onAskForFriend();
                    }}
                    layout={{ position: 'absolute', right: 5, top: 2, width: 17, height: 16 }}
                />
            )}
        </FriendListItem>
    );
};
