import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, RefAttributes } from 'react';

import { useThemeVariant } from './hooks';
import { ThemeImage } from './ThemeImage';
import { expandSides, ThemeProps, ThemeWithStatesVariant } from './utils';

export type ScrollbarSliderButtonUpVariant = ThemeWithStatesVariant;

export interface ScrollbarSliderButtonUpProps extends ThemeProps<ScrollbarSliderButtonUpVariant> {
    disabled?: boolean;
}

/**
 * Purely the themed skin - the press-and-hold repeat-scroll behaviour lives in the caller's
 * `useHoldToRepeat` (see ScrollbarVertical.tsx), spread in as the pointer handlers.
 */
export const ScrollbarSliderButtonUp: ForwardRefExoticComponent<ScrollbarSliderButtonUpProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollbarSliderButtonUpProps>(
    ({ variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, textStyle, textColor, disabled, onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap }, ref) => {
        const { config, handlers, resolvedLayer, resolvedTint } = useThemeVariant<ScrollbarSliderButtonUpVariant>({
            cascadeKey: 'scrollbarSliderButtonUp', variant, defaultVariant, tooltip, tooltipDelay, tintColor, textStyle, textColor, disabled,
            onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
        });

        if (!resolvedLayer || resolvedLayer.kind !== 'sprite') return null;

        return (
            <ThemeImage
                ref={ref}
                textureKey={resolvedLayer.textureKey}
                tint={resolvedTint}
                {...handlers}
                layout={{ ...expandSides(config.layout), ...expandSides(layout) }}
            />
        );
    },
);

ScrollbarSliderButtonUp.displayName = 'ScrollbarSliderButtonUp';
