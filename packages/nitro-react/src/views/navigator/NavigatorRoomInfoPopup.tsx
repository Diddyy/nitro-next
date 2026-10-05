/**
 * The room info bubble the navigator's blue info button opens - `RoomInfoPopup.as`, built from
 * `room_info_popup_bubble` (a style 7 `bubble` pointing left) with one `property` row per room
 * property and one `tag` chip per tag.
 *
 * `populate()` decides what shows:
 * - the owner link when the room shows its owner (`showOwner`), the group link, the group's badge
 *   over the thumbnail and its mode icons when it has a group (`groupBadgeCode != ""`); the row
 *   holding both links only when one of them shows. The mode icons come from the cached group
 *   details (`getCachedGroupDetails`): owner or admin, the group type, and the decorate icon when
 *   members may decorate;
 * - the event box while a room ad runs (`roomAdExpiresInMin > 0`), with its time left as
 *   `FriendlyTime.getFriendlyTime`;
 * - the properties: trading (`RoomTradingLevelEnum.getLocalizationKey`), the ranking only with
 *   `room.ranking.enabled`, and the user limit;
 * - the thumbnail: `newnavigator_default_room`, or with the `NAVIGATOR_ROOM_THUMBNAIL_CAMERA` perk
 *   the room's official picture (`image.library.url`, or `navigator.thumbnail.url_base` +
 *   `<flatId>.png` under `new.navigator.official.room.thumbnails.in.amazon`) or its camera
 *   thumbnail (`navigator.thumbnail.url_base` + `<flatId>.png`);
 * - the settings entry only in the user's own room (`ownerName == sessionData.userName`).
 *
 * The favourite toggle adds and removes, the home toggle only ever sets, and both keep the answer
 * locally until the server's says otherwise (`roomIsFavorite` / `roomIsHome` over
 * `legacyNavigator`) - the favourite for as long as the bubble shows this room, the home until
 * `NavigatorSettingsMessage` names a home room (`refreshHomeState`). Every other link closes the
 * bubble (`destroy()`): the owner's profile, the group's info, a tag search, the room settings.
 *
 * `NavigatorView.update` closes it once it has been up for 4 s, on the first second-tick the mouse
 * is not over it; there is no outside-click close.
 *
 * Not ported: `report_container` / `report_region` (`room.report.enabled`, and not your own room:
 * `habboHelp.reportRoom`) - the report/help subsystem does not exist in this client, so the entry
 * is left out rather than drawn doing nothing, as `RoomInfoView` does with its report button. And
 * the `browse.openroominfo` event log `showAt` tracks.
 */
import { RoomTradeModeEnum } from '@nitrodevco/nitro-api';
import { AddFavouriteRoomComposer, DeleteFavouriteRoomComposer, IRoomInfo, UpdateHomeRoomComposer } from '@nitrodevco/nitro-packets';
import { GetRenderer } from '@nitrodevco/nitro-renderer';
import { Container as PixiContainer } from 'pixi.js';
import { RefObject, useEffect, useRef, useState } from 'react';

import { openGroupInfo, openProfile, searchRoomTag } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useGroupStore } from '#base/context/groups';
import { useNavigatorStore } from '#base/context/navigator';
import { useConfigValue, useHomeRoomId, useInterpolate, useTranslation, useWindowActions } from '#base/context/system';
import { PerkCodes, useOwnPerkAllowed, useUserStore } from '#base/context/user';
import { Border, Bubble, FloatingPopup, LayoutImage, Region, ThemeImage, ThemeText, useTextureFromUrl } from '#base/theme';
import { GetFriendlyTime } from '#base/utils';
import { GroupBadgeImage } from '#base/views/groups/GroupBadgeImage';

/** `room_info_popup_bubble`'s size - `showAt` centres the bubble on `y` by half its height. */
const POPUP_WIDTH = 374;
const POPUP_HEIGHT = 350;

/** `NavigatorView.showRoomInfoBubbleAt` sets the close countdown to 4000; `update` runs every 1000 ms. */
const POPUP_CLOSE_DELAY_MS = 4000;
const POPUP_UPDATE_INTERVAL_MS = 1000;

/** `RoomTradingLevelEnum.getLocalizationKey` - an unknown level has no text. Held to the Flash switch by `drift/constants.py`. */
const TRADING_LEVEL_KEYS: Record<number, string> = {
    [RoomTradeModeEnum.Disabled]: 'trading.mode.not.allowed',
    [RoomTradeModeEnum.RoomOwnerAndRights]: 'trading.mode.controller',
    [RoomTradeModeEnum.Everyone]: 'trading.mode.free',
};

export interface NavigatorRoomInfoPopupProps {
    room: IRoomInfo;
    /** `showAt(true, x, y)`: the pointer's side of the bubble, and the height it is centred on - screen coordinates. */
    x: number;
    y: number;
    /** Changes with every `showRoomInfoBubbleAt`, which restarts the close countdown. */
    serial: number;
    onClose: () => void;
}

/** A `property` row: the bold name, the value 70 px in. */
const PropertyRow = ({ name, value }: { name: string; value: string }) => (
    <Region
        name="room_property"
        layout={{ width: 155, height: 20, flexShrink: 0 }}
    >
        <ThemeText
            name="property_name"
            text={name}
            textStyle="u_regular"
            flashFormat={{ bold: true }}
            clip
            verticalAlign="top"
            layout={{ position: 'absolute', left: 0, width: 70, top: 0, height: 20 }}
        />
        <ThemeText
            name="property_value"
            text={value}
            textStyle="u_regular"
            verticalAlign="top"
            layout={{ position: 'absolute', left: 70, top: 0 }}
        />
    </Region>
);

/**
 * A `tag` chip - `getNewTagItem` adds the layout's `tag_region` itself to `tag_list`: the orange
 * region, which grows round its `auto_size` text (`#` and the tag) at 3, 2.
 */
const TagChip = ({ tag, onTap }: { tag: string; onTap: () => void }) => (
    <Region
        name="tag_region"
        backgroundColor="#f1a700"
        cursor="pointer"
        onPointerTap={onTap}
        layout={{ height: 19, paddingLeft: 3, paddingTop: 2, flexShrink: 0 }}
    >
        <ThemeText
            name="tag_text"
            text={`#${tag}`}
            textStyle="u_small"
            textOptions={{ fill: '#ffffff' }}
            verticalAlign="top"
        />
    </Region>
);

/** One entry of `midBottom_itemlist`: the 20x20 icon region and its label beside it. */
const ToggleRow = ({ name, icon, label, onTap }: { name: string; icon: string; label: string; onTap: () => void }) => (
    <Region layout={{ height: 20, width: 170, flexShrink: 0, overflow: 'hidden' }}>
        <Region
            name={`${name}_region`}
            cursor="pointer"
            onPointerTap={onTap}
            layout={{ position: 'absolute', left: 0, width: 20, top: 0, height: 20 }}
        >
            <ThemeImage
                name={`${name}_icon`}
                src={icon}
                bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                layout={{ position: 'absolute', left: 0, width: 20, top: 0, height: 20 }}
            />
        </Region>
        <ThemeText
            text={label}
            textStyle="u_regular"
            verticalAlign="top"
            layout={{ position: 'absolute', left: 20, top: 0 }}
        />
    </Region>
);

/**
 * `NavigatorView.update`: once the countdown has run out, the first tick the mouse is outside the
 * bubble closes it. The mouse is tracked from here; before it moves it is where it was when the
 * info button was pressed, which is outside the bubble.
 */
const useCloseWhenMouseLeaves = (bubble: RefObject<PixiContainer | null>, serial: number, onClose: () => void) => {
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [ onClose ]);

    useEffect(() => {
        let remaining = POPUP_CLOSE_DELAY_MS;
        let pointer: { x: number; y: number } | undefined;

        const onPointerMove = (event: PointerEvent) => {
            const canvas = GetRenderer().canvas;

            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();

            pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        };

        const interval = window.setInterval(() => {
            remaining -= POPUP_UPDATE_INTERVAL_MS;

            if (remaining >= 0) return;

            const node = bubble.current;

            if (node && pointer && node.getBounds().containsPoint(pointer.x, pointer.y)) return;

            onCloseRef.current();
        }, POPUP_UPDATE_INTERVAL_MS);

        window.addEventListener('pointermove', onPointerMove);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener('pointermove', onPointerMove);
        };
    }, [ bubble, serial ]);
};

export const NavigatorRoomInfoPopup = ({ room, x, y, serial, onClose }: NavigatorRoomInfoPopupProps) => {
    const bubbleRef = useRef<PixiContainer | null>(null);
    const favouriteRoomIds = useNavigatorStore(x => x.favouriteRoomIds);
    const thumbnailCameraAllowed = useOwnPerkAllowed(PerkCodes.NavigatorRoomThumbnailCamera);
    const homeRoomId = useHomeRoomId();
    const userName = useUserStore(x => x.name);
    const groupDetails = useGroupStore(x => ((room.groupId > 0) ? x.detailsById[room.groupId] : undefined));
    const imageLibraryUrl = useConfigValue<string>('image.library.url') ?? '';
    const thumbnailUrlBase = useConfigValue<string>('navigator.thumbnail.url_base') ?? '';
    const rankingEnabled = useConfigValue<boolean>('room.ranking.enabled') === true;
    const officialThumbnailsInAmazon = useConfigValue<boolean>('new.navigator.official.room.thumbnails.in.amazon') === true;
    const { showWindow } = useWindowActions();
    const { send } = useWebSocketContext();
    const interpolate = useInterpolate();
    const t = useTranslation();
    // `roomIsFavorite` / `roomIsHome` set by the toggles; `setData` of another room drops both,
    // which the parent's `key` on the room does here.
    const [ favouriteOverride, setFavouriteOverride ] = useState<boolean>();
    // `refreshHomeState` drops the home answer when `NavigatorSettingsMessage` lands: kept only while the home room it was set over is still the one the store has.
    const [ homeOverride, setHomeOverride ] = useState<{ isHome: boolean; over: number }>();

    useCloseWhenMouseLeaves(bubbleRef, serial, onClose);

    const isFavourite = favouriteOverride ?? favouriteRoomIds.includes(room.roomId);
    const isHome = ((homeOverride?.over === homeRoomId) ? homeOverride.isHome : undefined) ?? (homeRoomId === room.roomId);
    const hasGroup = room.groupBadge !== '';
    const isOwnRoom = room.ownerName === userName;
    const hasEvent = room.adExpiresIn > 0;

    let thumbnailUrl: string | undefined;

    if (thumbnailCameraAllowed) {
        if (room.officialRoomPicRef.length) {
            thumbnailUrl = officialThumbnailsInAmazon
                ? `${thumbnailUrlBase}${room.roomId}.png`
                : `${imageLibraryUrl}${room.officialRoomPicRef}`;
        } else {
            thumbnailUrl = `${thumbnailUrlBase}${room.roomId}.png`;
        }
    }

    // The default picture stays until the thumbnail has loaded (or for good when it does not).
    const thumbnailTexture = useTextureFromUrl(thumbnailUrl);

    let groupModeAdmin: string | undefined;

    if (groupDetails?.isOwner) groupModeAdmin = LayoutImage('habbo-window-manager-com/newnavigator_icon_group_owner.png');
    else if (groupDetails?.isAdmin) groupModeAdmin = LayoutImage('habbo-window-manager-com/newnavigator_icon_group_admin.png');

    const groupModeSize = groupDetails ? `${imageLibraryUrl}guilds/grouptype_icon_${groupDetails.type}.png` : undefined;
    const groupModeFurnish = groupDetails?.membersCanDecorate ? `${imageLibraryUrl}guilds/group_decorate_icon.png` : undefined;

    const properties: { name: string; value: string }[] = [
        { name: t('navigator.roompopup.property.trading'), value: TRADING_LEVEL_KEYS[room.tradeType] ? t(TRADING_LEVEL_KEYS[room.tradeType]) : '' },
    ];

    if (rankingEnabled) properties.push({ name: t('navigator.roompopup.property.ranking'), value: String(room.ranking) });

    properties.push({ name: t('navigator.roompopup.property.max_users'), value: String(room.playersMax) });

    const toggleFavourite = () => {
        send(isFavourite
            ? new DeleteFavouriteRoomComposer({ roomId: room.roomId })
            : new AddFavouriteRoomComposer({ roomId: room.roomId }));

        setFavouriteOverride(!isFavourite);
    };

    const makeHome = () => {
        if (isHome) return;

        send(new UpdateHomeRoomComposer({ roomId: room.roomId }));

        setHomeOverride({ isHome: true, over: homeRoomId });
    };

    return (
        <FloatingPopup
            x={x}
            y={Math.trunc(y - (POPUP_HEIGHT / 2))}
            // Flash has no outside-click close: the countdown closes it, and the info button toggles it.
            onOutsideClick={() => undefined}
        >
            <Bubble
                ref={bubbleRef}
                variant="7"
                pointer="left"
                margins={[ 3, 36, 3, 3 ]}
                layout={{ width: POPUP_WIDTH, height: POPUP_HEIGHT }}
            >
                <Region
                    name="main_content"
                    layout={{ position: 'absolute', left: 11, width: 345, top: -21, flexDirection: 'column', gap: 3 }}
                >
                    <Border
                        variant="2"
                        name="header"
                        layout={{ height: 125, width: 345, flexShrink: 0 }}
                    >
                        <Region
                            name="header_top"
                            layout={{ position: 'absolute', left: 8, width: 329, top: 6, height: 112, overflow: 'hidden', flexDirection: 'row' }}
                        >
                            <Region
                                name="room_thumbnail_container"
                                backgroundColor="#000000"
                                layout={{ width: 112, height: 112, flexShrink: 0 }}
                            >
                                <ThemeImage
                                    name="room_thumbnail"
                                    src={thumbnailTexture ? thumbnailUrl : LayoutImage('habbo-window-manager-com/newnavigator_default_room.png')}
                                    bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                                    layout={{ position: 'absolute', left: 1, width: 110, top: 1, height: 110 }}
                                />
                                {hasGroup && (
                                    <GroupBadgeImage
                                        badgeCode={room.groupBadge}
                                        layout={{ position: 'absolute', left: 1, width: 48, top: 1, height: 48 }}
                                    />
                                )}
                            </Region>
                            <Region
                                name="room_name_desc_owner_container"
                                layout={{ width: 219, height: 112, flexShrink: 0, overflow: 'hidden' }}
                            >
                                <ThemeText
                                    name="room_name"
                                    text={interpolate(room.name)}
                                    textStyle="u_bold"
                                    textOptions={{ wordWrap: true, wordWrapWidth: 210 }}
                                    clip
                                    verticalAlign="top"
                                    layout={{ position: 'absolute', left: 6, width: 214, top: 0, height: 33 }}
                                />
                                <ThemeText
                                    name="room_desc"
                                    text={interpolate(room.description)}
                                    textStyle="u_regular"
                                    textOptions={{ wordWrap: true, wordWrapWidth: 210 }}
                                    clip
                                    verticalAlign="top"
                                    layout={{ position: 'absolute', left: 5, width: 214, top: 33, height: 80 }}
                                />
                            </Region>
                        </Region>
                    </Border>
                    {(hasGroup || room.showOwner) && (
                        <Region
                            name="room_group_owner_container"
                            layout={{ height: 30, width: 344, flexShrink: 0, overflow: 'hidden' }}
                        >
                            {hasGroup && (
                                <Region
                                    name="room_group_region"
                                    tooltip={t('navigator.tooltip.groupinfo.owner')}
                                    cursor="pointer"
                                    onPointerTap={() => {
                                        openGroupInfo(send, room.groupId);
                                        onClose();
                                    }}
                                    layout={{ position: 'absolute', left: 175, width: 170, top: 3, height: 30, overflow: 'hidden' }}
                                >
                                    <ThemeImage
                                        src={LayoutImage('habbo-window-manager-com/newnavigator_icon_group.png')}
                                        bitmap={{ pivot: 'center' }}
                                        layout={{ position: 'absolute', left: 0, width: 15, top: 0, height: 13 }}
                                    />
                                    <ThemeText
                                        name="group_name"
                                        text={room.groupName}
                                        textStyle="u_bold"
                                        textOptions={{ wordWrap: true, wordWrapWidth: 166 }}
                                        flashFormat={{ underline: true }}
                                        clip
                                        verticalAlign="top"
                                        layout={{ position: 'absolute', left: 20, width: 170, top: 0, height: 33 }}
                                    />
                                </Region>
                            )}
                            {room.showOwner && (
                                <Region
                                    name="room_owner_region"
                                    tooltip={t('navigator.tooltip.roominfo.owner')}
                                    cursor="pointer"
                                    onPointerTap={() => {
                                        openProfile(send, room.ownerId);
                                        onClose();
                                    }}
                                    layout={{ position: 'absolute', left: 5, width: 150, top: 3, height: 30, overflow: 'hidden' }}
                                >
                                    <ThemeImage
                                        src={LayoutImage('habbo-window-manager-com/friend_bar_friendlist_eye.png')}
                                        bitmap={{ pivot: 'center' }}
                                        layout={{ position: 'absolute', left: 0, width: 15, top: 0, height: 13 }}
                                    />
                                    <ThemeText
                                        name="owner_name"
                                        text={room.ownerName}
                                        textStyle="u_bold"
                                        textOptions={{ wordWrap: true, wordWrapWidth: 126 }}
                                        flashFormat={{ underline: true }}
                                        clip
                                        verticalAlign="top"
                                        layout={{ position: 'absolute', left: 20, width: 130, top: -2, height: 33 }}
                                    />
                                </Region>
                            )}
                        </Region>
                    )}
                    <Region
                        name="newMid"
                        layout={{ height: 80, width: 344, flexShrink: 0 }}
                    >
                        <Region
                            name="mid"
                            layout={{ position: 'absolute', left: 0, width: 174, top: 0, height: 65, overflow: 'hidden' }}
                        >
                            <Region
                                name="properties"
                                layout={{ position: 'absolute', left: 0, width: 263, top: 0, height: 65, flexDirection: 'column' }}
                            >
                                {properties.map(property => (
                                    <PropertyRow
                                        key={property.name}
                                        name={property.name}
                                        value={property.value}
                                    />
                                ))}
                            </Region>
                        </Region>
                        <Region
                            name="midBottom"
                            layout={{ position: 'absolute', left: 166, width: 170, top: 0, height: 80, overflow: 'hidden' }}
                        >
                            <Region
                                name="midBottom_itemlist"
                                layout={{ position: 'absolute', left: 12, width: 170, top: 0, flexDirection: 'column' }}
                            >
                                <ToggleRow
                                    name="favorite"
                                    icon={LayoutImage(isFavourite ? 'habbo-window-manager-com/newnavigator_icon_fav_yes.png' : 'habbo-window-manager-com/newnavigator_icon_fav_no.png')}
                                    label={t('navigator.room.popup.room.info.favorite')}
                                    onTap={toggleFavourite}
                                />
                                <ToggleRow
                                    name="home"
                                    icon={LayoutImage(isHome ? 'habbo-window-manager-com/newnavigator_icon_home_yes.png' : 'habbo-window-manager-com/newnavigator_icon_home_no.png')}
                                    label={t('navigator.room.popup.room.info.home')}
                                    onTap={makeHome}
                                />
                                {isOwnRoom && (
                                    <ToggleRow
                                        name="settings"
                                        icon={LayoutImage('habbo-window-manager-com/newnavigator_room_settings_icon.png')}
                                        label={t('navigator.room.popup.info.room.settings')}
                                        onTap={() => {
                                        // `RoomSettingsCtrl.startRoomSettingsEditFromNavigator(flatId, habboGroupId)`;
                                        // the parser's -1 for "no group" is Flash's 0.
                                            showWindow('room_settings', { roomId: room.roomId, groupId: Math.max(0, room.groupId) });
                                            onClose();
                                        }}
                                    />
                                )}
                            </Region>
                        </Region>
                    </Region>
                    <Region
                        name="bottom_itemlist"
                        layout={{ width: 345, flexShrink: 0, flexDirection: 'column' }}
                    >
                        <Region
                            name="tag_and_group_info"
                            layout={{ height: 23, width: 345, flexShrink: 0 }}
                        >
                            <Region
                                name="tag_list"
                                layout={{ position: 'absolute', left: 0, width: 200, top: 0, height: 20, flexDirection: 'row', gap: 2, overflow: 'hidden' }}
                            >
                                {room.tags.map(tag => (
                                    <TagChip
                                        key={tag}
                                        tag={tag}
                                        onTap={() => {
                                            searchRoomTag(send, tag);
                                            onClose();
                                        }}
                                    />
                                ))}
                            </Region>
                            {hasGroup && groupModeFurnish && (
                                <ThemeImage
                                    name="group_mode_furnish"
                                    src={groupModeFurnish}
                                    bitmap={{}}
                                    layout={{ position: 'absolute', left: 318, width: 18, top: 0, height: 16 }}
                                />
                            )}
                            {hasGroup && groupModeAdmin && (
                                <ThemeImage
                                    name="group_mode_admin"
                                    src={groupModeAdmin}
                                    bitmap={{}}
                                    layout={{ position: 'absolute', left: 279, width: 18, top: 0, height: 16 }}
                                />
                            )}
                            {hasGroup && groupModeSize && (
                                <ThemeImage
                                    name="group_mode_size"
                                    src={groupModeSize}
                                    bitmap={{}}
                                    layout={{ position: 'absolute', left: 299, width: 18, top: 0, height: 16 }}
                                />
                            )}
                        </Region>
                        {hasEvent && (
                            <Border
                                variant="3"
                                name="event_info"
                                tintColor="#f1a700"
                                blend={0.7}
                                layout={{ height: 55, width: 331, marginLeft: 7, flexShrink: 0 }}
                            >
                                <ThemeImage
                                    src={LayoutImage('habbo-window-manager-com/newnavigator_event_icon.png')}
                                    bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                                    layout={{ position: 'absolute', left: 6, width: 42, top: 9, height: 40 }}
                                />
                                <ThemeText
                                    name="event_name"
                                    text={`${t('navigator.eventsettings.name')}: ${room.adName}`}
                                    textStyle="u_bold"
                                    textOptions={{ fill: '#ffffff' }}
                                    clip
                                    verticalAlign="top"
                                    layout={{ position: 'absolute', left: 54, width: 275, top: 3, height: 16 }}
                                />
                                <ThemeText
                                    name="event_desc"
                                    text={`${t('navigator.eventsettings.desc')}: ${room.adDescription}\n${t('roomad.event.expiration_time')}${GetFriendlyTime(t, room.adExpiresIn * 60)}`}
                                    textStyle="u_bold"
                                    textOptions={{ fill: '#ffffff', wordWrap: true, wordWrapWidth: 271 }}
                                    flashFormat={{ bold: false }}
                                    clip
                                    verticalAlign="top"
                                    layout={{ position: 'absolute', left: 54, width: 275, top: 19, height: 36 }}
                                />
                            </Border>
                        )}
                    </Region>
                </Region>
            </Bubble>
        </FloatingPopup>
    );
};
