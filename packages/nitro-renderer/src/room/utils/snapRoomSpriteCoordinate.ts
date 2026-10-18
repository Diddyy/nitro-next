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
 * How many pixels from `offset + local * scale` Flash draws a room sprite: 0, or -1 / +1. The
 * canvas offset and the sprite's position are each kept in twips, and the bitmap
 * (`pixelSnapping = "always"`) lands on the pixel its summed position cuts toward. With an offset
 * off the twip grid the sum falls short of the whole pixel `snapSpriteCoordinate` aimed at, and the
 * sprite is drawn a pixel higher (or further left), where Habbo's thumbnails draw it too.
 */
export const drawnRoomSpriteShift = (local: number, offset: number, scale: number): number => {
    const drawn = Math.trunc((toTwips(offset) + (scale * toTwips(local))) / 20);

    return drawn - Math.round(offset + (local * scale));
};
