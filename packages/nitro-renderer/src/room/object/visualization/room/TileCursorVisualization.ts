import { RoomGeometryScaleType, RoomObjectVariableEnum } from '@nitrodevco/nitro-api';

import { AnimatedFurnitureVisualization } from '../furniture';

/**
 * `TileCursorVisualization`: the tile cursor, whose layer 1 (the height marker) is lifted by the
 * `tile_cursor_height` the logic was given, at half a tile's scale per height unit.
 */
export class TileCursorVisualization extends AnimatedFurnitureVisualization {
    private _tileHeight: number;

    constructor() {
        super();

        this._tileHeight = 0;
    }

    protected override getLayerYOffset(scale: RoomGeometryScaleType, direction: number, layerId: number): number {
        if (layerId === 1) {
            this._tileHeight = this.object.model.getValue<number>(RoomObjectVariableEnum.TileCursorHeight);

            // Flash's `getSpriteYOffset` returns an int, so the lift truncates.
            return Math.trunc(-this._tileHeight * (scale / 2));
        }

        return super.getLayerYOffset(scale, direction, layerId);
    }
}
