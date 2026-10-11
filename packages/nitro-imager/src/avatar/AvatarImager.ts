import { Canvas } from '@napi-rs/canvas';
import { AvatarActionStateType, AvatarScaleType, AvatarSetType, IAvatarImage, IEffectMapLibrary, IFigureData, IFigureMapLibrary, RoomGeometryScaleType } from '@nitrodevco/nitro-api';
import { GetAssetManager, GetAvatarRenderManager, GetRenderer, LoadAvatarData, PrepareRenderer } from '@nitrodevco/nitro-renderer';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

import { ImagerConfig } from '../config';
import { AvatarImageSize, AvatarRenderRequest } from './avatarRequest';
import { halveImage } from './halveImage';

/** The libraries every avatar draws from; the figure map starts them, and the imager waits for them. */
const MANDATORY_LIBRARIES = [ 'hh_human_body', 'hh_human_item' ];
const MANDATORY_TIMEOUT = 60_000;

/**
 * `AvatarVisualization` advances an avatar a frame every `ANIMATION_FRAME_UPDATE_INTERVAL` (2)
 * room updates of `UPDATE_TIME_INCREASER` (41 ms): an animated image plays at the room's speed.
 */
export const AVATAR_FRAME_MS = 82;

/** The most frames an animated image has, whatever the actions add up to. */
const MAX_ANIMATION_FRAMES = 64;

/** `AvatarVisualization.DEFAULT_CANVAS_OFFSETS`. */
const DEFAULT_CANVAS_OFFSETS = [ 0, 0, 0 ];

/** One sprite of a frame, where the room would draw it relative to the avatar's tile. */
interface PlacedSprite {
    texture: Texture;
    x: number;
    y: number;
    flipH: boolean;
    additive: boolean;
    /** The room's `relativeDepth`: the higher, the further back. */
    depth: number;
    /** The avatar's own image rather than an effect's sprite. */
    isAvatar: boolean;
}

/** A drawn avatar, and whether all of it drew: a figure part or effect that did not is no image to keep. */
export interface AvatarRender {
    frames: Canvas[];
    /** What of the request did not draw (`hd-99999`, `effect 4` ...); empty when all of it did. */
    missing: string[];
}

export interface AvatarImagerOptions {
    /** How many asset libraries may be loaded before the ones no avatar is drawing with are unloaded. */
    maxLoadedLibraries: number;
}

/** How often, in ms, the imager looks at how many libraries are loaded. */
const PURGE_CHECK_INTERVAL = 30_000;

/**
 * Avatar images, drawn by the renderer's own `AvatarRenderManager` - the figure, actions and
 * effects go through exactly the code the client's room runs - on Pixi's Canvas 2D renderer.
 *
 * A frame is laid out as `AvatarVisualization` lays an avatar out in the room: the avatar's own
 * image at its canvas offsets, and an effect's extra sprites (the ones `getSprites` lists besides
 * `avatar`) placed by their direction offsets and layer data, behind or in front by their z, with
 * ink 33 drawn additively. The image is the union of every sprite of every frame, so an avatar
 * with no effect is exactly its avatar canvas and an animation keeps one size throughout. Every
 * size is drawn from the large assets at the room's full scale; `s` is that image halved
 * afterwards, as the client's zoomed-out room is (`RoomDownsampleFilter`), effect sprites and all.
 *
 * Every figure the imager is asked for leaves its clothing libraries loaded. Once more than
 * `maxLoadedLibraries` are, the ones no avatar is drawing with are unloaded (`purgeAssets`): new
 * renders wait for the ones in progress to finish first, so no library goes from under a render
 * that has loaded it but not yet made its image.
 */
export class AvatarImager {
    private _rendering = 0;
    private _purge: { done: Promise<void>; resolve: () => void } | undefined;
    private readonly _purgeTimer: ReturnType<typeof setInterval>;

    private constructor(private readonly _hasEffects: boolean, private readonly _options: AvatarImagerOptions) {
        this._purgeTimer = setInterval(() => this.purgeIfFull(), PURGE_CHECK_INTERVAL);
        this._purgeTimer.unref();
    }

    public static async create(config: ImagerConfig['avatar'], options: AvatarImagerOptions): Promise<AvatarImager> {
        await PrepareRenderer({ preference: 'canvas', skipExtensionImports: true, width: 1, height: 1, backgroundAlpha: 0, antialias: false });

        const manager = GetAvatarRenderManager();

        manager.init(await LoadAvatarData(config.templatesUrl));

        const [ figureMap, figureData, effectMap ] = await Promise.all([
            fetchJson<{ libraries: IFigureMapLibrary[] }>(config.figureMapUrl),
            fetchJson<IFigureData>(config.figureDataUrl),
            config.effectMapUrl ? fetchJson<{ effects: IEffectMapLibrary[] }>(config.effectMapUrl) : undefined,
        ]);

        manager.processFigureMap(figureMap.libraries, config.figureBundleUrl);
        manager.structure.injectFigureData(figureData);

        const hasEffects = !!(effectMap && config.effectBundleUrl);

        if (hasEffects) manager.processEffectMap(effectMap.effects, config.effectBundleUrl);

        await waitForLibraries(MANDATORY_LIBRARIES, MANDATORY_TIMEOUT);

        return new AvatarImager(hasEffects, options);
    }

    /** How many asset libraries are loaded now: the figures', the effects' and the avatar data's. */
    public get loadedLibraries(): number {
        return GetAssetManager().collections.size;
    }

    /** The frames of the image - one for a still, every frame of the animation for `animate` - and what did not draw. */
    public async render(request: AvatarRenderRequest): Promise<AvatarRender> {
        while (this._purge) await this._purge.done;

        this._rendering++;

        try {
            return await this.draw(request);
        } finally {
            this._rendering--;

            // Checked after every render too, so a burst of new figures cannot run far past the cap between checks.
            this.purgeIfFull();

            if (this._purge && !this._rendering) this.runPurge();
        }
    }

    public dispose(): void {
        clearInterval(this._purgeTimer);
    }

    /**
     * Unloads the libraries no avatar is drawing with, once there are more than the imager keeps:
     * at once when nothing is rendering, or as soon as the renders in progress are done.
     */
    public purgeIfFull(): void {
        if (this._purge || (this.loadedLibraries <= this._options.maxLoadedLibraries)) return;

        let resolve: () => void = () => undefined;
        const done = new Promise<void>((onDone) => {
            resolve = onDone;
        });

        this._purge = { done, resolve };

        if (!this._rendering) this.runPurge();
    }

    private runPurge(): void {
        const purge = this._purge;

        if (!purge) return;

        const before = this.loadedLibraries;

        try {
            GetAvatarRenderManager().purgeAssets();
        } finally {
            this._purge = undefined;
            purge.resolve();
        }

        console.log(`Unloaded ${before - this.loadedLibraries} avatar libraries no avatar was drawing with (${this.loadedLibraries} left)`);
    }

    private async draw(request: AvatarRenderRequest): Promise<AvatarRender> {
        const manager = GetAvatarRenderManager();
        const avatar = await manager.createAvatarImageAsync(request.figure, AvatarScaleType.Large, request.gender);

        if (!avatar) throw new Error(`The figure ${request.figure} could not be drawn`);

        try {
            const effect = (this._hasEffects && !request.headOnly) ? request.effect : 0;
            const dances = request.actions.filter(action => action.action === AvatarActionStateType.Dance).map(action => `dance.${action.parameter}`);

            if (dances.length && !this._hasEffects) throw new Error('Dances are effects: the imager has no effect map');
            if (effect > 0) await manager.downloadAvatarEffectAsync(effect);

            // Asked of the figure as it was given, before the renderer stands default sets in for unknown ones.
            const effects: (number | string)[] = (effect > 0) ? [ effect, ...dances ] : dances;
            const missing = [
                ...manager.getUndrawableFigureParts(request.figure),
                ...effects.filter(id => !manager.isAvatarEffectLoaded(id)).map(id => `effect ${id}`),
            ];

            setUpAvatar(avatar, request, effect);

            const frameCount = request.animate ? Math.min(MAX_ANIMATION_FRAMES, Math.max(1, avatar.getTotalFrameCount())) : 1;
            const frames: PlacedSprite[][] = [];

            if (request.frame > 0) avatar.updateAnimationByFrames(request.frame);

            for (let i = 0; i < frameCount; i++) {
                if (i > 0) avatar.updateAnimationByFrames(1);

                // The avatar draws every frame into the same texture: each keeps a copy of its own.
                frames.push(placeFrame(avatar, request.headOnly).map(sprite => (sprite.isAvatar ? { ...sprite, texture: copyTexture(sprite.texture) } : sprite)));
            }

            try {
                return { frames: drawFrames(frames, request.size), missing };
            } finally {
                for (const sprite of frames.flat()) if (sprite.isAvatar) sprite.texture.destroy(true);
            }
        } finally {
            avatar.dispose();
        }
    }
}

/** The figure turned and given its actions, in `AvatarVisualization.processActionsForAvatar`'s order. */
const setUpAvatar = (avatar: IAvatarImage, request: AvatarRenderRequest, effect: number): void => {
    avatar.setDirection(AvatarSetType.Full, request.direction);
    avatar.setDirection(AvatarSetType.Head, request.headDirection);

    avatar.initActionAppends();
    avatar.appendAction(AvatarActionStateType.Posture, request.posture, '');

    for (const { action, parameter } of request.actions) {
        if (parameter === undefined) avatar.appendAction(action);
        else avatar.appendAction(action, parameter);
    }

    if (effect > 0) avatar.appendAction(AvatarActionStateType.Effect, effect);

    avatar.endActionAppends();
};

/**
 * One frame's sprites, placed as `AvatarVisualization.update` places them, back to front. A
 * head alone is the head's own cropped image, as the client's head widgets show it.
 */
const placeFrame = (avatar: IAvatarImage, headOnly: boolean): PlacedSprite[] => {
    const scale = RoomGeometryScaleType.ZoomedIn;

    if (headOnly) {
        const head = avatar.getCroppedImage(AvatarSetType.Head, false);

        return head ? [ { texture: head, x: 0, y: 0, flipH: false, additive: false, depth: 0, isAvatar: true } ] : [];
    }

    const image = avatar.getImage(AvatarSetType.Full, false);

    if (!image) return [];

    let canvasOffsets = avatar.getCanvasOffsets();

    if (!canvasOffsets || (canvasOffsets.length < 3)) canvasOffsets = DEFAULT_CANVAS_OFFSETS;

    const sprites: PlacedSprite[] = [ {
        texture: image,
        x: (-1 * scale) / 2 + canvasOffsets[0] - (image.width - scale) / 2,
        y: -image.height + scale / 4 + canvasOffsets[1],
        flipH: false,
        additive: false,
        depth: canvasOffsets[2],
        isAvatar: true,
    } ];

    const direction = avatar.getDirection();
    const spriteData = avatar.getSprites().filter(sprite => sprite.id !== 'avatar');
    const totalSprites = spriteData.length + 1;

    for (const data of spriteData) {
        const layerData = avatar.getLayerData(data);

        let frame = 0;
        let offsetX = data.getDirectionOffsetX(direction);
        let offsetY = data.getDirectionOffsetY(direction);
        let dd = data.hasDirections ? direction : 0;

        if (layerData) {
            frame = layerData.animationFrame;
            offsetX += layerData.dx;
            offsetY += layerData.dy;
            dd += layerData.dd;
        }

        if (dd < 0) dd += 8;
        else if (dd > 7) dd -= 8;

        const asset = avatar.getAsset(`${avatar.getScale()}_${data.member}_${dd}_${frame}`);

        if (!asset?.texture) continue;

        sprites.push({
            texture: asset.texture,
            x: asset.offsetX - scale / 2 + offsetX,
            y: asset.offsetY + offsetY,
            flipH: asset.flipH,
            additive: data.ink === 33,
            depth: -0.001 * totalSprites * data.getDirectionOffsetZ(direction),
            isAvatar: false,
        });
    }

    // Stable: sprites at one depth keep the order the avatar lists them in.
    return sprites.sort((a, b) => b.depth - a.depth);
};

/**
 * The frames on one canvas size - the union of every sprite of every frame - at `size`: `n` as
 * drawn, `l` doubled, `s` halved. The bounds are kept to even pixels about the avatar's tile, so
 * the halving averages the same 2x2 blocks the client's zoomed-out room does.
 */
const drawFrames = (frames: PlacedSprite[][], size: AvatarImageSize): Canvas[] => {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;

    for (const sprite of frames.flat()) {
        const x = sprite.flipH ? (sprite.x - sprite.texture.width) : sprite.x;

        left = Math.min(left, x);
        top = Math.min(top, sprite.y);
        right = Math.max(right, x + sprite.texture.width);
        bottom = Math.max(bottom, sprite.y + sprite.texture.height);
    }

    if (!Number.isFinite(left)) throw new Error('The avatar drew nothing');

    left = Math.floor(left / 2) * 2;
    top = Math.floor(top / 2) * 2;

    const bounds = new Rectangle(left, top, Math.ceil((right - left) / 2) * 2, Math.ceil((bottom - top) / 2) * 2);
    const zoom = (size === 'l') ? 2 : 1;

    return frames.map((sprites) => {
        const container = new Container();

        // Fills the bounds, so a frame whose sprites cover less of them is still the full size.
        const frame = new Sprite(Texture.EMPTY);

        frame.position.set(bounds.x, bounds.y);
        frame.setSize(bounds.width, bounds.height);
        container.addChild(frame);

        for (const placed of sprites) {
            const sprite = new Sprite(placed.texture);

            sprite.position.set(placed.x, placed.y);

            if (placed.flipH) sprite.scale.x = -1;
            if (placed.additive) sprite.blendMode = 'add';

            container.addChild(sprite);
        }

        if (zoom !== 1) container.scale.set(zoom);

        const canvas = GetRenderer().extract.canvas({
            target: container,
            frame: new Rectangle(bounds.x * zoom, bounds.y * zoom, bounds.width * zoom, bounds.height * zoom),
            antialias: false,
        }) as unknown as Canvas;

        container.destroy({ children: true });

        return (size === 's') ? halveImage(canvas) : canvas;
    });
};

/** A copy of a render texture's pixels the avatar can draw its next frame over. */
const copyTexture = (texture: Texture): Texture => Texture.from(GetRenderer().extract.canvas(texture) as never, true);

const waitForLibraries = async (names: string[], timeout: number): Promise<void> => {
    const startedAt = Date.now();

    while (!names.every(name => GetAssetManager().getCollection(name))) {
        if ((Date.now() - startedAt) > timeout) throw new Error(`The avatar libraries ${names.join(', ')} did not load`);

        await new Promise(resolve => setTimeout(resolve, 100));
    }
};

const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url);

    if (!response.ok) throw new Error(`${response.status} for ${url}`);

    return await response.json() as T;
};
