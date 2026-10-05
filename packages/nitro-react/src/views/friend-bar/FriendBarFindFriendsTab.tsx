/**
 * A find friends tab - `AddFriendsTab` on the `add_friends_tab` layout: a style 6 border, 127 wide,
 * whose `tab_content` is the header (the icon and `friend.bar.find.title`), the
 * `friend.bar.find.text` field on white, a spacer and the `friend.bar.find.button` thick button.
 * On the bar it is `Tab.HEIGHT` tall, so only the header shows; selected it grows upwards to the
 * layout's own 164 and shows the text, and the button asks the server to find new friends
 * (`DATA.findNewFriends`), which it answers with `FindFriendsProcessResult` - the alert the friend
 * list's handler shows. Hovered, it lightens and underlines its title (`expose`: `0x91E1F9` over
 * the default `0x7FC8DE`).
 */
import { Container as PixiContainer, FederatedPointerEvent } from 'pixi.js';
import { useRef, useState } from 'react';

import { findNewFriends } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useTranslation } from '#base/context/system';
import { Border, Box, ButtonThick, FloatingPopup, getGlobalRect, GlobalRect, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';

import { FRIEND_BAR_TAB_HEIGHT, FRIEND_BAR_TAB_WIDTH } from './friendBarLayout';

/** `AddFriendsTab.DEFAULT_COLOR` (`8374494`) and its exposed colour (`9560569`). */
const DEFAULT_COLOR = '#7fc8de';
const EXPOSED_COLOR = '#91e1f9';
/** The layout's own height, which `select` restores (`_SafeStr_8120`, read before the first resize). */
const SELECTED_HEIGHT = 164;

interface FriendBarFindFriendsTabBodyProps {
    height: number;
    exposed: boolean;
    selected: boolean;
    onToggle: () => void;
    onExpose: (exposed: boolean) => void;
    onDeselect: () => void;
}

const FriendBarFindFriendsTabBody = ({ height, exposed, selected, onToggle, onExpose, onDeselect }: FriendBarFindFriendsTabBodyProps) => {
    const { send } = useWebSocketContext();
    const t = useTranslation();

    /** `onButtonClick`: find new friends, and close the tab. */
    const onFind = (event: FederatedPointerEvent) => {
        event.stopPropagation();
        findNewFriends(send);
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
            {/* `tab_content`: an item list at (7, 3), 116 wide. */}
            <Box layout={{ position: 'absolute', left: 7, top: 3, width: 116, flexDirection: 'column' }}>
                <Region
                    name="header"
                    layout={{ position: 'relative', width: 112, height: 31, flexShrink: 0 }}
                >
                    <ThemeImage
                        name="icon"
                        // `allocateEntityWindow` swaps in `find_friends_icon_png` for the layout's `add_friends_icon_png`.
                        src={LayoutImage('habbo-friend-bar-com/find_friends_icon.png')}
                        bitmap={{}}
                        layout={{ position: 'absolute', left: -2, top: -5, width: 31, height: 34 }}
                    />
                    <ThemeText
                        text={t('friend.bar.find.title')}
                        textStyle="headline_medium"
                        textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 12, wordWrap: true, wordWrapWidth: 73 }}
                        flashFormat={{ bold: true, underline: exposed, antiAliasType: 'advanced', gridFitType: 'subpixel' }}
                        name="title"
                        verticalAlign="top"
                        layout={{ position: 'absolute', left: 29, width: 77, alignSelf: 'center', marginTop: -0.5, marginBottom: 0.5 }}
                    />
                </Region>
                {selected && (
                    <>
                        <Region
                            name="text"
                            backgroundColor="#ffffff"
                            layout={{ width: 112, height: 62, flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 2, paddingTop: 2, paddingRight: 2 }}
                        >
                            <ThemeText
                                text={t('friend.bar.find.text')}
                                textOptions={{ fontFamily: 'Ubuntu', fontSize: 12, wordWrap: true, wordWrapWidth: 104 }}
                                flashFormat={{ antiAliasType: 'advanced' }}
                                clip
                            />
                        </Region>
                        {/* `spacer` */}
                        <Box layout={{ width: 1, height: 6, flexShrink: 0 }} />
                        <ButtonThick
                            variant="3"
                            name="button"
                            onPointerTap={onFind}
                            layout={{ width: 111, height: 32, flexShrink: 0 }}
                        >
                            {t('friend.bar.find.button')}
                        </ButtonThick>
                    </>
                )}
            </Box>
        </Region>
    );
};

export interface FriendBarFindFriendsTabProps {
    selected: boolean;
    onSelect: (selected: boolean) => void;
}

export const FriendBarFindFriendsTab = ({ selected, onSelect }: FriendBarFindFriendsTabProps) => {
    const slotRef = useRef<PixiContainer>(null);
    const [ exposed, setExposed ] = useState(false);
    const [ selectedAt, setSelectedAt ] = useState<GlobalRect | null>(null);

    const select = () => {
        if (!slotRef.current) return;

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
                <FriendBarFindFriendsTabBody
                    height={FRIEND_BAR_TAB_HEIGHT}
                    exposed={exposed}
                    selected={false}
                    onToggle={select}
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
                    <FriendBarFindFriendsTabBody
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
