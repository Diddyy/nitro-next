import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

import { Box, BoxLayout } from './Box';
import { VariantCascadeProvider } from './cascade';
import { useResolvedVariant } from './hooks';
import { expandSides, ThemeVariant, wrapTextChildren } from './utils';
import { themeVariantOf } from './utils/themeRegistry';

/**
 * `scrollable_itemgrid_vertical`: no art of its own - a leaf that sizes the grid or list content it holds, at least as big
 * as its window layout (the theme's `scrollableItemGridVertical` variants).
 */
export interface ScrollableItemGridVerticalProps {
    variant?: string;
    defaultVariant?: string;
    layout?: BoxLayout;
    children?: ReactNode;
}

export const ScrollableItemGridVertical: ForwardRefExoticComponent<ScrollableItemGridVerticalProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollableItemGridVerticalProps>(
    ({ variant, defaultVariant, layout, children }, ref) => {
        const { resolvedVariant, ownCascade } = useResolvedVariant('scrollableItemGridVertical', variant, defaultVariant);
        const config = themeVariantOf<ThemeVariant>('scrollableItemGridVertical', resolvedVariant) ?? themeVariantOf<ThemeVariant>('scrollableItemGridVertical', '0');

        return (
            <Box
                ref={ref}
                layout={{ ...expandSides(config?.layout), ...layout }}
            >
                {/* DOM's `text-[#000000]` needs no explicit style here - PixiJS's own default
                    TextStyle fill is already black, matching by coincidence, not override. */}
                <VariantCascadeProvider map={ownCascade}>{wrapTextChildren(children)}</VariantCascadeProvider>
            </Box>
        );
    },
);

ScrollableItemGridVertical.displayName = 'ScrollableItemGridVertical';
