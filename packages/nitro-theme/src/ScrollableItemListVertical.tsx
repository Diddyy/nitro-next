import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

import { Box, BoxLayout } from './Box';
import { VariantCascadeProvider } from './cascade';
import { useResolvedVariant } from './hooks';
import { expandSides, ThemeVariant, wrapTextChildren } from './utils';
import { themeVariantOf } from './utils/themeRegistry';

/**
 * `scrollable_itemlist_vertical`: no art of its own - a leaf that sizes the grid or list content it holds, at least as big
 * as its window layout (the theme's `scrollableItemListVertical` variants).
 */
export interface ScrollableItemListVerticalProps {
    variant?: string;
    defaultVariant?: string;
    layout?: BoxLayout;
    children?: ReactNode;
}

export const ScrollableItemListVertical: ForwardRefExoticComponent<ScrollableItemListVerticalProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, ScrollableItemListVerticalProps>(
    ({ variant, defaultVariant, layout, children }, ref) => {
        const { resolvedVariant, ownCascade } = useResolvedVariant('scrollableItemListVertical', variant, defaultVariant);
        const config = themeVariantOf<ThemeVariant>('scrollableItemListVertical', resolvedVariant) ?? themeVariantOf<ThemeVariant>('scrollableItemListVertical', '0');

        return (
            <Box
                ref={ref}
                layout={{ ...expandSides(config?.layout), ...layout }}
            >
                {/* DOM's `text-[#000000]` needs no explicit style here - PixiJS's own default
                    TextStyle fill is already black, so wrapTextChildren's unstyled pixiText
                    matches it by coincidence rather than by an explicit override. */}
                <VariantCascadeProvider map={ownCascade}>{wrapTextChildren(children)}</VariantCascadeProvider>
            </Box>
        );
    },
);

ScrollableItemListVertical.displayName = 'ScrollableItemListVertical';
