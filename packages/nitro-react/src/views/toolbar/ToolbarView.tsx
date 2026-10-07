/**
 * The bottom bar - `toolbar/BottomBackgroundBorder` on the `bottom_background_border` layout (the
 * style 9 border across the desktop) with `toolbar/BottomBarLeft` on `bottom_bar_left` over it: the
 * collapse arrow, then `toolbar_items` - 45-wide `lifted_hover` regions 8 apart, each icon an
 * unstretched, centred, etched bitmap at the rectangle the layout gives it - and the divider line.
 * The me menu and progression buttons open `ToolbarExtendedMenu` (`MeMenuNewController` /
 * `ProgMenuController`).
 *
 * Which icons show follows `BottomBarLeft.setToolbarState`: each `bottom_bar_left` region is
 * tagged with the states it shows in, and the port reads them off its own landing view and
 * collapse state. On the hotel view (`VISIBLE_HOTEL`) that is home, navigator, catalogue,
 * Builders Club and the me menu; in a room (`VISIBLE_ROOM`) reception replaces home and
 * progression, inventory, wired menu and camera join; collapsed (`VISIBLE_COLLAPSED`) keeps
 * catalogue, Builders Club, inventory, me menu, wired menu and camera. On top of the tags,
 * Builders Club needs `builders.club.enabled` (unless collapsed) and the camera needs a room,
 * `camera.launch.ui.position` of `bottom-icons` and the `CAMERA` perk. Games and stories
 * (`games_icon_enabled`, `toolbar.stories.enabled`) are not ported. The collapse arrow is the layout's own: `collapse_left` / `collapse_right` - the
 * room tools' `roomtools_minimizebutton` in a 13x45 box at (1, 0) of a 15-wide region at (0, -1)
 * - over the unnamed style 2 border in `0x3b3933` at (-6, 0), 20x43, of which the window's left
 * edge leaves the right 14 with its rounded corners. Expanded it points left; collapsed it is
 * `icons_toolbar_collapse_right`, mirrored and etched. The right-hand end is the friend bar
 * (`FriendBarView`).
 *
 * The inventory icon carries the unseen item count (`HabboToolbar.onUnseenItemsUpdate` ->
 * `BottomBarLeft.setUnseenItemCount('HTIE_ICON_INVENTORY', inventoryCount)`): the window manager's
 * counter, its right edge on the icon region's and its top on the region's top
 * (`getUnseenItemCounter`: `x = width - counter.width`, `y = 0`). The games icon's count
 * (category 6) has no icon to go on here.
 *
 * Collapsing slides rather than switches (`BottomBarLeft.onCollapseToolsBar` ->
 * `startCollapseAnimation`, `onAnimationTimer`): over 140 ms, eased `1 - (1 - t)^3`, the icons that
 * only the expanded bar shows fade out where they stand (`applyAnimatedToggleLayout`: `blend`
 * `1 - t`, or `t` coming back) while the rest move to their new x and the bar narrows with them.
 * The arrows are `TOGGLE` items too, and `checkSize` only swaps them when the state lands at the
 * end, so the left arrow fades out with the icons on the way in and the right one holds until the
 * end on the way out. A press while it runs is ignored, as Flash's is.
 *
 * The inventory icon (`icons_toolbar_inventory`, its bitmap) and the me menu (`MEMENU`, the whole
 * region) are what `animateToIcon` flies pictures into (`createTransitionToIcon`), and what bounces
 * as one lands: `Queue(Wait(duration + 8), DropBounce(icon, 400, 12))` lifts it 12 px and lets it
 * fall back with a bounce.
 */
import { CatalogTypeEnum } from '@nitrodevco/nitro-api';
import { QuitComposer } from '@nitrodevco/nitro-packets';
import { GetTicker } from '@nitrodevco/nitro-renderer';
import { Container as PixiContainer, Ticker } from 'pixi.js';
import { ReactNode, useCallback, useEffect, useState } from 'react';

import { goToHomeRoom, openClientLink, openProfile, showOwnRooms, toggleCatalog } from '#base/commands';
import { AvatarImage } from '#base/components';
import { unseenSkipped, useAchievementsStore } from '#base/context/achievements';
import { useWebSocketContext } from '#base/context/communication';
import { useInventoryUnseenTotalCount } from '#base/context/inventory';
import { useMessengerStore } from '#base/context/messenger';
import { ToolbarTransitionIcon, useConfigValue, useIsLandingViewVisible, useSystemActions, useSystemStore, useTranslation } from '#base/context/system';
import { PerkCodes, useOwnPerkAllowed, useOwnUserFigure, useOwnUserGender, useOwnUserId } from '#base/context/user';
import { useWiredShowToolbarMenuButton } from '#base/context/wired';
import { easeOutCubic, useTween } from '#base/hooks';
import { Border, Box, LayoutImage, Region, ThemeImage, useLayoutEvent } from '#base/theme';
import { FriendBarView } from '#base/views/friend-bar/FriendBarView';
import { RoomToolsMinimizeButton } from '#base/views/room-widgets/room-tools/RoomToolsMinimizeButton';
import { UnseenItemCounterView } from '#base/views/system/UnseenItemCounterView';

import { ME_MENU_HEIGHT, PROG_MENU_HEIGHT, ToolbarExtendedMenu } from './ToolbarExtendedMenu';

/** `bottom_background_border`: 54 high, 3 of it below the desktop (`updatePosition`). */
const BACKGROUND_HEIGHT = 54;
/** `bottom_bar_left`: the window's height, and so its distance from the desktop's bottom (`checkSize`). */
const BAR_HEIGHT = 46;
/** Every `toolbar_items` region is 45 wide. */
const ITEM_WIDTH = 45;
/** `toolbar_items`' `spacing`. */
const ITEM_SPACING = 8;
/** `BottomBarLeft.COLLAPSE_ANIMATION_DURATION_MS`. */
const COLLAPSE_ANIMATION_DURATION_MS = 140;
/** `animateToIcon`'s `DropBounce(icon, 400, 12)`. */
const BOUNCE_DURATION_MS = 400;
const BOUNCE_HEIGHT = 12;

/** `DropBounce.getBounceOffset`: how far down the drop is, 0 to 1, bouncing as it lands. */
const getBounceOffset = (progress: number): number => {
    if (progress < 0.364) return 7.5625 * progress * progress;

    if (progress < 0.727) {
        const k = progress - 0.545;

        return (7.5625 * k * k) + 0.75;
    }

    if (progress < 0.909) {
        const k = progress - 0.9091;

        return (7.5625 * k * k) + 0.9375;
    }

    const k = progress - 0.955;

    return (7.5625 * k * k) + 0.984375;
};

/**
 * A transition target: registers its window for `createTransitionToIcon` to aim at, and answers
 * how far up the `ToolBarBouncing[ <icon> ]` motion holds it - nothing through the wait, the full
 * 12 px as the `DropBounce` starts, nothing again (`stop()`) once it ends.
 */
const useToolbarTransitionTarget = (icon: ToolbarTransitionIcon | undefined) => {
    const { setToolbarIconNode, setToolbarIconBounce } = useSystemActions();
    const waitMs = useSystemStore(x => (icon ? x.toolbarIconBounces[icon] : undefined));
    const [ lift, setLift ] = useState(0);

    const attachTarget = useCallback((node: PixiContainer | null) => {
        if (icon) setToolbarIconNode(icon, node);
    }, [ icon, setToolbarIconNode ]);

    useEffect(() => {
        if (!icon || (waitMs === undefined)) return;

        let elapsed = 0;

        const tick = (ticker: Ticker) => {
            elapsed += ticker.deltaMS;

            if (elapsed < waitMs) return;

            const progress = (elapsed - waitMs) / BOUNCE_DURATION_MS;

            if (progress < 1) {
                setLift(Math.round(BOUNCE_HEIGHT - (getBounceOffset(progress) * BOUNCE_HEIGHT)));

                return;
            }

            setToolbarIconBounce(icon, undefined);
        };

        GetTicker().add(tick);

        return () => {
            GetTicker().remove(tick);
            setLift(0);
        };
    }, [ icon, waitMs, setToolbarIconBounce ]);

    return { attachTarget, lift };
};

interface ToolbarItemProps {
    tooltip: string;
    onPointerTap?: () => void;
    /** The layout image of the region's `ICON_BMP` static bitmap. */
    src: string;
    /** That bitmap's `[ x, y, width, height ]` in its region. */
    icon: [ number, number, number, number ];
    /** The region's height: 41, or 43 / 45 for the icons that reach lower. */
    height?: number;
    /** What the region holds over its icon - the unseen item counter. */
    children?: ReactNode;
    /** The transitions aimed at this icon's bitmap. */
    transitionIcon?: ToolbarTransitionIcon;
}

/** One `lifted_hover` region of `toolbar_items`, its icon where `bottom_bar_left` places it. */
const ToolbarItem = ({ tooltip, onPointerTap, src, icon: [ x, y, width, height ], height: itemHeight = 41, children, transitionIcon }: ToolbarItemProps) => {
    const { attachTarget, lift } = useToolbarTransitionTarget(transitionIcon);

    return (
        <Region
            dynamicStyle="lifted_hover"
            onPointerTap={onPointerTap}
            tooltip={tooltip}
            cursor="pointer"
            layout={{ width: ITEM_WIDTH, height: itemHeight, flexShrink: 0 }}
        >
            <ThemeImage
                ref={attachTarget}
                dynamicRole="icon"
                src={LayoutImage(src)}
                bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center', etchingColor: 0x48000000 }}
                layout={{ position: 'absolute', left: x, top: y - lift, width, height }}
            />
            {children}
        </Region>
    );
};

interface ToolbarToggleSlotProps {
    /** How much of the icon is left: 1 in the expanded bar, 0 in the collapsed one. */
    shown: number;
    /** How many of the other expanded-only icons come before this one. */
    index: number;
    children: ReactNode;
}

/**
 * An icon only the expanded bar shows, while the bar folds: its slot narrows so the icons after it
 * move up, and it fades where it stood - `applyAnimatedToggleLayout` keeps a hidden item's x - so
 * it is drawn back by as much as the slots before it have given up. Settled, it is just the icon.
 */
const ToolbarToggleSlot = ({ shown, index, children }: ToolbarToggleSlotProps) => {
    if (shown >= 1) return children;

    const slotWidth = Math.round((ITEM_WIDTH + ITEM_SPACING) * shown);

    return (
        <Box
            alpha={shown}
            layout={{ width: slotWidth, marginRight: -ITEM_SPACING, height: 41, flexShrink: 0 }}
        >
            <Box layout={{ position: 'absolute', left: (ITEM_WIDTH + ITEM_SPACING - slotWidth) * index, top: 0 }}>
                {children}
            </Box>
        </Box>
    );
};

export const ToolbarView = () => {
    const [ isMeExpanded, setMeExpanded ] = useState(false);
    const [ isProgressionExpanded, setProgressionExpanded ] = useState(false);
    const [ leftSideCollapsed, setLeftSideCollapsed ] = useState(false);
    // 0 expanded, 1 collapsed, and in between while `onAnimationTimer` runs.
    const collapseProgress = useTween(leftSideCollapsed ? 1 : 0, COLLAPSE_ANIMATION_DURATION_MS, easeOutCubic);
    const collapseRunning = collapseProgress !== (leftSideCollapsed ? 1 : 0);
    // The icons only the expanded bar shows are tagged for every state but `VISIBLE_COLLAPSED`.
    const expandedOnlyShown = 1 - collapseProgress;
    // `checkSize` swaps the arrows when the new state is set, at the end of the run.
    const arrowCollapsed = collapseRunning ? !leftSideCollapsed : leftSideCollapsed;
    const ownFigure = useOwnUserFigure();
    const ownGender = useOwnUserGender();
    const ownUserId = useOwnUserId();
    const { toggleWindow, endRoomSession, setToolbarWidths } = useSystemActions();
    // The two groups are measured for the chat bar, which fits itself between them - `toolBarAreaWidth` / `friendBarWidth`.
    const [ leftGroup, setLeftGroup ] = useState<PixiContainer | null>(null);
    const [ rightGroup, setRightGroup ] = useState<PixiContainer | null>(null);
    const reportWidths = () => setToolbarWidths(Math.ceil(leftGroup?.layout?.computedLayout.width ?? leftGroup?.width ?? 0), Math.ceil(rightGroup?.layout?.computedLayout.width ?? rightGroup?.width ?? 0));

    useLayoutEvent(leftGroup, reportWidths);
    useLayoutEvent(rightGroup, reportWidths);
    const landingViewVisible = useIsLandingViewVisible();
    // `setToolbarState`'s `_local_4`: a room state, or collapsed from one.
    const inRoom = !landingViewVisible;
    const buildersClubEnabled = useConfigValue<boolean>('builders.club.enabled') === true;
    // `BottomBarLeft`: the wired menu icon is a room icon, and only for someone `showToolbarMenuButton` lets see it.
    const showWiredMenuButton = useWiredShowToolbarMenuButton() && !landingViewVisible;
    // `BottomBarLeft`: the camera icon too is a room icon, drawn only where `camera.launch.ui.position` puts it and with the `CAMERA` perk.
    const cameraLaunchPosition = useConfigValue<string>('camera.launch.ui.position');
    const cameraAllowed = useOwnPerkAllowed(PerkCodes.Camera);
    const showCameraButton = !landingViewVisible && (cameraLaunchPosition === 'bottom-icons') && cameraAllowed;
    const { send } = useWebSocketContext();
    const t = useTranslation();
    // `MeMenuNewController`: the collectibles button is hidden unless both hub flags are on.
    const classicCollectiblesHubEnabled = useConfigValue<boolean>('classic.collectibles.hub.enabled') === true;
    const collectiblesHubEnabled = useConfigValue<boolean>('collectibles.hub.enabled') === true;
    const unseenInventoryCount = useInventoryUnseenTotalCount();
    const unseenMiniMailCount = useMessengerStore(x => x.miniMailUnreadCount);
    const { attachTarget: attachMeMenuTarget, lift: meMenuLift } = useToolbarTransitionTarget('HTIE_ICON_MEMENU');

    // HabboLandingView.onToolbarClick HTIE_ICON_RECEPTION: quit and dispose the room session right away (RSE_ENDED shows the hotel view)
    const goToHotelView = () => {
        send(new QuitComposer({}));
        endRoomSession();
    };

    const skippedBadges = useConfigValue<string>('toolbar.unseen_notification.skipped_badge_ids');
    // `broadcastUnseenAchievementsCount`: unseen entries whose badge is not skipped.
    const unseenAchievements = useAchievementsStore(x => x.unseen.filter(entry => !unseenSkipped(entry.badgeId, skippedBadges === undefined ? [] : skippedBadges.split(','))).length);

    const toggleMenu = (menu: 'me' | 'progression') => {
        setMeExpanded(menu === 'me' && !isMeExpanded);
        setProgressionExpanded(menu === 'progression' && !isProgressionExpanded);
    };

    return (
        <>
            <Region layout={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: BACKGROUND_HEIGHT }}>
                {/* `BottomBackgroundBorder.updatePosition`: x -10, `desktop.height - (height - 3)`, `desktop.width + 20` wide. */}
                <Border
                    variant="9"
                    tintColor="#686661"
                    layout={{ position: 'absolute', left: -10, right: -10, top: 3, height: BACKGROUND_HEIGHT }}
                />
                <Region
                    ref={setLeftGroup}
                    layout={{ position: 'absolute', left: 0, top: BACKGROUND_HEIGHT - BAR_HEIGHT, height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' }}
                >
                    {/*
                      * `arrow_container_left` fades with the icons as the bar collapses; `arrow_container_right`
                      * is in every state, so the collapsed arrow never fades.
                      */}
                    <RoomToolsMinimizeButton
                        layout={{ width: 15, height: 45, marginTop: -1, flexShrink: 0 }}
                        border={[ -6, 1, 20, 43 ]}
                        arrow={[ 1, 0, 13, 45 ]}
                        mirrored={arrowCollapsed}
                        etched={arrowCollapsed}
                        alpha={arrowCollapsed ? 1 : expandedOnlyShown}
                        onPress={() => {
                            // `onCollapseToolsBar` returns while the timer runs.
                            if (!collapseRunning) setLeftSideCollapsed(!leftSideCollapsed);
                        }}
                    />
                    {/* `toolbar_items`: a boxsizer at x 19, `spacing` 8, `padding_vertical` 1. */}
                    <Region layout={{ flexDirection: 'row', alignItems: 'flex-start', gap: ITEM_SPACING, marginLeft: 4, paddingTop: 1, paddingBottom: 1, height: BAR_HEIGHT }}>
                        {(expandedOnlyShown > 0) && (
                            <ToolbarToggleSlot
                                shown={expandedOnlyShown}
                                index={0}
                            >
                                {!landingViewVisible && (
                                    <ToolbarItem
                                        tooltip={t('toolbar.icon.tooltip.exitroom.hotelview')}
                                        onPointerTap={goToHotelView}
                                        src="habbo-window-manager-com/bottom_bar_logo.png"
                                        icon={[ 8, 5, 28, 28 ]}
                                    />
                                )}
                                {landingViewVisible && (
                                    <ToolbarItem
                                        tooltip={t('toolbar.icon.tooltip.exitroom.home')}
                                        // HTIE_ICON_HOME -> goToHomeRoom(): a room forward to the home room (its GetGuestRoomResult starts the session)
                                        onPointerTap={() => goToHomeRoom(send)}
                                        src="habbo-window-manager-com/bottom_bar_home.png"
                                        icon={[ 6, 5, 32, 30 ]}
                                    />
                                )}
                            </ToolbarToggleSlot>
                        )}
                        {(expandedOnlyShown > 0) && (
                            <ToolbarToggleSlot
                                shown={expandedOnlyShown}
                                index={1}
                            >
                                <ToolbarItem
                                    tooltip={t('toolbar.icon.label.navigator')}
                                    onPointerTap={() => toggleWindow('navigator')}
                                    src="habbo-window-manager-com/bottom_bar_navigator.png"
                                    icon={[ 0, 5, 44, 30 ]}
                                />
                            </ToolbarToggleSlot>
                        )}
                        {/* `PROGRESSION` is tagged `VISIBLE_ROOM` only. */}
                        {(expandedOnlyShown > 0) && inRoom && (
                            <ToolbarToggleSlot
                                shown={expandedOnlyShown}
                                index={2}
                            >
                                <ToolbarItem
                                    tooltip={t('toolbar.icon.label.progression')}
                                    onPointerTap={() => toggleMenu('progression')}
                                    src="habbo-window-manager-com/bottom_bar_progression.png"
                                    icon={[ 0, 0, 44, 37 ]}
                                >
                                    {unseenAchievements > 0 && (
                                        <UnseenItemCounterView
                                            count={unseenAchievements}
                                            layout={{ position: 'absolute', right: 0, top: 0 }}
                                        />
                                    )}
                                </ToolbarItem>
                            </ToolbarToggleSlot>
                        )}
                        <ToolbarItem
                            tooltip={t('toolbar.icon.label.catalogue')}
                            onPointerTap={() => toggleCatalog(CatalogTypeEnum.Normal)}
                            src="habbo-window-manager-com/bottom_bar_shop.png"
                            icon={[ 4, 1, 37, 37 ]}
                        />
                        {/* `BUILDER`: `builders.club.enabled` decides it, except in the collapsed bar. */}
                        {(leftSideCollapsed || buildersClubEnabled) && (
                            <ToolbarItem
                                tooltip={t('toolbar.icon.label.builder')}
                                onPointerTap={() => toggleCatalog(CatalogTypeEnum.BuildersClub)}
                                src="habbo-window-manager-com/bottom_bar_buildersclub.png"
                                icon={[ 5, 1, 35, 37 ]}
                            />
                        )}
                        {/* `INVENTORY` is tagged `VISIBLE_ROOM` and `VISIBLE_COLLAPSED`, not `VISIBLE_HOTEL`. */}
                        {(inRoom || leftSideCollapsed) && (
                            <ToolbarItem
                                tooltip={t('toolbar.icon.label.inventory')}
                                onPointerTap={() => toggleWindow('inventory')}
                                src="habbo-window-manager-com/bottom_bar_inventory.png"
                                height={43}
                                icon={[ 0, 0, 44, 41 ]}
                                transitionIcon="HTIE_ICON_INVENTORY"
                            >
                                <UnseenItemCounterView
                                    count={unseenInventoryCount}
                                    layout={{ position: 'absolute', right: 0, top: 0 }}
                                />
                            </ToolbarItem>
                        )}
                        <Region
                            ref={attachMeMenuTarget}
                            dynamicStyle="lifted_hover"
                            onPointerTap={() => toggleMenu('me')}
                            tooltip={t('toolbar.icon.label.memenu')}
                            cursor="pointer"
                            layout={{ width: ITEM_WIDTH, height: 45, flexShrink: 0, overflow: 'hidden', top: -meMenuLift }}
                        >
                            <ThemeImage
                                src={LayoutImage('habbo-window-manager-com/bottom_bar_memenu_bg.png')}
                                bitmap={{ stretchedX: false, stretchedY: false }}
                                alpha={0.9}
                                layout={{ position: 'absolute', left: 0, top: -1, width: 45, height: 45 }}
                            />
                            {/* `icon_me_menu` (44 x 41 at 1, -1): the head `MeMenuNewIconLoader` draws. */}
                            <Region
                                dynamicRole="icon"
                                layout={{ position: 'absolute', left: 1, top: -1, width: 44, height: 41, justifyContent: 'center', overflow: 'hidden' }}
                            >
                                <AvatarImage
                                    figure={ownFigure}
                                    gender={ownGender}
                                    direction={3}
                                    headOnly
                                    layout={{ marginTop: -34, marginLeft: -1 }}
                                />
                            </Region>
                            <ThemeImage
                                src={LayoutImage('habbo-window-manager-com/bottom_bar_memenu_circle.png')}
                                bitmap={{ stretchedX: false, stretchedY: false }}
                                layout={{ position: 'absolute', left: 0, top: -1, width: 45, height: 45 }}
                            />
                            {/* `setUnseenItemCount('HTIE_ICON_MEMENU', unseenMeMenuCount)`: unread mini mail (the forums' count is not ported). */}
                            <UnseenItemCounterView
                                count={unseenMiniMailCount}
                                layout={{ position: 'absolute', right: 0, top: 0 }}
                            />
                        </Region>
                        {showWiredMenuButton && (
                            <ToolbarItem
                                tooltip={t('toolbar.icon.label.wired_menu')}
                                onPointerTap={() => toggleWindow('wired_menu')}
                                src="habbo-window-manager-com/bottom_bar_wired_menu.png"
                                height={45}
                                icon={[ 3, 0, 38, 45 ]}
                            />
                        )}
                        {showCameraButton && (
                            <ToolbarItem
                                tooltip={t('camera.interface.title')}
                                src="habbo-window-manager-com/bottom_bar_camera.png"
                                height={45}
                                icon={[ 3, 0, 38, 45 ]}
                            />
                        )}
                        <ThemeImage
                            name="line"
                            src={LayoutImage('habbo-window-manager-com/bottom_bar_divider_1px.png')}
                            bitmap={{}}
                            layout={{ width: 1, height: 40, flexShrink: 0 }}
                        />
                    </Region>
                </Region>
                <FriendBarView ref={setRightGroup} />
            </Region>
            {isMeExpanded && (
                <ToolbarExtendedMenu
                    height={ME_MENU_HEIGHT}
                    buttons={[
                        { icon: 'me_menu_me_profile', caption: t('widget.memenu.profile'), action: () => openProfile(send, ownUserId) },
                        // `MeMenuNewController.onSubMenuItemClick('rooms')`: `navigator.showOwnRooms()`.
                        { icon: 'me_menu_me_rooms', caption: t('widget.memenu.myrooms'), action: () => showOwnRooms(send) },
                        { icon: 'me_menu_me_clothing', caption: t('widget.memenu.editavatar'), action: () => toggleWindow('avatar_editor') },
                        { icon: 'me_menu_me_forums', caption: t('widget.memenu.forums') },
                        // `onSubMenuItemClick('collectibles')`: `createLinkEvent('collectibles/open')`.
                        ...((classicCollectiblesHubEnabled && collectiblesHubEnabled) ? [ { icon: 'me_menu_me_cabinet', caption: t('memenu.collectibles'), action: () => openClientLink(send, 'collectibles/open') } ] : []),
                    ]}
                    onSelect={() => setMeExpanded(false)}
                />
            )}
            {isProgressionExpanded && (
                <ToolbarExtendedMenu
                    height={PROG_MENU_HEIGHT}
                    buttons={[
                        { icon: 'prog_menu_daily_tasks', caption: t('widget.progmenu.dailytasks') },
                        { icon: 'prog_menu_quests', caption: t('widget.progmenu.quests') },
                        { icon: 'me_menu_me_achv', caption: t('widget.progmenu.achievements'), action: () => openClientLink(send, 'questengine/achievements') },
                        { icon: 'prog_menu_leaderboards', caption: t('widget.progmenu.leaderboards') },
                        { icon: 'prog_menu_introduction', caption: t('widget.progmenu.introduction') },
                    ]}
                    onSelect={() => setProgressionExpanded(false)}
                />
            )}
        </>
    );
};
