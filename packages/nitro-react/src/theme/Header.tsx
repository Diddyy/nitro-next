import { Container as PixiContainer } from 'pixi.js';
import { forwardRef, ForwardRefExoticComponent, RefAttributes } from 'react';

import { Box } from './Box';
import { VariantCascadeProvider } from './cascade';
import { CloseButton } from './CloseButton';
import { useThemeVariant } from './hooks';
import { BackgroundLayer, ColorLayer } from './layer';
import { ThemeText } from './ThemeText';
import { expandSides, ThemeProps, ThemeVariant } from './utils';

export type HeaderVariant = ThemeVariant & {
    needsBgChip?: boolean;
    /** The skin's `header_button_menu`: its close button style and where the skin puts it, from the header's top left. */
    menuButton?: { variant: string; left: number; top: number };
    /** Where the window layout pins the title (`header_title_text`), from the header's top left, instead of centring it. */
    captionAt?: { left: number; top: number };
    /**
     * How far below the header's top the caption sits: `header_title_text`'s own `y` plus its
     * `margins.top`. The client does not centre the title vertically - `relative_vertical_scale_fixed`
     * holds the label at its layout's `y`, and `TextController` draws the text at `margins.top`
     * inside it. A rendered text is a `TextField`'s whole bitmap, gutter included, so its top edge
     * is the field's top and these are the layout's numbers as written: 1 for
     * `habbo_window_layout_header` (`y="0"` + 1), 3 for `_3` and `_7` (`y="2"` + 1).
     *
     * Left out, the caption centres in the header, which is what the variants whose layout has no
     * title `y` to read keep doing.
     */
    captionTop?: number;
    /**
     * How far below the header's top the `_CONTROLS` item list sits - its `y`, which is 0 in
     * `habbo_window_layout_header` and 2 in `_3` and `_7`. A layout with no item list at all
     * (the leaderboard and illumina dark headers) leaves it out, and the buttons centre in the
     * header instead.
     */
    controlsTop?: number;
    /** Where the window layout pins `header_button_close`, from the header's top right, instead of centring it on the right edge. */
    closeAt?: { right: number; top: number };
    /**
     * The close button style of the layout's `header_button_help`, for the window layouts that
     * have one (`habbo_window_layout_header_3` and `_7`: style 4, left of the close button in
     * the `_CONTROLS` item list, whose `spacing` is 5).
     */
    helpButton?: string;
};

/** `spacing` of the header layouts' `_CONTROLS` item list. */
const CONTROLS_SPACING = 5;

export interface HeaderProps extends ThemeProps<HeaderVariant> {
    caption?: string;
    onClose?: () => void;
    /** `header_button_close` exists: a dialog that disposes it (`SimpleAlertDialog`) passes false. */
    closeButtonVisible?: boolean;
    /** Shows the skin's menu button, for the variants whose skin has one (`menuButton`). */
    onMenu?: () => void;
    /**
     * `FrameController.helpPage`: a page other than '' shows the layout's `header_button_help`
     * (for the variants that have one, `helpButton`), and a click on it hands the page to
     * `onHelp` - `helpButtonProcedure`, whose callback the window manager sets to `openHelpPage`.
     */
    helpPage?: string;
    onHelp?: (page: string) => void;
}

export const Header: ForwardRefExoticComponent<HeaderProps & RefAttributes<PixiContainer>> = forwardRef<PixiContainer, HeaderProps>(
    ({
        variant, defaultVariant, tooltip, tooltipDelay, layout, tintColor, textStyle, textColor, visible, caption, onClose, closeButtonVisible = true, onMenu, helpPage, onHelp,
        onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
    }, ref) => {
        const { ownCascade, config, handlers, resolvedLayer, resolvedOverlay, resolvedTint, resolvedTextStyle, resolvedTextColor } = useThemeVariant<HeaderVariant>({
            cascadeKey: 'header', variant, defaultVariant, tooltip, tooltipDelay, tintColor, textStyle, textColor,
            onPointerOver, onPointerOut, onPointerDown, onPointerUp, onPointerUpOutside, onPointerTap,
        });

        const title = caption && (
            <ThemeText
                text={caption}
                textStyle={resolvedTextStyle}
                textOptions={{ fill: resolvedTextColor }}
            />
        );
        /*
         * A variant whose window layout pins the title / close button places them there; the rest
         * centre the title and put the close button on the right edge.
         *
         * `WindowController.updateScaleRelativeToParent`: a `relative_horizontal_scale_center`
         * child sits at `floor(parentWidth / 2) - floor(ownWidth / 2)` of its parent - so
         * `header_title_text` is centred across the whole header, and the close, help and menu
         * buttons are siblings at their own rectangles, never something the title is laid out
         * around. The title is out of flow here for that reason: in flow it shares the row with
         * whatever else the header carries, and a control that joined it would push the caption
         * off the header's centre.
         */
        const titleNode = config.captionAt
            ? title && <Box layout={{ position: 'absolute', left: config.captionAt.left, top: config.captionAt.top }}>{title}</Box>
            : (
                    <Box layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch' }}>
                        {title && (
                            <Box layout={{
                                position: 'relative',
                                height: '100%',
                                // `@pixi/layout` defaults `flexDirection` to `row`, so the caption's
                                // vertical placement is `alignItems` - `justifyContent` is across
                                // the box, and setting the offset on that one left the caption
                                // centred inside a box the padding had merely shortened.
                                justifyContent: 'center',
                                // At the variant's own offset down the header where its layout has
                                // been read, and centred in the header where it has not - see
                                // `captionTop`. Either way the box spans the header, so a
                                // `background="true"` label's chip is the full title bar.
                                ...(config.captionTop !== undefined
                                    ? { alignItems: 'flex-start', paddingTop: config.captionTop }
                                    : { alignItems: 'center' }),
                                // `header_title_text`'s own `margins`, which both
                                // `habbo_window_layout_header` and `_3` give as 8 either side.
                                paddingLeft: 8,
                                paddingRight: 8,
                            }}
                            >
                                { config.needsBgChip && <ColorLayer color={resolvedTint} /> }
                                {title}
                            </Box>
                        )}
                    </Box>
                );
        // `helpPage`'s setter: the help button is visible while there is a page. The item list it
        // shares with the close button keeps its right edge (`on_resize_align_right`), so the help
        // button sits `spacing` left of the close button.
        const helpNode = (config.helpButton && helpPage) && (
            <CloseButton
                variant={config.helpButton}
                onPointerTap={() => onHelp?.(helpPage)}
                layout={{ marginRight: CONTROLS_SPACING }}
            />
        );
        const closeNode = config.closeAt
            ? (
                    <Box layout={{ position: 'absolute', right: config.closeAt.right, top: config.closeAt.top, flexDirection: 'row' }}>
                        {helpNode}
                        {closeButtonVisible && <CloseButton onPointerTap={onClose} />}
                    </Box>
                )
            : (
                    <Box layout={{
                        position: 'absolute',
                        right: 0,
                        // The `_CONTROLS` item list's own `y` - see `controlsTop`. A header layout
                        // with no item list leaves it out, and the buttons centre in the header.
                        ...(config.controlsTop !== undefined && { top: config.controlsTop }),
                        paddingLeft: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                    >
                        { config.needsBgChip && <ColorLayer color={resolvedTint} /> }
                        {helpNode}
                        {closeButtonVisible && <CloseButton onPointerTap={onClose} />}
                    </Box>
                );

        return (
            <Box
                ref={ref}
                visible={visible}
                {...handlers}
                layout={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...expandSides(config.layout),
                    ...expandSides(layout),
                }}
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
                    {titleNode}
                    {onMenu && config.menuButton && (
                        <Box layout={{ position: 'absolute', left: config.menuButton.left, top: config.menuButton.top }}>
                            <CloseButton
                                variant={config.menuButton.variant}
                                onPointerTap={onMenu}
                            />
                        </Box>
                    )}
                    {closeNode}
                </VariantCascadeProvider>
            </Box>
        );
    },
);

Header.displayName = 'Header';
