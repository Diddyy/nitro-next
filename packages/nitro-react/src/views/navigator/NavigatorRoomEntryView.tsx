import { IRoomInfo } from '@nitrodevco/nitro-packets';
import { FederatedPointerEvent } from 'pixi.js';

import { useInterpolate, useTranslation } from '#base/context/system';
import { Border, getGlobalRect, LayoutImage, Region, ThemeImage, ThemeText, useTextureFromUrl } from '#base/theme';

import { RESULTS_MODE_TILES } from './NavigatorCategoryView';
import { getUserCountColor } from './NavigatorRoomEntryUtils';

/** `RoomEntryUtils.getDoorModeIconAsset` - `switch(doorMode - 1)`, an empty asset for an open door. */
const DOOR_MODE_IMAGES: Record<number, string> = {
    1: LayoutImage('habbo-window-manager-com/newnavigator_doormode_doorbell_small.png'),
    2: LayoutImage('habbo-window-manager-com/newnavigator_doormode_password_small.png'),
    3: LayoutImage('habbo-window-manager-com/newnavigator_doormode_invisible_small.png'),
};

/**
 * `NavigatorView.showRoomInfoBubbleAt(room, x, y, hover)`: `x` / `y` are the screen point the
 * bubble's pointer goes to. A click toggles the bubble; a hover (`hover`) only moves one already up.
 */
export type NavigatorShowRoomInfo = (room: IRoomInfo, x: number, y: number, hover: boolean) => void;

export interface NavigatorRoomEntryViewProps {
    room: IRoomInfo;
    mode: number;
    backgroundColor: string;
    onEnter: (room: IRoomInfo) => void;
    onShowInfo?: NavigatorShowRoomInfo;
}

/**
 * The point `RoomEntryElementFactory` hands `showRoomInfoBubbleAt` for a region: its right edge
 * plus `dx`, its vertical centre plus `dy` - (0, 0) for `info_popup_click_region`, (20, 0) for a
 * row's `go_to_room_region` and (-6, 56) for a tile's.
 */
const showInfoFrom = (event: FederatedPointerEvent, room: IRoomInfo, onShowInfo: NavigatorShowRoomInfo | undefined, hover: boolean, dx: number = 0, dy: number = 0) => {
    if (!onShowInfo) return;

    const rect = getGlobalRect(event.currentTarget);

    onShowInfo(room, rect.x + rect.width + dx, rect.y + (rect.height / 2) + dy, hover);
};

/** `room_info_usercount_border`: a style 3 border in `getUserCountColor`, holding the `usercount` list (icon, then the count). */
const UserCount = ({ room, left, top }: { room: IRoomInfo; left: number; top: number }) => (
    <Border
        variant="3"
        name="room_info_usercount_border"
        tintColor={getUserCountColor(room.population, room.playersMax)}
        layout={{ position: 'absolute', left, width: 40, top, height: 18 }}
    >
        <Region
            name="usercount"
            layout={{ position: 'absolute', left: 3, top: 1, height: 15, flexDirection: 'row', gap: 1 }}
        >
            <ThemeImage
                name="room_usercount_icon"
                src={LayoutImage('habbo-window-manager-com/newnavigator_icon_usercount.png')}
                // The layout gives it a 13x14 box and no vars, so the 18x18 art is stretched into it.
                bitmap={{}}
                layout={{ width: 13, height: 14, marginTop: 1, flexShrink: 0 }}
            />
            <ThemeText
                name="room_usercount"
                text={String(room.population)}
                textStyle="u_bold"
                textOptions={{ fill: '#ffffff' }}
                verticalAlign="top"
                layout={{ height: 17, flexShrink: 0 }}
            />
        </Region>
    </Border>
);

/**
 * `info_popup_click_region`: `newnavigator_button_show_room_info`. A click opens or closes the
 * room info bubble (`onMouseClicked`), hovering moves an open one here (`onRoomRoomInfoMouseOver`).
 */
const InfoButton = ({ room, left, top, onShowInfo }: { room: IRoomInfo; left: number; top: number; onShowInfo?: NavigatorShowRoomInfo }) => (
    <Region
        name="info_popup_click_region"
        cursor="pointer"
        onPointerTap={event => showInfoFrom(event, room, onShowInfo, false)}
        onPointerOver={event => showInfoFrom(event, room, onShowInfo, true)}
        layout={{ position: 'absolute', left, width: 18, top, height: 18 }}
    >
        <ThemeImage
            src={LayoutImage('habbo-window-manager-com/newnavigator_button_show_room_info.png')}
            bitmap={{ stretchedX: false, stretchedY: false }}
            layout={{ position: 'absolute', left: 0, width: 18, top: 0, height: 18 }}
        />
    </Region>
);

/**
 * One room of a navigator result block: `navigator_entry_row_container` or
 * `navigator_entry_tile`, filled by `RoomEntryElementFactory.getNewRowElement` /
 * `getNewTileElement`. Only `go_to_room_region` enters the room (the row's leaves the info button
 * uncovered); `info_popup_click_region` toggles the room info bubble (`NavigatorRoomInfoPopup`),
 * and while it is up, hovering either region moves it to that room.
 *
 * Not ported: the tile's `room_group_badge` (a `badge_image` widget the group's badge fills) and
 * the thumbnail of a room without an official picture (`navigator.thumbnail.url_base` +
 * `<flatId>.png`) - both fall back to what the layout draws without them.
 */
export const NavigatorRoomEntryView = ({ room, mode, backgroundColor, onEnter, onShowInfo }: NavigatorRoomEntryViewProps) => {
    const interpolate = useInterpolate();
    const t = useTranslation();
    const doorModeImage = DOOR_MODE_IMAGES[room.doorMode];
    const roomPicUrl = room.officialRoomPicRef?.length ? room.officialRoomPicRef : undefined;
    // ThemeImage resolves its own texture, but the placeholder falls back until this one has
    // loaded; the texture cache is shared, so this is a lookup, not a second fetch.
    const roomPicTexture = useTextureFromUrl(roomPicUrl);

    if (mode === RESULTS_MODE_TILES) {
        return (
            <Border
                variant="10"
                name="navigator_entry_tile"
                tintColor={backgroundColor}
                layout={{ width: 122, height: 146, flexShrink: 0 }}
            >
                <Region
                    backgroundColor="#000000"
                    layout={{ position: 'absolute', left: 7, width: 108, top: 6, height: 109 }}
                />
                <ThemeImage
                    name="room_pic_placeholder"
                    src={roomPicTexture ? roomPicUrl : LayoutImage('habbo-window-manager-com/newnavigator_default_room.png')}
                    bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                    layout={{ position: 'absolute', left: 8, width: 106, top: 7, height: 106 }}
                />
                <Region
                    name="go_to_room_region"
                    tooltip={t('navigator.tooltip.go.to.room')}
                    cursor="pointer"
                    onPointerTap={() => onEnter(room)}
                    // `onTileGoToRoomMouseOver`: an open info bubble follows the pointer onto this tile.
                    onPointerOver={event => showInfoFrom(event, room, onShowInfo, true, -6, 56)}
                    layout={{ position: 'absolute', left: 0, width: 122, top: 0, height: 146 }}
                />
                <Region
                    name="room_name"
                    // margin_left 6, margin_top 2, margin_right 6 inside the 100x30 field.
                    layout={{ position: 'absolute', left: 0, width: 100, top: 116, height: 30, paddingLeft: 6, paddingTop: 2, paddingRight: 6, overflow: 'hidden' }}
                >
                    <ThemeText
                        text={interpolate(room.name)}
                        textStyle="u_bold"
                        textOptions={{ fontSize: 10, wordWrap: true, wordWrapWidth: 84 }}
                        flashFormat={{ bold: false }}
                        verticalAlign="top"
                        clip
                    />
                </Region>
                <UserCount
                    room={room}
                    left={40}
                    top={93}
                />
                {doorModeImage && (
                    <ThemeImage
                        name="doormode_icon"
                        src={doorModeImage}
                        bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                        layout={{ position: 'absolute', left: 92, width: 16, top: 96, height: 14 }}
                    />
                )}
                <InfoButton
                    room={room}
                    left={98}
                    top={120}
                    onShowInfo={onShowInfo}
                />
            </Border>
        );
    }

    return (
        <Border
            variant="3"
            name="navigator_entry_row_container"
            tintColor={backgroundColor}
            layout={{ width: 383, height: 20, flexShrink: 0 }}
        >
            <Region
                name="room_info_container"
                layout={{ position: 'absolute', left: 0, right: 2, top: 1, height: 18 }}
            >
                <UserCount
                    room={room}
                    left={0}
                    top={0}
                />
                <ThemeText
                    name="room_name"
                    text={interpolate(room.name)}
                    textStyle="u_regular"
                    verticalAlign="top"
                    clip
                    layout={{ position: 'absolute', left: 44, right: 55, top: 1, height: 16 }}
                />
                <InfoButton
                    room={room}
                    left={359}
                    top={0}
                    onShowInfo={onShowInfo}
                />
                {doorModeImage && (
                    <ThemeImage
                        name="doormode_icon"
                        src={doorModeImage}
                        bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                        layout={{ position: 'absolute', left: 324, width: 16, top: 2, height: 16 }}
                    />
                )}
                {(room.groupId > 0) && (
                    <ThemeImage
                        name="grouphome_icon"
                        src={LayoutImage('habbo-window-manager-com/newnavigator_icon_group.png')}
                        bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                        layout={{ position: 'absolute', left: 341, width: 16, top: 2, height: 16 }}
                    />
                )}
            </Region>
            <Region
                name="go_to_room_region"
                cursor="pointer"
                onPointerTap={() => onEnter(room)}
                // `onGoToRoomMouseOver`: an open info bubble follows the pointer onto this row.
                onPointerOver={event => showInfoFrom(event, room, onShowInfo, true, 20)}
                layout={{ position: 'absolute', left: 0, width: 357, top: 0, height: 20 }}
            />
        </Border>
    );
};
