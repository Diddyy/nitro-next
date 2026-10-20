import { Filter } from 'pixi.js';
import { useEffect, useRef } from 'react';

import { BoxLayout, useTextureFromUrl } from '#base/theme';

import { useBadgeGlow } from './useBadgeGlow';

const NO_FILTERS: Filter[] = [];

export interface BadgeGlowImageProps {
    url: string | undefined;
    /** The slot's `glowColor`: -1 (the default) for a badge that never glows. */
    glowColor?: number;
    /**
     * What has its code call `playGlow(glowColor)`: each new value plays the glow once, for a badge
     * with a glow colour. Undefined plays nothing.
     */
    glowSignal?: string | number;
    layout?: BoxLayout;
}

/**
 * A `badge_image` widget's badge at its own size, glowing as `BadgeImageWidget.playGlow` makes it
 * (`useBadgeGlow`). Setting the glow colour to -1 clears a glow under way (`set glowColor`).
 */
export const BadgeGlowImage = ({ url, glowColor = -1, glowSignal, layout }: BadgeGlowImageProps) => {
    const texture = useTextureFromUrl(url);
    const { filters, playGlow, clearGlow } = useBadgeGlow(url, !!texture);
    const playedSignal = useRef<string | number | undefined>(undefined);

    useEffect(() => {
        if (glowColor < 0) {
            clearGlow();

            return;
        }

        if ((glowSignal === undefined) || (glowSignal === playedSignal.current)) return;

        playedSignal.current = glowSignal;

        if (url) playGlow(glowColor);
    }, [ url, glowColor, glowSignal, playGlow, clearGlow ]);

    if (!texture) return null;

    return (
        <pixiSprite
            texture={texture}
            filters={filters ?? NO_FILTERS}
            eventMode="none"
            layout={{ width: texture.width, height: texture.height, ...layout }}
        />
    );
};
