import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

import { Box } from './Box';
import { VariantCascadeProvider } from './cascade';
import { useThemeVariant } from './hooks';
import { BackgroundLayer } from './layer';
import { ThemeProps, ThemeWithStatesVariant, wrapTextChildren } from './utils';

export type ScrollbarSliderTrackVerticalVariant = ThemeWithStatesVariant;

export interface ScrollbarSliderTrackVerticalProps extends ThemeProps<ScrollbarSliderTrackVerticalVariant> {
    disabled?: boolean;
    children?: ReactNode;
}

export const ScrollbarSliderTrackVertical: ForwardRefExoticComponent<ScrollbarSliderTrackVerticalProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollbarSliderTrackVerticalProps>(
    ({
        variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, textStyle, textColor, disabled, children,
        onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
    }, ref) => {
        const { ownCascade, config, handlers, resolvedLayer, resolvedOverlay, resolvedTint, resolvedTextStyle, resolvedTextColor } = useThemeVariant<ScrollbarSliderTrackVerticalVariant>({
            cascadeKey: 'scrollbarSliderTrackVertical', variant, defaultVariant, tooltip, tooltipDelay, tintColor, textStyle, textColor, disabled,
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

ScrollbarSliderTrackVertical.displayName = 'ScrollbarSliderTrackVertical';
