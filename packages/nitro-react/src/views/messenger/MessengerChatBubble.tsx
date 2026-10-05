/**
 * One run of messages in a conversation - the window manager's `IlluminaChatBubbleWidget`, drawn
 * from its `illumina_chat_bubble` layout: the sender's figure in a 52x56 window, the speech arrow,
 * then `bubble_wrapper` - the name (`user_name`, a link to the profile for a user), the messages in
 * a style 106 border, the post time (`UpdatingTimeStampWidget`: `FriendlyTime` with `.ago`, from 1 of
 * a unit), and for an own message to an offline friend the persisted-message note.
 *
 * `flipped` is a friend's bubble: figure on the right facing left (direction 4), arrow pointing
 * right. An own message is drawn grey (`0x8a8a8a`) while it waits for the server's confirmation
 * (`setAwaitingConfirmationId` / `applyConfirmationVisual`). A habbicon message is its preview at
 * twice its size, 80x80 (`createHabbiconBitmap`), from `habbiconsStore.previews` - empty until the
 * habbicon assets have loaded, as Flash's is until `habbicon_assets_loaded`.
 *
 * Only what a bubble shows is carried: the widget's property API (`properties`,
 * `getSerializedMessages`, `getMessagesFromProperty`) and its imperative message list
 * (`appendMessage`, `setMessage`, `refresh`) are the props and the render here. Not carried:
 * `shouldMirrorHabbicon` - Flash mirrors a habbicon that faces away from the bubble's side, by
 * `HabbiconAssetManager.getDirection`, which the port's habbicon assets do not load.
 */
import { AvatarGenderType } from '@nitrodevco/nitro-api';

import { AvatarImage } from '#base/components/AvatarImage';
import { useHabbiconsStore } from '#base/context/habbicons';
import { MessengerChatEntry } from '#base/context/messenger';
import { useTranslation } from '#base/context/system';
import { Border, Box, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';
import { GetFriendlyTime } from '#base/utils';

/** `illumina_chat_bubble`: the figure's window, and `bubble_wrapper` right of it. */
const AVATAR_WIDTH = 52;
const AVATAR_HEIGHT = 56;
/** `refresh`: the messages are the wrapper's width less 5, inside their 10px margins. */
const MESSAGE_INSET = 5;
const MESSAGE_MARGIN = 10;
/** `setAwaitingConfirmationId`'s `9079434`. */
const PENDING_COLOR = '#8a8a8a';
/** `user_name` and `post_time`'s `0x555555`. */
const META_COLOR = '#555555';
const HABBICON_SIZE = 80;

export interface MessengerChatBubbleProps {
    entries: readonly MessengerChatEntry[];
    flipped: boolean;
    width: number;
    figure: string;
    gender: AvatarGenderType;
    userName: string;
    userId: number;
    /** `friendOnlineStatus = false`: an own message to an offline friend who reads it later. */
    persistedForOffline: boolean;
    /** `performance.now()`, from `useSecondsClock`. */
    now: number;
    onProfile: (userId: number) => void;
}

export const MessengerChatBubble = ({ entries, flipped, width, figure, gender, userName, userId, persistedForOffline, now, onProfile }: MessengerChatBubbleProps) => {
    const t = useTranslation();
    const habbiconPreviews = useHabbiconsStore(x => x.previews);
    const wrapperWidth = width - AVATAR_WIDTH;
    const messageWidth = wrapperWidth - MESSAGE_INSET - (MESSAGE_MARGIN * 2);
    const last = entries[entries.length - 1];
    const seconds = Math.max(0, (now - last.sentAt) / 1000);

    return (
        <Box layout={{ width, flexDirection: flipped ? 'row-reverse' : 'row', alignItems: 'flex-start', flexShrink: 0 }}>
            {/* The figure's window: `user_avatar` at (-19, -21) of a 52x56 box, clipped. */}
            <Box layout={{ width: AVATAR_WIDTH, height: AVATAR_HEIGHT, overflow: 'hidden', flexShrink: 0 }}>
                <AvatarImage
                    figure={figure}
                    gender={gender}
                    direction={flipped ? 4 : 2}
                    layout={{ position: 'absolute', left: -19, top: -21 }}
                />
            </Box>
            {/* `arrow_point`: at the figure's inner edge, mirrored for an own bubble. */}
            <ThemeImage
                src={LayoutImage('habbo-window-manager-com/illumina_light_bubble_chat_arrow.png')}
                scaleX={flipped ? 1 : -1}
                layout={{ position: 'absolute', left: flipped ? (width - AVATAR_WIDTH) : (AVATAR_WIDTH - 5), top: 39, width: 5, height: 10 }}
                eventMode="none"
            />
            <Box layout={{ width: wrapperWidth, marginTop: 15, flexDirection: 'column', flexShrink: 0 }}>
                <Region
                    name="user_name_region"
                    onPointerTap={(userId > 0) ? () => onProfile(userId) : undefined}
                    cursor={(userId > 0) ? 'pointer' : undefined}
                    layout={{ height: 15, alignSelf: 'flex-start' }}
                >
                    <ThemeText
                        text={`${userName}:`}
                        textStyle="il_border"
                        textOptions={{ fill: META_COLOR }}
                    />
                </Region>
                <Border
                    variant="106"
                    layout={{ width: wrapperWidth, minHeight: 18, paddingTop: 7, paddingBottom: 7, flexDirection: 'column' }}
                >
                    {entries.map((entry, index) => (entry.message.habbiconId > 0
                        ? (
                                <Box
                                    key={index}
                                    layout={{ marginLeft: MESSAGE_MARGIN, width: HABBICON_SIZE, height: HABBICON_SIZE }}
                                >
                                    {habbiconPreviews[entry.message.habbiconId] && (
                                        <ThemeImage
                                            texture={habbiconPreviews[entry.message.habbiconId]}
                                            width={HABBICON_SIZE}
                                            height={HABBICON_SIZE}
                                            eventMode="none"
                                        />
                                    )}
                                </Box>
                            )
                        : (
                                <ThemeText
                                    key={index}
                                    text={entry.message.localized ? t(entry.message.text) : entry.message.text}
                                    textStyle="il_regular"
                                    textOptions={{ wordWrap: true, wordWrapWidth: messageWidth, fill: (entry.awaitConfirmationId > 0) ? PENDING_COLOR : '#000000' }}
                                    layout={{ marginLeft: MESSAGE_MARGIN, width: messageWidth }}
                                />
                            )))}
                </Border>
                <ThemeText
                    text={GetFriendlyTime(t, seconds, '.ago', 1)}
                    textStyle="il_regular"
                    textOptions={{ fill: META_COLOR }}
                    layout={{ height: 16 }}
                />
                {persistedForOffline && (
                    <ThemeText
                        text={t('messenger.notification.persisted_message_sent')}
                        textStyle="il_regular"
                        layout={{ height: 16 }}
                    />
                )}
            </Box>
        </Box>
    );
};
