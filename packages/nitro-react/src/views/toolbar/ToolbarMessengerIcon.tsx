/**
 * The friend bar's messenger icon - `HabboFriendBarView`'s `icon_messenger` (`new_bar`): shown
 * while any conversation is open (`onRefreshMessengerConversations`), alternating its two
 * `notify` frames every 500 ms while a conversation has an unread message (`notifyMessenger`,
 * on its `Timer(500)`), and toggling the messenger when pressed (`onOpenMessenger`).
 *
 * `FriendBarView` places it in `friendtools`.
 *
 * Flash stops the blinking on a press until the next conversation update; here it blinks while
 * there is an unread conversation and the messenger is closed, which is the same whenever the
 * press opens it.
 */
import { useEffect, useState } from 'react';

import { toggleMessenger } from '#base/commands';
import { useMessengerStore } from '#base/context/messenger';
import { useIsWindowVisible } from '#base/context/system';
import { LayoutImage, Region, ThemeImage } from '#base/theme';

/** `notifyMessenger`'s `Timer(500)`. */
const BLINK_MS = 500;

export const ToolbarMessengerIcon = () => {
    const conversations = useMessengerStore(x => x.conversations);
    const isOpen = useIsWindowVisible('messenger');
    const [ frame, setFrame ] = useState(0);
    const open = conversations.filter(conversation => conversation.visible);
    const notify = !isOpen && open.some(conversation => conversation.unread);

    useEffect(() => {
        if (!notify) return;

        const timer = setInterval(() => setFrame(value => (value ? 0 : 1)), BLINK_MS);

        return () => clearInterval(timer);
    }, [ notify ]);

    if (!open.length) return null;

    const src = notify ? `habbo-window-manager-com/friend_bar_friendlist_messenger_notify_${frame}.png` : 'habbo-window-manager-com/friend_bar_friendlist_messenger.png';

    return (
        <Region
            name="icon_messenger"
            dynamicStyle="lifted_hover"
            onPointerTap={toggleMessenger}
        >
            <ThemeImage
                dynamicRole="icon"
                src={LayoutImage(src)}
                bitmap={{ etchingColor: 0x48000000 }}
                layout={{ width: 26, height: 32 }}
            />
        </Region>
    );
};
