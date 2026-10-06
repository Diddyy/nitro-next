import { Container, Texture, TextureSource } from 'pixi.js';

/** The stages whose sprites may draw a texture `destroyOwnedTexture` destroys - see `watchOwnedTextureBatches`. */
const batchOwners: Set<Container> = new Set();

/**
 * Registers a stage whose sprites draw owned textures (`PixiApplicationRoot`'s): `destroyOwnedTexture`
 * rebuilds its batches before destroying one.
 */
export const watchOwnedTextureBatches = (container: Container): void => {
    batchOwners.add(container);
};

export const unwatchOwnedTextureBatches = (container: Container): void => {
    batchOwners.delete(container);
};

const rebuildWatchedBatches = () => {
    for (const container of batchOwners) {
        if (container.destroyed) {
            batchOwners.delete(container);

            continue;
        }

        const group = container.renderGroup ?? container.parentRenderGroup;

        if (group) group.structureDidChange = true;
    }
};

/**
 * Destroys a texture the client created for itself (a rasterised text, a baked gradient, a
 * rendered preview) together with its source.
 *
 * Pixi v8 keeps a render group's batches - and the sources each batch binds - until the group's
 * structure changes. A sprite moved onto a texture whose source its batch already binds (another
 * frame of a shared sheet) changes nothing structural, so the batch keeps binding the old source;
 * destroyed, that source is bound again once the batch's GPU bind group is rebuilt and Pixi throws
 * (`the resource bound as 'textureSource1' was destroyed while a shader still uses it`), which stops
 * the ticker. So every watched stage's batches are rebuilt first, as `TextureUtils.destroyTexture`
 * does for the room's.
 *
 * Pixi's WebGPU batcher also keeps every texture bind group it ever builds (`getTextureBatchBindGroup`'s
 * module-level cache), each listening for `change` on the sources and samplers it holds. A source
 * that has been drawn is therefore always still "bound" when it is destroyed, and `destroy` - which
 * emits `change` once it is marked destroyed - makes every such group warn that a `textureSource` /
 * `textureSampler` "was destroyed while still bound to a shader". The rebuilt batches no longer use
 * those groups, so the texture's `change` listeners are dropped first and it is destroyed quietly;
 * its GPU texture and canvas are released all the same.
 */
export const destroyOwnedTexture = (texture: Texture | null | undefined): void => {
    if (!texture || texture.destroyed) return;

    rebuildWatchedBatches();

    const source: TextureSource | undefined = texture.source;

    if (source && !source.destroyed) {
        source.removeAllListeners('change');

        // The sampler goes with the source only when the source made it; a shared style stays
        // in use by others and keeps its listeners.
        if ((source as unknown as { _ownsStyle?: boolean })._ownsStyle) source.style?.removeAllListeners('change');
    }

    texture.destroy(true);
};
