import { RoomGeometryScaleType } from '@nitrodevco/nitro-api';
import { Texture } from 'pixi.js';

import { TextureUtils } from '#renderer/utils';

import { IsometricImageFurniVisualization } from './IsometricImageFurniVisualization';

export class ExternalIsometricImageFurniVisualization extends IsometricImageFurniVisualization {
    private _cachedUrl: string | undefined = undefined;
    /** The downloaded picture, ours alone: the thumbnails are rendered from it on every direction change. */
    private _image: Texture | undefined = undefined;

    constructor() {
        super();

        this._hasOutline = true;
    }

    public override dispose(): void {
        super.dispose();

        this._cachedUrl = undefined;
        this.releaseImage();
    }

    protected override updateModel(scale: RoomGeometryScaleType): boolean {
        const thumbnailUrl = this.getThumbnailURL();

        if (this._cachedUrl !== thumbnailUrl) {
            this._cachedUrl = thumbnailUrl;

            if (this._cachedUrl && this._cachedUrl.length > 0) {
                const url = this._cachedUrl;
                const image = new Image();

                image.src = url;
                image.crossOrigin = '*';

                image.onload = () => {
                    // Disposed, or moved on to another picture, while this one downloaded.
                    if (this._cachedUrl !== url) return;

                    // Uncached: `Texture.from` would otherwise keep every picture in Pixi's global cache for good.
                    const texture = Texture.from(image, true);

                    texture.source.scaleMode = 'linear';

                    this.releaseImage();
                    this._image = texture;
                    this.setThumbnailImages(texture);
                };
            } else {
                this.setThumbnailImages(undefined);
                this.releaseImage();
            }
        }

        return super.updateModel(scale);
    }

    private releaseImage(): void {
        if (this._image) TextureUtils.destroyTexture(this._image);

        this._image = undefined;
    }

    protected getThumbnailURL(): string | undefined {
        throw new Error('This method must be overridden!');
    }
}
