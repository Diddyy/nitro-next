/**
 * The friend bar - `HabboFriendBarView` on the `new_bar` layout of `habbo-friend-bar-com`, at the
 * right end of the bottom bar, 1 above the desktop's bottom (`NEW_BAR_BOTTOM_OFFSET`). Its windows
 * are laid side by side and the bar is as wide as they are (`arrangeWindows`):
 *
 * - `friendtools` (150 wide): the divider `line`, `icon_all_friends` (the friend list, with the
 *   unseen counter of friend requests), `icon_find_friends` (the friend list's search tab),
 *   `icon_messenger` (`ToolbarMessengerIcon`) and, while the bar is collapsed, `collapse_left`.
 * - `button_left_page`, the tabs, `button_right_page` - the arrows only while there are more tabs
 *   than room, each faded to 0.2 and disabled when it cannot page (`toggleArrowButtons`).
 * - `collapse_right`, while the bar is open.
 *
 * The tabs are the bar's online friends from `_startIndex` (`FriendBarFriendTab`), as many as fit
 * right of the toolbar (`maxNumOfTabsVisible`), then find friends tabs (`FriendBarFindFriendsTab`)
 * - enough to make three tabs when there are few friends, or one after the last page of friends.
 * One tab is selected at a time (`selectTab` / `deSelect`); paging deselects it.
 *
 * Collapsing folds the bar to `friendtools`: over 140 ms, eased `1 - (1 - t)^3`, the bar slides
 * right until only its first 150 show (`startCollapseAnimation`), and the state is saved as bit 1
 * of the account's `uiFlags` (`setFriendBarState`). The width reported to the chat bar is that
 * visible part (`getReservedFriendBarWidth`).
 *
 * `icon_all_friends` opens the friend list on its requests tab while there are requests, and
 * otherwise on the friends tab, or closes it (`HabboFriendBarData.toggleFriendList`); the bar only
 * knows of requests while `friendbar.requests.enabled` is on (`showFriendRequests`), and so only
 * counts them then. Not carried: the dimmer over the bar while the room entry effect runs, and the
 * `friendbar/` link tracker.
 */
import { FriendRequestStateType, SetUIFlagsComposer } from '@nitrodevco/nitro-packets';
import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { useConfigValue, useIsWindowVisible, useSystemActions, useToolbarAreaWidth, useTranslation } from '#base/context/system';
import { UiFlagEnum, useFriendBarCollapsed, useFriendBarFriends, useFriendRequests, useUserActions, useUserMessengerActions } from '#base/context/user';
import { easeOutCubic, useTween, useViewportSize } from '#base/hooks';
import { Box, Icon, LayoutImage, Region, ThemeImage } from '#base/theme';
import { RoomToolsMinimizeButton } from '#base/views/room-widgets/room-tools/RoomToolsMinimizeButton';
import { UnseenItemCounterView } from '#base/views/system/UnseenItemCounterView';
import { ToolbarMessengerIcon } from '#base/views/toolbar/ToolbarMessengerIcon';

import { FriendBarFindFriendsTab } from './FriendBarFindFriendsTab';
import { FriendBarFriendTab } from './FriendBarFriendTab';
import {
    FRIEND_BAR_BOTTOM_OFFSET, FRIEND_BAR_COLLAPSE_MS, FRIEND_BAR_COLLAPSE_WIDTH, FRIEND_BAR_HEIGHT, FRIEND_BAR_LEFT_PAGE_WIDTH, FRIEND_BAR_RIGHT_PAGE_WIDTH, FRIEND_BAR_TAB_SPACING, FRIEND_BAR_TOOLS_WIDTH,
    friendBarWidth, layoutFriendBar, maxFriendBarTabs, pageFriendBar,
} from './friendBarLayout';

interface FriendBarPageButtonProps {
    name: string;
    direction: -1 | 1;
    enabled: boolean;
    onPage: () => void;
}

/**
 * `button_left_page` / `button_right_page`: the browse backdrop in `0x3b3933` (mirrored on the
 * left) under an arrow from the icon set in `0x9c9791`, paging on a press (`WME_DOWN`).
 */
const FriendBarPageButton = ({ name, direction, enabled, onPage }: FriendBarPageButtonProps) => {
    const left = direction < 0;

    return (
        <Region
            name={name}
            dynamicStyle="brightness_and_shadow_under"
            disabled={!enabled}
            alpha={enabled ? 1 : 0.2}
            cursor={enabled ? 'pointer' : undefined}
            onPointerDown={enabled ? onPage : undefined}
            layout={{ position: 'relative', marginTop: 4, width: left ? FRIEND_BAR_LEFT_PAGE_WIDTH : FRIEND_BAR_RIGHT_PAGE_WIDTH, height: 40, overflow: 'hidden', flexShrink: 0 }}
        >
            <ThemeImage
                src={LayoutImage('friend-bar/friend_bar_friends_browse_bg.png')}
                bitmap={{ stretchedX: false, stretchedY: false, fitSizeToContents: true, ...(left && { zoomX: -1 }) }}
                tint="#3b3933"
                dynamicRole="bg"
                layout={{ position: 'absolute', left: 0, top: left ? 4 : 5 }}
            />
            <Icon
                variant={left ? 4 : 5}
                tintColor="#9c9791"
                dynamicRole="icon"
                layout={{ position: 'absolute', left: left ? 12 : 11, top: 15, width: 10, height: 10 }}
            />
        </Region>
    );
};

/** The selected tab: a friend by id, or a find friends tab by its place among them. */
type SelectedTab = { friendId: number } | { findIndex: number } | null;

export const FriendBarView = forwardRef<PixiContainer>((_, ref) => {
    const { send } = useWebSocketContext();
    const t = useTranslation();
    const { showWindow, hideWindow, toggleWindow } = useSystemActions();
    const { setUiFlag } = useUserActions();
    const friends = useFriendBarFriends();
    const requests = useFriendRequests();
    const requestsEnabled = useConfigValue<boolean>('friendbar.requests.enabled') === true;
    const friendListOpen = useIsWindowVisible('friendlist');
    const collapsed = useFriendBarCollapsed();
    const toolbarAreaWidth = useToolbarAreaWidth();
    const { width: viewportWidth } = useViewportSize();
    const [ startIndex, setStartIndex ] = useState(0);
    const [ selected, setSelectedTab ] = useState<SelectedTab>(null);
    const { clearViewedFriendBarNotifications } = useUserMessengerActions();

    /** `selectTab` / `deSelect`: a friend's tab that closes drops its shown-once tokens (`NewFriendEntityTab.deselect`). */
    const setSelected = (next: SelectedTab) => {
        const closing = (selected && ('friendId' in selected)) ? selected.friendId : undefined;

        if ((closing !== undefined) && !(next && ('friendId' in next) && (next.friendId === closing))) clearViewedFriendBarNotifications(closing);

        setSelectedTab(next);
    };
    // 0 open, 1 collapsed, and in between while `onCollapseAnimationTimer` runs.
    const collapseProgress = useTween(collapsed ? 1 : 0, FRIEND_BAR_COLLAPSE_MS, easeOutCubic);

    // `HabboFriendBarData.onFriendRequestEvent`: an accepted or declined request leaves the bar's own list at once.
    const numRequests = requestsEnabled ? Object.values(requests).filter(request => request.state === FriendRequestStateType.Open).length : 0;
    // `resizeAndPopulate` gives the bar the desktop right of the toolbar before it counts the tabs.
    const maxTabs = maxFriendBarTabs(viewportWidth - toolbarAreaWidth);
    const bar = layoutFriendBar(friends.length, maxTabs, startIndex);
    const shownFriends = friends.slice(bar.startIndex, bar.startIndex + bar.friendTabs);
    const tabs = bar.friendTabs + bar.findFriendsTabs;
    const fullWidth = friendBarWidth(tabs, bar.arrows, collapsed);
    // The part of the bar on screen: all of it open, `friendtools` collapsed, and between the two while it slides.
    const visibleWidth = Math.round(fullWidth + ((FRIEND_BAR_TOOLS_WIDTH - fullWidth) * collapseProgress));

    const page = (direction: -1 | 1) => {
        const next = pageFriendBar(bar.startIndex, direction, friends.length, numRequests, maxTabs);

        if (next === bar.startIndex) return;

        setSelected(null);
        setStartIndex(next);
    };

    /** `toggleCollapsedState`: the other state, saved to the account, with the selection dropped. */
    const toggleCollapsed = () => {
        setSelected(null);
        send(new SetUIFlagsComposer({ flags: setUiFlag(UiFlagEnum.FriendBarExpanded, collapsed) }));
    };

    /** `HabboFriendBarData.toggleFriendList`. */
    const toggleFriendList = () => {
        if (friendListOpen) hideWindow('friendlist');
        else showWindow('friendlist', { tab: (numRequests > 0) ? 'requests' : 'friends' });
    };

    return (
        <Region
            ref={ref}
            name="border"
            onPointerDown={() => setSelected(null)}
            layout={{ position: 'absolute', right: 0, bottom: FRIEND_BAR_BOTTOM_OFFSET, width: visibleWidth, height: FRIEND_BAR_HEIGHT, overflow: 'hidden' }}
        >
            <Box layout={{ position: 'absolute', left: 0, top: 0, width: fullWidth, height: FRIEND_BAR_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' }}>
                <Region
                    name="friendtools"
                    layout={{ position: 'relative', marginTop: 2, width: FRIEND_BAR_TOOLS_WIDTH, height: 46, flexShrink: 0 }}
                >
                    {!collapsed && (
                        <ThemeImage
                            name="line"
                            src={LayoutImage('shared/bottom_bar_divider_1px.png')}
                            bitmap={{}}
                            layout={{ position: 'absolute', left: 1, top: 3, width: 1, height: 40 }}
                        />
                    )}
                    <Region
                        name="icon_all_friends"
                        dynamicStyle="lifted_hover"
                        tooltip={t('friend.bar.friends.title')}
                        cursor="pointer"
                        onPointerTap={toggleFriendList}
                        layout={{ position: 'absolute', left: 18, top: 5, width: 45, height: 41 }}
                    >
                        <ThemeImage
                            dynamicRole="icon"
                            src={LayoutImage('friend-bar/friend_bar_all_friends.png')}
                            bitmap={{ etchingColor: 0x48000000 }}
                            layout={{ position: 'absolute', left: 0, top: 0, width: 32, height: 33 }}
                        />
                        {/* `updateFriendRequestCounter`: its right edge 5 in from the icon's, at its top. */}
                        <UnseenItemCounterView
                            count={numRequests}
                            layout={{ position: 'absolute', right: 5, top: 0 }}
                        />
                    </Region>
                    <Region
                        name="icon_find_friends"
                        dynamicStyle="lifted_hover"
                        tooltip={t('friend.bar.search.title')}
                        cursor="pointer"
                        // `openUserTextSearch`: the friend list on its search tab, or closed if that is where it is.
                        onPointerTap={() => toggleWindow('friendlist', { tab: 'search' })}
                        layout={{ position: 'absolute', left: 64, top: 5, width: 45, height: 41 }}
                    >
                        <ThemeImage
                            dynamicRole="icon"
                            src={LayoutImage('friend-bar/friend_bar_search_habbos.png')}
                            bitmap={{ etchingColor: 0x48000000 }}
                            layout={{ position: 'absolute', left: 0, top: 0, width: 29, height: 33 }}
                        />
                    </Region>
                    <Box layout={{ position: 'absolute', left: 103, top: 5, width: 31, height: 41 }}>
                        <ToolbarMessengerIcon />
                    </Box>
                    {collapsed && (
                        <RoomToolsMinimizeButton
                            layout={{ position: 'absolute', left: 135, top: 0, width: FRIEND_BAR_COLLAPSE_WIDTH, height: 46 }}
                            border={[ 0, 1, 20, 43 ]}
                            arrow={[ 1, 0, 13, 45 ]}
                            onPress={toggleCollapsed}
                        />
                    )}
                </Region>
                {bar.arrows && (
                    <FriendBarPageButton
                        name="button_left_page"
                        direction={-1}
                        enabled={bar.canPageLeft}
                        onPage={() => page(-1)}
                    />
                )}
                <Region
                    name="list"
                    layout={{ position: 'relative', marginTop: 6, flexDirection: 'row', alignItems: 'flex-start', gap: FRIEND_BAR_TAB_SPACING, flexShrink: 0 }}
                >
                    {shownFriends.map(friend => (
                        <FriendBarFriendTab
                            key={friend.playerId}
                            friend={friend}
                            selected={!!selected && ('friendId' in selected) && (selected.friendId === friend.playerId)}
                            onSelect={on => setSelected(on ? { friendId: friend.playerId } : null)}
                        />
                    ))}
                    {Array.from({ length: bar.findFriendsTabs }, (_, findIndex) => (
                        <FriendBarFindFriendsTab
                            key={`find-${findIndex}`}
                            selected={!!selected && ('findIndex' in selected) && (selected.findIndex === findIndex)}
                            onSelect={on => setSelected(on ? { findIndex } : null)}
                        />
                    ))}
                </Region>
                {bar.arrows && (
                    <FriendBarPageButton
                        name="button_right_page"
                        direction={1}
                        enabled={bar.canPageRight}
                        onPage={() => page(1)}
                    />
                )}
                {!collapsed && (
                    // `collapse_right`: `roomtools_minimizebutton` mirrored, while the bar is open.
                    <RoomToolsMinimizeButton
                        layout={{ position: 'relative', marginTop: 2, width: FRIEND_BAR_COLLAPSE_WIDTH, height: 46, flexShrink: 0 }}
                        border={[ 0, 1, 20, 43 ]}
                        arrow={[ 1, 0, 13, 45 ]}
                        mirrored
                        onPress={toggleCollapsed}
                    />
                )}
            </Box>
        </Region>
    );
});

FriendBarView.displayName = 'FriendBarView';
