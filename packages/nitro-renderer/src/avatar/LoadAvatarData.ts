import { IAvatarRenderData } from '@nitrodevco/nitro-api';

import { GetAssetManager } from '../assets/GetAssetManager';

const BUNDLE_NAME = 'avatar-data';

/** The bundle's tables, by their file (`geometry.json` ...) and what they are in `IAvatarRenderData`. */
const FILES: Record<keyof IAvatarRenderData, string> = {
    geometry: 'geometry',
    partSets: 'part-sets',
    figureData: 'figure-data',
    builtInAnimations: 'built-in-animations',
    actionOffsets: 'action-offsets',
    actions: 'actions',
    animations: 'animations',
};

const REQUIRED: (keyof IAvatarRenderData)[] = [ 'geometry', 'partSets', 'figureData', 'builtInAnimations', 'actionOffsets' ];

/**
 * `avatar-data.nitro` (`avatar.data.url`): what the avatar render manager starts from - the tables the
 * Flash client carried in its render library, and the hotel's actions and animations - read out of the
 * bundle and let go of again. Nitro Studio builds it; a new release changes it without the renderer
 * changing.
 */
export const LoadAvatarData = async (url: string): Promise<IAvatarRenderData> => {
    if (!url) throw new Error('avatar.data.url is not set: the avatars have nothing to be drawn from');

    const assetManager = GetAssetManager();

    if (!await assetManager.downloadAssetBundle(BUNDLE_NAME, url)) throw new Error(`avatar data bundle request failed: ${url}`);

    const data = Object.fromEntries(Object.entries(FILES).map(([ key, file ]) => [ key, assetManager.getBundleFile(BUNDLE_NAME, file) ])) as unknown as IAvatarRenderData;

    assetManager.releaseBundleData(BUNDLE_NAME);

    const missing = REQUIRED.filter(key => !data[key]);

    if (missing.length) throw new Error(`avatar data bundle lacks ${missing.map(key => FILES[key]).join(', ')}: ${url}`);

    return data;
};
