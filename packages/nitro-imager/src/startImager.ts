import { serve } from '@hono/node-server';

import { AVATAR_FRAME_MS, AvatarImager } from './avatar/AvatarImager';
import { GroupBadgeImager } from './badge/GroupBadgeImager';
import { DEFAULT_BADGE_PARTS, readImagerConfig } from './config';
import { setRendererConfig } from './environment/installNodeEnvironment';
import { createApp } from './http/createApp';
import { ImageCache } from './http/ImageCache';

/** Reads the configuration, loads what both imagers draw from, and serves them. */
export const startImager = async (env: NodeJS.ProcessEnv): Promise<void> => {
    const config = readImagerConfig(env);

    // The renderer reads its few config values (`asset.bundles.templates` ...) as the client gives them.
    setRendererConfig({
        'asset.bundles.templates': config.avatar.templatesUrl,
        'asset.bundles.avatar': config.avatar.figureBundleUrl,
        'asset.bundles.effects': config.avatar.effectBundleUrl,
    });

    const startedAt = performance.now();
    const [ avatars, badges ] = await Promise.all([ AvatarImager.create(config.avatar, { maxLoadedLibraries: config.maxLoadedLibraries }), GroupBadgeImager.create(config.badge, DEFAULT_BADGE_PARTS) ]);

    console.log(`Avatar data and ${badges.table.partCount} badge parts (${badges.table.colorCount} colours) loaded in ${Math.round(performance.now() - startedAt)} ms`);

    const app = createApp({ avatars, badges, cache: new ImageCache(config.cacheBytes), avatarFrameDelay: AVATAR_FRAME_MS });

    serve({ fetch: app.fetch, hostname: config.host, port: config.port }, info => console.log(`Imager listening on http://${info.address}:${info.port}`));
};
