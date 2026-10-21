/**
 * RoomSpriteCanvas.snapSpriteCoordinate and Bitmap.pixelSnapping="always".
 * Flash leaves half-scale positions to Bitmap's native snapping, whose half-pixel ties
 * round to even (as observed in the AIR client at phases 0/1 and 2/3). Other zoom levels use AS3 Math.round.
 * Resolve the screen pixel before converting back to room coordinates, so adjacent
 * plane bitmaps share one sampling grid during room zoom and camera movement.
 */
export const snapRoomSpriteCoordinate = (coordinate: number, offset: number, scale: number): number => {
    const screen = offset + coordinate * scale;
    const lower = Math.floor(screen);
    const snapped = scale === 0.5 && screen - lower === 0.5
        ? lower + (Math.abs(lower) % 2)
        : Math.round(screen);

    return (snapped - offset) / scale;
};

/** Flash keeps a display position in whole twips (1/20 px), cut down. */
const toTwips = (value: number): number => Math.floor((value * 20) + 0.02);

/**
 * How many pixels from `offset + local * scale` Flash draws the room's sprites: 0 or -1. The canvas
 * offset is kept in twips, cut down, and a bitmap (`pixelSnapping = "always"`) lands on the pixel its
 * position cuts toward: with an offset off the twip grid that falls short of the whole pixel
 * `snapSpriteCoordinate` aimed at, and the room is drawn a pixel higher (or further left), where
 * Habbo's thumbnails draw it too. It is the offset's alone, so one shift moves every sprite: worked
 * out for each sprite's own position, cut toward zero, a sprite starting above or left of the
 * canvas stayed put while its neighbours moved, and planes that meet (the door tile and the floor)
 * opened a pixel-wide seam. Habbo's JS port draws the plain snap, with no seam either.
 */
export const drawnRoomSpriteShift = (offset: number): number => ((toTwips(offset) < (offset * 20)) ? -1 : 0);
