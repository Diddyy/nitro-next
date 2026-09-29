import { Texture, TextureSource } from 'pixi.js';

/**
 * Destroys a texture the client created for itself (a rasterised text, a baked gradient, a
 * rendered preview) together with its source.
 *
 * Pixi's WebGPU batcher keeps every texture bind group it ever builds (`getTextureBatchBindGroup`'s
 * module-level cache, never evicted), each listening for `change` on the sources and samplers it
 * holds. A source that has been drawn is therefore always still "bound" when it is destroyed, and
 * `destroy` - which emits `change` once it is marked destroyed - makes every such group warn that
 * a `textureSource` / `textureSampler` "was destroyed while still bound to a shader". No timing
 * avoids it. The groups are never used again (their key holds the destroyed source's uid), so the
 * texture's `change` listeners are dropped first and it is destroyed quietly; its GPU texture and
 * canvas are released all the same.
 */
export const destroyOwnedTexture = (texture: Texture | null | undefined): void => {
    if (!texture || texture.destroyed) return;

    const source: TextureSource | undefined = texture.source;

    if (source && !source.destroyed) {
        source.removeAllListeners('change');

        // The sampler goes with the source only when the source made it; a shared style stays
        // in use by others and keeps its listeners.
        if ((source as unknown as { _ownsStyle?: boolean })._ownsStyle) source.style?.removeAllListeners('change');
    }

    texture.destroy(true);
};
