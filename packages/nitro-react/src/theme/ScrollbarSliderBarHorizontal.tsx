import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, RefAttributes } from 'react';

import { Box } from './Box';
import { useThemeVariant } from './hooks';
import { BackgroundLayer } from './layer';
import { ThemeProps, ThemeWithStatesVariant } from './utils';

export type ScrollbarSliderBarHorizontalVariant = ThemeWithStatesVariant;

export interface ScrollbarSliderBarHorizontalProps extends ThemeProps<ScrollbarSliderBarHorizontalVariant> {
    /** The scrollbar is disabled (its content fits): the lift fills the track in its `disabled` art and takes no input. */
    disabled?: boolean;
}

export const ScrollbarSliderBarHorizontal: ForwardRefExoticComponent<ScrollbarSliderBarHorizontalProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollbarSliderBarHorizontalProps>(
    ({
        variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, disabled,
        onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
    }, ref) => {
        const { config, state, handlers, resolvedLayer, resolvedOverlay, resolvedTint } = useThemeVariant<ScrollbarSliderBarHorizontalVariant>({
            cascadeKey: 'scrollbarSliderBarHorizontal', variant, defaultVariant, tooltip, tooltipDelay, tintColor, disabled,
            onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
        });
        const mergedLayout = { position: 'absolute' as const, ...config.layout, ...layout };

        return (
            <Box
                ref={ref}
                layout={mergedLayout}
                {...handlers}
                cursor={disabled ? 'default' : (state === 'pressed' ? 'grabbing' : 'grab')}
            >
                {resolvedLayer && (
                    <BackgroundLayer
                        layer={resolvedLayer}
                        tintColor={resolvedTint}
                    />
                )}
                {/* `layout` lets the grip strip's insets resolve against the thumb's real size -
                    see `BackgroundLayer.tsx` on `containerWidth`/`containerHeight`. */}
                {resolvedOverlay && (
                    <BackgroundLayer
                        layer={resolvedOverlay}
                        layout={mergedLayout}
                    />
                )}
            </Box>
        );
    },
);

ScrollbarSliderBarHorizontal.displayName = 'ScrollbarSliderBarHorizontal';
