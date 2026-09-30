/**
 * One friend's tab on the friend bar - `NewFriendEntityTab` on the `new_friend_entity` layout: a
 * style 6 border, 127x36, with the friend's face (`HabboFaceFocuser.focusUserFace` of the `h`
 * image, the head at direction 2) in `region_profile` and their name beside it (`u_bold`, white,
 * cut to the field by `TextCropper`).
 *
 * Hovered it lightens and underlines the name (`expose` / `conceal`: `0xD3F794` over the default
 * `0x9DBF5A`). Pressed it is selected (`Tab.onMouseClick` -> `HabboFriendBarView.selectTab`): it
 * grows upwards to hold `new_controls_piece` under the header - chat, visit (only while the friend
 * lets themselves be followed, `allowFollow`) and profile - and its bottom stays on the bar
 * (`window.y = HEIGHT - window.height`). A selected tab reaches above the bar, so it is drawn in a
 * `FloatingPopup` over its slot; a press outside it deselects it, as the bar's `WE_DEACTIVATED`
 * does. Pressing the tab again, or any of its buttons, deselects it too.
 *
 * Not carried: the notification tokens (`addNotificationToken`, the `icons` list) and the game
 * invite `bubble`, which come from `FriendNotificationMessage` - the port has no listener for it -
 * and the game centre, which is not ported (`btn_game` stays hidden, as it does for a friend who is
 * not in a game). The face is the renderer's cropped head rather than `focusUserFace`'s crop.
 */
import { AvatarGenderType } from '@nitrodevco/nitro-api';
import { IMessengerFriend } from '@nitrodevco/nitro-packets';
import { Container as PixiContainer, FederatedPointerEvent } from 'pixi.js';
import { useRef, useState } from 'react';

import { followFriendFromBar, openProfile, startFriendBarConversation } from '#base/commands';
import { AvatarImage } from '#base/components';
import { useWebSocketContext } from '#base/context/communication';
import { useTranslation } from '#base/context/system';
import { Border, Box, FloatingPopup, getGlobalRect, GlobalRect, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';

import { FRIEND_BAR_TAB_HEIGHT, FRIEND_BAR_TAB_WIDTH } from './friendBarLayout';

/** `NewFriendEntityTab.DEFAULT_COLOR` (`10338138`) and its exposed colour (`13891476`). */
const DEFAULT_COLOR = '#9dbf5a';
const EXPOSED_COLOR = '#d3f794';
/** The `header` region, and the `new_controls_piece` under it: the height a selected tab grows to. */
const HEADER_HEIGHT = 35;
const CONTROLS_HEIGHT = 35;
const SELECTED_HEIGHT = HEADER_HEIGHT + CONTROLS_HEIGHT;

interface FriendBarFriendTabBodyProps {
    friend: IMessengerFriend;
    height: number;
    exposed: boolean;
    selected: boolean;
    onToggle: () => void;
    onExpose: (exposed: boolean) => void;
    onDeselect: () => void;
}

/** The tab's window: the border and `pieces` - the header, and the controls while it is selected. */
const FriendBarFriendTabBody = ({ friend, height, exposed, selected, onToggle, onExpose, onDeselect }: FriendBarFriendTabBodyProps) => {
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

    return (
        <Region
            name="frame"
            cursor="pointer"
            onPointerTap={onToggle}
            onPointerOver={() => onExpose(true)}
            onPointerOut={() => onExpose(false)}
            layout={{ position: 'relative', width: FRIEND_BAR_TAB_WIDTH, height, overflow: 'hidden', flexShrink: 0 }}
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
                        <AvatarImage
                            figure={friend.figure}
                            gender={friend.gender ?? AvatarGenderType.Unisex}
                            headOnly
                            cropped
                            direction={2}
                            layout={{ position: 'absolute', left: 8, top: 4 }}
                        />
                    </Region>
                </Region>
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

export interface FriendBarFriendTabProps {
    friend: IMessengerFriend;
    selected: boolean;
    onSelect: (selected: boolean) => void;
}

export const FriendBarFriendTab = ({ friend, selected, onSelect }: FriendBarFriendTabProps) => {
    const slotRef = useRef<PixiContainer>(null);
    const [ exposed, setExposed ] = useState(false);
    const [ selectedAt, setSelectedAt ] = useState<GlobalRect | null>(null);

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
                    y={selectedAt.y + FRIEND_BAR_TAB_HEIGHT - SELECTED_HEIGHT}
                    onOutsideClick={deselect}
                >
                    <FriendBarFriendTabBody
                        friend={friend}
                        height={SELECTED_HEIGHT}
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
