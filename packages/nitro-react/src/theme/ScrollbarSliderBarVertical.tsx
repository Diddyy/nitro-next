import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, RefAttributes } from 'react';

import { Box } from './Box';
import { useThemeVariant } from './hooks';
import { BackgroundLayer } from './layer';
import { ThemeProps, ThemeWithStatesVariant } from './utils';

export type ScrollbarSliderBarVerticalVariant = ThemeWithStatesVariant;

export interface ScrollbarSliderBarVerticalProps extends ThemeProps<ScrollbarSliderBarVerticalVariant> {
    /** The scrollbar is disabled (its content fits): the lift fills the track in its `disabled` art and takes no input. */
    disabled?: boolean;
}

export const ScrollbarSliderBarVertical: ForwardRefExoticComponent<ScrollbarSliderBarVerticalProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollbarSliderBarVerticalProps>(
    ({
        variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, disabled,
        onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
    }, ref) => {
        const { config, state, handlers, resolvedLayer, resolvedOverlay, resolvedTint } = useThemeVariant<ScrollbarSliderBarVerticalVariant>({
            cascadeKey: 'scrollbarSliderBarVertical', variant, defaultVariant, tooltip, tooltipDelay, tintColor, disabled,
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
                { resolvedLayer && (
                    <BackgroundLayer
                        layer={resolvedLayer}
                        tintColor={resolvedTint}
                    />
                ) }
                {/* `layout` here is what lets the overlay's tile insets compute a real height
                    instead of falling back to its texture's own intrinsic size - see
                    `BackgroundLayer.tsx`'s docblock on `containerHeight`. */}
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

ScrollbarSliderBarVertical.displayName = 'ScrollbarSliderBarVertical';
