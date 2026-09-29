import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

import { Box, BoxLayout } from './Box';
import { VariantCascadeProvider } from './cascade';
import { useThemeVariant } from './hooks';
import { BackgroundLayer } from './layer';
import { expandSides, ThemeProps, ThemeWithStatesVariant, wrapTextChildren } from './utils';

export type CheckBoxVariant = ThemeWithStatesVariant;

export interface CheckBoxProps extends ThemeProps<CheckBoxVariant> {
    disabled?: boolean;
    selected?: boolean;
    /**
     * The window's `blend` (`WindowController.blend`): the opacity its graphic context is drawn
     * with, clamped to 0..1 as the setter does, covering the art and the label alike.
     */
    alpha?: number;
    children?: ReactNode;
}

export const CheckBox: ForwardRefExoticComponent<CheckBoxProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, CheckBoxProps>(
    ({ variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, textStyle, textColor, visible, disabled, selected, alpha, children,
        onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap }, ref) => {
        const { ownCascade, config, handlers, resolvedLayer, resolvedOverlay, resolvedTint, resolvedTextStyle, resolvedTextColor } = useThemeVariant<CheckBoxVariant>({
            cascadeKey: 'checkBox', variant, defaultVariant, tooltip, tooltipDelay, tintColor, textStyle, textColor, disabled, selected,
            onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
        });

        // The skin's layout entities are `fixed`: `BitmapSkinRenderer.draw` copies them at their own
        // size from the window's top-left, however large the window is - never stretched over it.
        const skinLayout: BoxLayout = { position: 'absolute', left: 0, top: 0, width: config.layout?.width, height: config.layout?.height };

        return (
            <Box
                ref={ref}
                visible={visible}
                alpha={(alpha === undefined) ? undefined : Math.min(1, Math.max(0, alpha))}
                layout={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...expandSides(config.layout),
                    ...expandSides(layout),
                }}
                {...handlers}
            >
                {resolvedLayer && (
                    <BackgroundLayer
                        layer={resolvedLayer}
                        tintColor={resolvedTint}
                        layout={skinLayout}
                    />
                )}
                {resolvedOverlay && (
                    <BackgroundLayer
                        layer={resolvedOverlay}
                        layout={skinLayout}
                    />
                )}
                <VariantCascadeProvider map={ownCascade}>
                    {wrapTextChildren(children, { textStyle: resolvedTextStyle, textColor: resolvedTextColor })}
                </VariantCascadeProvider>
            </Box>
        );
    },
);

CheckBox.displayName = 'CheckBox';
