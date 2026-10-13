import { getRoom } from '#base/context/room';

/** The geometry scale a room is drawn at unzoomed (`VariableLeaderboardLocationProjector`, `FurnitureLabelView` 25). */
const BASE_GEOMETRY_SCALE = 64;

/** `VariableLeaderboardLocationProjector.getScale`: the room's zoom as a factor, 1 at the default zoom. */
export const getRoomOverlayScale = (): number => {
    const canvas = getRoom()?.canvas;

    if (!canvas) return 1;

    return (canvas.geometry.scale / BASE_GEOMETRY_SCALE) * Math.abs(canvas.scale);
};
