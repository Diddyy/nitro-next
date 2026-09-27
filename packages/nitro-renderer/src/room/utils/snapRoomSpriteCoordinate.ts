/**
 * RoomSpriteCanvas.snapSpriteCoordinate and Bitmap.pixelSnapping="always".
 * Flash leaves half-scale positions to Bitmap's native snapping, whose half-pixel ties
 * round to even (ZoomProbe phases 0/1 and 2/3). Other zoom levels use AS3 Math.round.
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
