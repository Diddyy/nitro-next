/**
 * One friend's tab on the friend bar - `NewFriendEntityTab` on the `new_friend_entity` layout: a
 * style 6 border, 127x36, with the friend's face (`HabboFaceFocuser.focusUserFace` of the `h`
 * image, the head at direction 2) in `region_profile` and their name beside it (`u_bold`, white,
 * cut to the field by `TextCropper`). The frame does not clip (`clipping="false"`), so the header
 * hangs below its border and the token icons stand above it.
 *
 * Hovered it lightens and underlines the name (`expose` / `conceal`: `0xD3F794` over the default
 * `0x9DBF5A`). Pressed it is selected (`Tab.onMouseClick` -> `HabboFriendBarView.selectTab`): it
 * grows upwards to hold, under the header, a `message_piece` per notification token and then
 * `new_controls_piece` - chat, visit (only while the friend lets themselves be followed,
 * `allowFollow`) and profile - and its bottom stays on the bar (`window.y = HEIGHT -
 * window.height`). A selected tab reaches above the bar, so it is drawn in a `FloatingPopup` over
 * its slot; a press outside it deselects it, as the bar's `WE_DEACTIVATED` does. Pressing the tab
 * again, one of its token icons, or any of its buttons, deselects it too.
 *
 * The tokens are the friend's notifications (`addNotificationToken`): a room event, an achievement
 * (the badge's name), a quest (its name) or a game being played (the game's name). Each shows an
 * icon in the `icons` list - right-aligned at x 117, 13 above the tab, newest first, one for the
 * three notify kinds together and one for a game - which drops in (`DropBounce`, 600 ms, 32 px).
 *
 * Not carried: `btn_game`, which `new_controls_piece` does not have and which opens the game
 * centre, which is not ported; and the game invite `bubble`, which nothing in this revision shows.
 */
import { AvatarGenderType } from '@nitrodevco/nitro-api';
import { IMessengerFriend } from '@nitrodevco/nitro-packets';
import { Container as PixiContainer, FederatedPointerEvent } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

import { followFriendFromBar, openProfile, startFriendBarConversation } from '#base/commands';
import { AvatarFaceImage } from '#base/components';
import { useWebSocketContext } from '#base/context/communication';
import { useTranslation } from '#base/context/system';
import { FriendBarNotification, useUserStore } from '#base/context/user';
import { useTween } from '#base/hooks';
import { Border, Box, FloatingPopup, getGlobalRect, GlobalRect, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';
import { getBadgeName } from '#base/utils';

import { FRIEND_BAR_TAB_HEIGHT, FRIEND_BAR_TAB_WIDTH } from './friendBarLayout';

/** `NewFriendEntityTab.DEFAULT_COLOR` (`10338138`) and its exposed colour (`13891476`). */
const DEFAULT_COLOR = '#9dbf5a';
const EXPOSED_COLOR = '#d3f794';
/** The `header` region, a `message_piece` and the `new_controls_piece`: what a selected tab stacks. */
const HEADER_HEIGHT = 35;
const MESSAGE_HEIGHT = 37;
const CONTROLS_HEIGHT = 35;
/** `icons`: right-aligned at x 117, y -13, 2 apart; `Token.ICON_RECTANGLE` is 25x25. */
const ICONS_RIGHT = 117;
const ICONS_TOP = -13;
const ICON_SIZE = 25;
const ICON_SPACING = 2;
/** `Token.prepare`'s `DropBounce(_icon, 600, 32)`. */
const DROP_MS = 600;
const DROP_HEIGHT = 32;

/** The notification types a tab makes a token for (`addNotificationToken`); a finished game makes none. */
const TOKEN_TYPES = [ 0, 1, 2, 3 ];
/** The token icon tags: `icon_tag_game` for a game, `icon_tag_notify` for the rest. */
const GAME_TYPE = 3;

const tokenIcon = (typeCode: number) => ((typeCode === GAME_TYPE)
    ? 'window-manager/game_center_snowball_notification_icon.png'
    : 'window-manager/friend_bar_event_notification_icon.png');

/** `DropBounce.getBounceOffset`: the classic bounce ease-out. */
const bounceOffset = (progress: number): number => {
    if (progress < 0.364) return 7.5625 * progress * progress;

    if (progress < 0.727) {
        const p = progress - 0.545;

        return (7.5625 * p * p) + 0.75;
    }

    if (progress < 0.909) {
        const p = progress - 0.9091;

        return (7.5625 * p * p) + 0.9375;
    }

    const p = progress - 0.955;

    return (7.5625 * p * p) + 0.984375;
};

const linear = (progress: number) => progress;

/**
 * The icons that have dropped in already, by friend, tag and message: Flash's icon is one window
 * that drops once when its token is made, while here the open and the closed tab draw their own,
 * so an icon only drops the first time it is drawn.
 */
const droppedIcons = new Set<string>();

interface FriendBarTokenIconProps {
    typeCode: number;
    dropKey: string;
    onPress: (event: FederatedPointerEvent) => void;
}

/** A token's icon: a 25x25 region with the icon's bitmap, dropping in from 32 above when it first shows. */
const FriendBarTokenIcon = ({ typeCode, dropKey, onPress }: FriendBarTokenIconProps) => {
    const [ dropped ] = useState(() => droppedIcons.has(dropKey));
    const progress = useTween(1, DROP_MS, linear, dropped ? 1 : 0);

    useEffect(() => {
        droppedIcons.add(dropKey);
    }, [ dropKey ]);

    return (
        <Region
            name={`ICON_${typeCode}`}
            cursor="pointer"
            onPointerTap={onPress}
            layout={{ position: 'relative', top: -DROP_HEIGHT + (bounceOffset(progress) * DROP_HEIGHT), width: ICON_SIZE, height: ICON_SIZE, flexShrink: 0 }}
        >
            <ThemeImage
                src={LayoutImage(tokenIcon(typeCode))}
                bitmap={{ stretchedX: false, stretchedY: false }}
                layout={{ position: 'absolute', left: 0, top: 0, width: ICON_SIZE, height: ICON_SIZE }}
            />
        </Region>
    );
};

/** A token's `message_piece`: 121x37 on `0x4C5832`, its title (`u_italic`) over its message (`u_bold`), both 11px white. */
const FriendBarTokenMessage = ({ notification }: { notification: FriendBarNotification }) => {
    const t = useTranslation();
    let title = '';
    let message = '';

    switch (notification.typeCode) {
        case 0:
            title = t('friendbar.notify.event');
            message = notification.message;
            break;
        case 1:
            title = t('friendbar.notify.achievement');
            message = getBadgeName(t, notification.message);
            break;
        case 2:
            title = t('friendbar.notify.quest');
            message = t(`quests.${notification.message}.name`);
            break;
        case GAME_TYPE:
            title = t('friendbar.notify.game');
            message = t(`gamecenter.${notification.message}.name`);
            break;
    }

    return (
        <Region
            name="message"
            backgroundColor="#4c5832"
            layout={{ position: 'relative', width: 121, height: MESSAGE_HEIGHT, overflow: 'hidden', flexShrink: 0 }}
        >
            <ThemeText
                text={title}
                textStyle="u_italic"
                textOptions={{ fill: '#ffffff', fontSize: 11, wordWrap: true, wordWrapWidth: 116 }}
                name="title"
                verticalAlign="top"
                layout={{ position: 'absolute', left: 2, top: 0, width: 120 }}
            />
            <ThemeText
                text={message}
                textStyle="u_bold"
                textOptions={{ fill: '#ffffff', fontSize: 11, wordWrap: true, wordWrapWidth: 117 }}
                name="message"
                verticalAlign="top"
                layout={{ position: 'absolute', left: 2, top: 15, width: 121 }}
            />
        </Region>
    );
};

interface FriendBarFriendTabBodyProps {
    friend: IMessengerFriend;
    tokens: FriendBarNotification[];
    height: number;
    exposed: boolean;
    selected: boolean;
    onToggle: () => void;
    onExpose: (exposed: boolean) => void;
    onDeselect: () => void;
}

/** The tab's window: the border, its token icons, and `pieces` - the header, then while selected the tokens and the controls. */
const FriendBarFriendTabBody = ({ friend, tokens, height, exposed, selected, onToggle, onExpose, onDeselect }: FriendBarFriendTabBodyProps) => {
    const { send } = useWebSocketContext();
    const t = useTranslation();

    /**
     * `onButtonClick` / `onProfileMouseEvent`: every button does its thing and deselects the tab.
     * The press stops there - it is not also a press on the tab, which would select it again.
     */
    const act = (action: () => void) => (event: FederatedPointerEvent) => {
        event.stopPropagation();
        action();
        onDeselect();
    };

    /** A token icon's `WME_CLICK` is the tab's own `onMouseClick`. */
    const toggleFromIcon = (event: FederatedPointerEvent) => {
        event.stopPropagation();
        onToggle();
    };

    // `addListItemAt(icon, 0)` for a tag the list does not hold yet: one icon per tag, newest first.
    const icons: FriendBarNotification[] = [];

    for (const token of tokens) {
        const isGame = token.typeCode === GAME_TYPE;

        if (!icons.some(icon => ((icon.typeCode === GAME_TYPE) === isGame))) icons.unshift(token);
    }

    return (
        <Region
            name="frame"
            cursor="pointer"
            onPointerTap={onToggle}
            onPointerOver={() => onExpose(true)}
            onPointerOut={() => onExpose(false)}
            layout={{ position: 'relative', width: FRIEND_BAR_TAB_WIDTH, height, flexShrink: 0 }}
        >
            <Border
                variant="6"
                tintColor={exposed ? EXPOSED_COLOR : DEFAULT_COLOR}
                layout={{ position: 'absolute', left: 0, top: 0, width: FRIEND_BAR_TAB_WIDTH, height }}
            />
            {/* `pieces`: an item list at (3, 7), 121 wide, the header first. */}
            <Box layout={{ position: 'absolute', left: 3, top: 7, width: 121, flexDirection: 'column' }}>
                <Region
                    name="header"
                    layout={{ position: 'relative', width: 119, height: HEADER_HEIGHT, flexShrink: 0 }}
                >
                    <ThemeText
                        text={friend.name}
                        textStyle="u_bold"
                        textOptions={{ fill: '#ffffff' }}
                        flashFormat={{ underline: exposed }}
                        overflowReplace={{ replace: '...', width: 86, height: 18, marginX: 0, marginY: 0 }}
                        name="name"
                        verticalAlign="top"
                        layout={{ position: 'absolute', left: 33, top: 2, width: 86, height: 18 }}
                    />
                    <Region
                        name="region_profile"
                        tooltip={t('infostand.profile.link.tooltip', '')}
                        tooltipDelay={100}
                        cursor="pointer"
                        onPointerTap={act(() => openProfile(send, friend.playerId))}
                        layout={{ position: 'absolute', left: 0, top: 0, width: 33, height: HEADER_HEIGHT, overflow: 'hidden' }}
                    >
                        {/* `canvas` at (19, 29) of a container at (-11, -25): (8, 4) in the region. */}
                        <AvatarFaceImage
                            figure={friend.figure}
                            gender={friend.gender ?? AvatarGenderType.Unisex}
                            direction={2}
                            layout={{ position: 'absolute', left: 8, top: 4 }}
                        />
                    </Region>
                </Region>
                {selected && tokens.map(token => (
                    <FriendBarTokenMessage
                        key={token.typeCode}
                        notification={token}
                    />
                ))}
                {selected && (
                    // `new_controls_piece`, placed at x 30 of `pieces`.
                    <Region
                        name="controls"
                        layout={{ position: 'relative', marginLeft: 30, width: 85, height: CONTROLS_HEIGHT, flexShrink: 0 }}
                    >
                        <FriendBarControl
                            name="btn_chat"
                            x={0}
                            src="friend-bar/friend_bar_friendlist_chat.png"
                            etched
                            onPress={act(() => startFriendBarConversation(send, friend.playerId))}
                        />
                        {friend.canFollow && (
                            <FriendBarControl
                                name="btn_visit"
                                x={29}
                                src="friend-bar/friend_bar_friendlist_go_room.png"
                                onPress={act(() => followFriendFromBar(send, friend.playerId))}
                            />
                        )}
                        <FriendBarControl
                            name="button_profile"
                            x={58}
                            src="shared/friend_bar_friendlist_eye.png"
                            etched
                            onPress={act(() => openProfile(send, friend.playerId))}
                        />
                    </Region>
                )}
            </Box>
            {(icons.length > 0) && (
                <Box layout={{ position: 'absolute', right: FRIEND_BAR_TAB_WIDTH - ICONS_RIGHT, top: ICONS_TOP, height: ICON_SIZE, flexDirection: 'row', gap: ICON_SPACING }}>
                    {icons.map((icon) => {
                        const tag = (icon.typeCode === GAME_TYPE) ? 'game' : 'notify';

                        return (
                            <FriendBarTokenIcon
                                key={tag}
                                typeCode={icon.typeCode}
                                dropKey={`${friend.playerId}:${tag}:${icon.message}`}
                                onPress={toggleFromIcon}
                            />
                        );
                    })}
                </Box>
            )}
        </Region>
    );
};

interface FriendBarControlProps {
    name: string;
    x: number;
    src: string;
    /** The `etching_color` `0x48000000` of the bitmaps tagged `#icon`; `btn_visit`'s bitmap has none. */
    etched?: boolean;
    onPress: (event: FederatedPointerEvent) => void;
}

/** One 25x25 `lifted_hover` region of `new_controls_piece`, its 30x30 bitmap unstretched at its corner. */
const FriendBarControl = ({ name, x, src, etched = false, onPress }: FriendBarControlProps) => (
    <Region
        name={name}
        dynamicStyle="lifted_hover"
        cursor="pointer"
        onPointerTap={onPress}
        layout={{ position: 'absolute', left: x, top: 0, width: 25, height: 25, overflow: 'hidden' }}
    >
        <ThemeImage
            dynamicRole="icon"
            src={LayoutImage(src)}
            bitmap={{ stretchedX: false, stretchedY: false, ...(etched && { etchingColor: 0x48000000 }) }}
            layout={{ position: 'absolute', left: 0, top: 0, width: 30, height: 30 }}
        />
    </Region>
);

/** No notifications: one array for every tab without any, so the selector's result stays the same. */
const NO_NOTIFICATIONS: FriendBarNotification[] = [];

export interface FriendBarFriendTabProps {
    friend: IMessengerFriend;
    selected: boolean;
    onSelect: (selected: boolean) => void;
}

export const FriendBarFriendTab = ({ friend, selected, onSelect }: FriendBarFriendTabProps) => {
    const slotRef = useRef<PixiContainer>(null);
    const [ exposed, setExposed ] = useState(false);
    const [ selectedAt, setSelectedAt ] = useState<GlobalRect | null>(null);
    const notifications = useUserStore(x => x.friendBarNotifications[friend.playerId] ?? NO_NOTIFICATIONS);
    const tokens = notifications.filter(notification => TOKEN_TYPES.includes(notification.typeCode));
    // `select`: `pieces.height` - the header, a piece per token, and the controls (the friend is online).
    const selectedHeight = HEADER_HEIGHT + (tokens.length * MESSAGE_HEIGHT) + CONTROLS_HEIGHT;

    const select = () => {
        if (!slotRef.current) return;

        // `Tab.select` conceals the tab before it opens.
        setExposed(false);
        setSelectedAt(getGlobalRect(slotRef.current));
        onSelect(true);
    };

    const deselect = () => onSelect(false);

    return (
        <Box
            ref={slotRef}
            layout={{ width: FRIEND_BAR_TAB_WIDTH, height: FRIEND_BAR_TAB_HEIGHT, flexShrink: 0 }}
        >
            {!selected && (
                <FriendBarFriendTabBody
                    friend={friend}
                    tokens={tokens}
                    height={FRIEND_BAR_TAB_HEIGHT}
                    exposed={exposed}
                    selected={false}
                    onToggle={select}
                    // `onMouseOver` / `onMouseOut` only expose a tab that is not selected.
                    onExpose={setExposed}
                    onDeselect={deselect}
                />
            )}
            {selected && selectedAt && (
                <FloatingPopup
                    x={selectedAt.x}
                    y={selectedAt.y + FRIEND_BAR_TAB_HEIGHT - selectedHeight}
                    onOutsideClick={deselect}
                >
                    <FriendBarFriendTabBody
                        friend={friend}
                        tokens={tokens}
                        height={selectedHeight}
                        exposed={false}
                        selected
                        onToggle={deselect}
                        onExpose={() => {}}
                        onDeselect={deselect}
                    />
                </FloatingPopup>
            )}
        </Box>
    );
};
