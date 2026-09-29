import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, RefAttributes } from 'react';

import { useThemeVariant } from './hooks';
import { ThemeImage } from './ThemeImage';
import { expandSides, ThemeProps, ThemeWithStatesVariant } from './utils';

export type ScrollbarSliderButtonRightVariant = ThemeWithStatesVariant;

export interface ScrollbarSliderButtonRightProps extends ThemeProps<ScrollbarSliderButtonRightVariant> {
    disabled?: boolean;
}

/**
 * Purely the themed skin - the press-and-hold repeat-scroll behaviour lives in the caller's
 * `useHoldToRepeat` (see ScrollbarHorizontal.tsx), spread in as the pointer handlers.
 */
export const ScrollbarSliderButtonRight: ForwardRefExoticComponent<ScrollbarSliderButtonRightProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollbarSliderButtonRightProps>(
    ({ variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, textStyle, textColor, disabled, onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap }, ref) => {
        const { config, handlers, resolvedLayer, resolvedTint } = useThemeVariant<ScrollbarSliderButtonRightVariant>({
            cascadeKey: 'scrollbarSliderButtonRight', variant, defaultVariant, tooltip, tooltipDelay, tintColor, textStyle, textColor, disabled,
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

ScrollbarSliderButtonRight.displayName = 'ScrollbarSliderButtonRight';
