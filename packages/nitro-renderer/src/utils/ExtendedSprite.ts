import { AlphaTolerance } from '@nitrodevco/nitro-api';
import { Filter, Sprite, Texture, TextureSource } from 'pixi.js';

import { TextureUtils } from '.';

/** One frame's alpha, row by row at the source's resolution, and the source version it was read at. */
interface HitMap {
    alpha: Uint8Array;
    width: number;
    height: number;
    version: number;
}

/** A decoded image a 2D canvas can read the frame from without going through the GPU. */
const isCpuReadable = (resource: unknown): resource is CanvasImageSource => {
    if ((typeof ImageBitmap !== 'undefined') && (resource instanceof ImageBitmap)) return resource.width > 0;
    if ((typeof HTMLCanvasElement !== 'undefined') && (resource instanceof HTMLCanvasElement)) return true;
    if ((typeof OffscreenCanvas !== 'undefined') && (resource instanceof OffscreenCanvas)) return true;
    if ((typeof HTMLImageElement !== 'undefined') && (resource instanceof HTMLImageElement)) return resource.complete && (resource.naturalWidth > 0);

    return false;
};

export class ExtendedSprite extends Sprite {
    /**
     * Per texture - one frame of a sheet, not the whole sheet: a sprite tests only its own frame,
     * so only the frames something was pointed at are read, each the size of the frame.
     */
    private static readonly _hitMaps = new WeakMap<Texture, HitMap>();
    /** Bumped when a source is drawn again (`removeHitmap`): a map read before is stale. */
    private static readonly _sourceVersions = new WeakMap<TextureSource, number>();
    /** A source's alpha read back from the GPU whole (`readSourceAlpha`), and the version it was read at. */
    private static readonly _sourceAlpha = new WeakMap<TextureSource, { alpha: Uint8Array; width: number; height: number; version: number }>();

    private _offsetX: number = 0;
    private _offsetY: number = 0;
    private _tag: string = '';
    private _alphaTolerance: number = AlphaTolerance.MATCH_OPAQUE_PIXELS;
    private _varyingDepth: boolean = false;
    private _clickHandling: boolean = false;
    private _skipMouseHandling: boolean = false;
    private _geometryUpdateId: number = -1;
    private _objectUpdateId: number = -1;
    /** The list last given to `setFilters`; Pixi keeps only a frozen copy of it. */
    private _sourceFilters: Filter[] | undefined = undefined;

    /** The source was drawn again (a plane, a pooled render texture): every frame read from it is stale. */
    public static removeHitmap(source: TextureSource): void {
        if (!source) return;

        this._sourceVersions.set(source, (this._sourceVersions.get(source) ?? 0) + 1);
    }

    public needsUpdate(geometryUpdateId: number, objectUpdateId: number): boolean {
        if (this._geometryUpdateId === geometryUpdateId && this._objectUpdateId === objectUpdateId) return false;

        this._geometryUpdateId = geometryUpdateId;
        this._objectUpdateId = objectUpdateId;

        return true;
    }

    /**
     * Sets `filters` only when the list differs from the one last set. Pixi's `filters` setter copies
     * and freezes the list on every write - and creates the sprite's filter effect on the first -
     * so writing it on every sprite update, mostly with an empty list, was steady garbage.
     */
    public setFilters(filters: Filter[] | undefined): void {
        if (filters === this._sourceFilters) return;

        const isEmpty = !filters?.length;
        const wasEmpty = !this._sourceFilters?.length;

        this._sourceFilters = filters;

        if (isEmpty && wasEmpty) return;

        this.filters = isEmpty ? [] : filters;
    }

    public setTexture(texture: Texture): void {
        if (!texture) texture = Texture.EMPTY;

        if (texture === this.texture) return;

        if (texture === Texture.EMPTY) {
            this._geometryUpdateId = -1;
            this._objectUpdateId = -1;
        }

        this.texture = texture;
    }

    public containsXY(x: number, y: number): boolean {
        if (this.alphaTolerance > 255 || !this.texture || this.texture === Texture.EMPTY) return false;

        x = x * this.scale.x;
        y = y * this.scale.y;

        if (!super.containsPoint({ x, y })) return false;

        if (this.alphaTolerance <= 0) return true;

        const texture = this.texture;
        const textureSource = texture.source;

        if (!textureSource) return false;

        const hitMap = ExtendedSprite.getHitMap(texture);

        if (!hitMap) return false;

        // The point within the frame: a trimmed texture's frame starts at its trim offset.
        let fx = x;
        let fy = y;

        if (texture.trim) {
            fx -= texture.trim.x;
            fy -= texture.trim.y;
        }

        const dx = (fx * textureSource.resolution + 0.5) | 0;
        const dy = (fy * textureSource.resolution + 0.5) | 0;

        if ((dx < 0) || (dy < 0) || (dx >= hitMap.width) || (dy >= hitMap.height)) return false;

        return hitMap.alpha[dx + dy * hitMap.width] >= this.alphaTolerance;
    }

    /** The texture's frame alpha, read once per source version. */
    private static getHitMap(texture: Texture): HitMap | undefined {
        const version = ExtendedSprite._sourceVersions.get(texture.source) ?? 0;
        const cached = ExtendedSprite._hitMaps.get(texture);

        if (cached && (cached.version === version)) return cached;

        const read = ExtendedSprite.readFrameAlpha(texture);

        if (!read) return undefined;

        const hitMap = { ...read, version };

        ExtendedSprite._hitMaps.set(texture, hitMap);

        return hitMap;
    }

    /**
     * The frame's alpha, from the cheapest copy there is: the palette's RGBA a recoloured pet keeps
     * (`GraphicAssetPalette.applyPalette` - read back through the GPU its canvas has no alpha), then
     * the decoded image on a small 2D canvas (no GPU readback, so no wait for the GPU to finish),
     * and only then the frame read back from the GPU - a render texture, or a sheet whose bitmap was
     * closed after upload (`furniture.sheets.gpu_resident`).
     */
    private static readFrameAlpha(texture: Texture): Omit<HitMap, 'version'> | undefined {
        const source = texture.source;
        const resolution = source.resolution;
        const frame = texture.frame;
        const left = Math.round(frame.x * resolution);
        const top = Math.round(frame.y * resolution);
        const width = Math.max(Math.round(frame.width * resolution), 1);
        const height = Math.max(Math.round(frame.height * resolution), 1);
        const paletteRgba = (source as TextureSource & { hitMap?: Uint8ClampedArray }).hitMap;

        if (paletteRgba) return ExtendedSprite.sliceAlpha(paletteRgba, source.pixelWidth, left, top, width, height);

        if (isCpuReadable(source.resource) && (typeof OffscreenCanvas !== 'undefined')) {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (ctx) {
                try {
                    ctx.drawImage(source.resource, left, top, width, height, 0, 0, width, height);

                    return ExtendedSprite.sliceAlpha(ctx.getImageData(0, 0, width, height).data, width, 0, 0, width, height);
                } catch {
                    // A cross-origin image taints the canvas: read the frame back from the GPU instead.
                }
            }
        }

        const whole = ExtendedSprite.readSourceAlpha(source);

        if (!whole) return undefined;

        const alpha = new Uint8Array(width * height);

        for (let row = 0; row < height; row++) {
            const y = top + row;

            if ((y < 0) || (y >= whole.height)) continue;

            const from = y * whole.width;

            for (let column = 0; column < width; column++) {
                const x = left + column;

                if ((x >= 0) && (x < whole.width)) alpha[row * width + column] = whole.alpha[from + x];
            }
        }

        return { alpha, width, height };
    }

    /**
     * The whole source's alpha read back from the GPU, once per source version, for its frames to
     * be cut from. Whole, not frame by frame: WebGPU's `getPixels` ignores the texture's frame and copies
     * the full source from its corner (WebGL reads only the frame), so reading per frame would
     * index the wrong pixels there - and a sheet would be read back once for every frame tested.
     */
    private static readSourceAlpha(source: TextureSource): { alpha: Uint8Array; width: number; height: number } | undefined {
        const version = ExtendedSprite._sourceVersions.get(source) ?? 0;
        const cached = ExtendedSprite._sourceAlpha.get(source);

        if (cached && (cached.version === version)) return cached;

        const whole = new Texture({ source });
        const result = TextureUtils.getPixels(whole);

        whole.destroy();

        if (!result?.pixels) return undefined;

        const read = { ...ExtendedSprite.sliceAlpha(result.pixels, result.width, 0, 0, result.width, result.height), version };

        ExtendedSprite._sourceAlpha.set(source, read);

        return read;
    }

    /** The alpha bytes of a rectangle of an RGBA buffer `stride` pixels wide. */
    private static sliceAlpha(rgba: Uint8Array | Uint8ClampedArray, stride: number, left: number, top: number, width: number, height: number): Omit<HitMap, 'version'> {
        const alpha = new Uint8Array(width * height);

        for (let row = 0; row < height; row++) {
            const from = ((top + row) * stride + left) * 4 + 3;
            const to = row * width;

            for (let column = 0; column < width; column++) alpha[to + column] = rgba[from + column * 4] ?? 0;
        }

        return { alpha, width, height };
    }

    public get offsetX(): number {
        return this._offsetX;
    }

    public set offsetX(offset: number) {
        this._offsetX = offset;
    }

    public get offsetY(): number {
        return this._offsetY;
    }

    public set offsetY(offset: number) {
        this._offsetY = offset;
    }

    public get tag(): string {
        return this._tag;
    }

    public set tag(tag: string) {
        this._tag = tag;
    }

    public get alphaTolerance(): number {
        return this._alphaTolerance;
    }

    public set alphaTolerance(tolerance: number) {
        this._alphaTolerance = tolerance;
    }

    public get varyingDepth(): boolean {
        return this._varyingDepth;
    }

    public set varyingDepth(flag: boolean) {
        this._varyingDepth = flag;
    }

    public get clickHandling(): boolean {
        return this._clickHandling;
    }

    public set clickHandling(flag: boolean) {
        this._clickHandling = flag;
    }

    public get skipMouseHandling(): boolean {
        return this._skipMouseHandling;
    }

    public set skipMouseHandling(flag: boolean) {
        this._skipMouseHandling = flag;
    }
}
