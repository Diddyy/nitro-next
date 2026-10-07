/**
 * `BottomBarLeft.animateToIcon` (`IHabboToolbar.createTransitionToIcon`): a picture leaps from where
 * it is shown into a toolbar icon, which bounces as it lands.
 *
 * The picture's window starts with its top-left at `x` / `y` and jumps by the distance to the
 * icon's top-left plus 20 to the right (`JumpBy(..., duration, dx + 20, dy, 100, 1)` under a rate 1
 * `EaseOut`, which is linear), then is disposed. The jump takes `500 - |1 / distance * 100 * 500 * 0.5|`
 * ms, so a short leap is a quick one. Unless the icon is already bouncing (`ToolBarBouncing[ <icon> ]`),
 * it `DropBounce`s 12 px over 400 ms once the picture has had 8 ms longer than its jump.
 *
 * An icon the toolbar does not show (`findChildByName` finds nothing) gets no transition, and its
 * picture is dropped.
 */
import { FurniId, IRoom, RoomObjectCategoryEnum, RoomObjectVariableEnum } from '@nitrodevco/nitro-api';
import { GetRenderer, GetRoomEngine } from '@nitrodevco/nitro-renderer';
import { Container as PixiContainer, Rectangle, Texture } from 'pixi.js';

import { systemStore, ToolbarTransitionIcon } from '#base/context/system';
import { userStore } from '#base/context/user';
import { getGlobalRect, loadTexture } from '#base/theme';

/** `animateToIcon`'s `_loc9_`: the picture lands this far right of the icon's left edge. */
const LANDING_OFFSET_X = 20;
/** `new Wait(duration + 8)` before the icon's `DropBounce`. */
const BOUNCE_EXTRA_WAIT_MS = 8;

/**
 * `animateToIcon(icon, bitmap, x, y)`. `ownsTexture` is `disposesBitmap`: a texture made for the
 * transition goes with it; a shared one (an asset's icon) is left alone.
 */
export const createTransitionToIcon = (icon: ToolbarTransitionIcon, texture: Texture, ownsTexture: boolean, x: number, y: number) => {
    const { toolbarIconNodes, toolbarIconBounces, addToolbarTransition, setToolbarIconBounce } = systemStore.getState();
    const node = toolbarIconNodes[icon];

    if (!node || node.destroyed) {
        if (ownsTexture) texture.destroy(true);

        return;
    }

    const target = getGlobalRect(node);
    const startX = Math.trunc(x);
    const startY = Math.trunc(y);
    const distanceX = startX - target.x;
    const distanceY = startY - target.y;
    const distance = Math.sqrt((distanceX * distanceX) + (distanceY * distanceY));
    // Flash's int of the formula: a leap under 50 px comes out at 0 or less, which is no leap at all.
    const durationMs = (distance > 0) ? Math.max(0, Math.trunc(500 - Math.abs(1 / distance * 100 * 500 * 0.5))) : 0;

    if (toolbarIconBounces[icon] === undefined) setToolbarIconBounce(icon, durationMs + BOUNCE_EXTRA_WAIT_MS);

    addToolbarTransition({
        texture,
        ownsTexture,
        x: startX,
        y: startY,
        deltaX: Math.trunc(target.x - startX) + LANDING_OFFSET_X,
        deltaY: Math.trunc(target.y - startY),
        durationMs,
    });
};

/**
 * `createTransitionToIcon(icon, wrapper.bitmap.clone(), position.x, position.y)` for a picture the
 * client draws in a window: a copy of the window's whole box as it shows now, from its top-left.
 */
export const createTransitionFromNode = (icon: ToolbarTransitionIcon, node: PixiContainer) => {
    if (node.destroyed) return;

    const rect = getGlobalRect(node);

    if ((rect.width <= 0) || (rect.height <= 0)) return;

    const texture = GetRenderer().generateTexture({ target: node, frame: new Rectangle(0, 0, rect.width, rect.height) });

    createTransitionToIcon(icon, texture, true, rect.x, rect.y);
};

/**
 * `RoomEngine.disposeObjectFurniture` / `disposeObjectWallItem`, before the object goes: furni the
 * user picked up themselves (`pickerId` is the user's id - an expired one comes with -1) flies
 * from its spot on the screen (`getRoomObjectScreenLocation`) to the inventory icon as its icon
 * (`getFurnitureIcon` / `getWallItemIcon`). Not a builders club or temporary item, not a floor
 * item whose `furniture_disable_picking_animation` is 1, and not a sticky note or an external
 * image on the wall.
 */
export const createPickupTransition = (room: IRoom, objectId: number, category: RoomObjectCategoryEnum, pickerId: number) => {
    if ((pickerId !== userStore.getState().userId) || FurniId.isBuilderClubId(objectId) || FurniId.isTempId(objectId)) return;

    const object = room.getRoomObject(objectId, category);

    if (!object) return;

    const model = object.model;
    const typeId = model.getValue<number>(RoomObjectVariableEnum.FurnitureTypeId);
    let iconUrl: string | undefined;

    if (category === RoomObjectCategoryEnum.Wall) {
        if ((object.type.indexOf('post_it') !== -1) || (object.type.indexOf('external_image_wallitem') !== -1)) return;

        iconUrl = GetRoomEngine().getFurnitureWallIconUrl(typeId, model.getValue<string>(RoomObjectVariableEnum.FurnitureData) || undefined);
    } else {
        if (model.getValue<number>(RoomObjectVariableEnum.FurnitureDisablePickingAnimation) === 1) return;

        iconUrl = GetRoomEngine().getFurnitureFloorIconUrl(typeId);
    }

    const location = room.getRoomObjectScreenLocation(objectId, category);

    if (!location || !iconUrl) return;

    // The icon is the asset's own, shared with every other view of it: the transition leaves it be.
    void loadTexture(iconUrl).then((texture) => {
        if (texture) createTransitionToIcon('HTIE_ICON_INVENTORY', texture, false, location.x, location.y);
    });
};
