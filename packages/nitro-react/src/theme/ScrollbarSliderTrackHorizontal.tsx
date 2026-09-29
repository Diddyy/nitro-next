import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

import { Box } from './Box';
import { VariantCascadeProvider } from './cascade';
import { useThemeVariant } from './hooks';
import { BackgroundLayer } from './layer';
import { ThemeProps, ThemeWithStatesVariant, wrapTextChildren } from './utils';

export type ScrollbarSliderTrackHorizontalVariant = ThemeWithStatesVariant;

export interface ScrollbarSliderTrackHorizontalProps extends ThemeProps<ScrollbarSliderTrackHorizontalVariant> {
    disabled?: boolean;
    children?: ReactNode;
}

/** Pixi port of theme/ScrollbarSliderTrackHorizontal.tsx - the clickable track behind the thumb. */
export const ScrollbarSliderTrackHorizontal: ForwardRefExoticComponent<ScrollbarSliderTrackHorizontalProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollbarSliderTrackHorizontalProps>(
    ({ variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, textStyle, textColor, disabled, children, onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap }, ref) => {
        const { ownCascade, config, handlers, resolvedLayer, resolvedOverlay, resolvedTint, resolvedTextStyle, resolvedTextColor } = useThemeVariant<ScrollbarSliderTrackHorizontalVariant>({
            cascadeKey: 'scrollbarSliderTrackHorizontal', variant, defaultVariant, tooltip, tooltipDelay, tintColor, textStyle, textColor, disabled,
            onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
        });

        return (
            <Box
                ref={ref}
                layout={{ flex: 1, ...config.layout, ...layout }}
                {...handlers}
            >
                {resolvedLayer && (
                    <BackgroundLayer
                        layer={resolvedLayer}
                        tintColor={resolvedTint}
                    />
                )}
                {resolvedOverlay && <BackgroundLayer layer={resolvedOverlay} />}
                <VariantCascadeProvider map={ownCascade}>
                    {wrapTextChildren(children, { textStyle: resolvedTextStyle, textColor: resolvedTextColor })}
                </VariantCascadeProvider>
            </Box>
        );
    },
);

ScrollbarSliderTrackHorizontal.displayName = 'ScrollbarSliderTrackHorizontal';
