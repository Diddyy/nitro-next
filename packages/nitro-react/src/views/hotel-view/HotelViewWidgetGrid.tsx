/**
 * `DynamicLayoutManager`: `dynamic_widget_grid` - the five widget slots of the landing view.
 * Slot 1 runs across the top; under it, a left column (slots 2 and 4, the left pane's width) and a
 * right one (slots 3 and 5, the right pane's), laid out by item lists. Every time the window
 * resizes or a slot changes size, `applyVerticalSize` lays them out again:
 *
 * - an empty slot 1 takes no height, an empty slot 2-5 one pixel (`clearEmptySlotsForSpace`);
 * - slots 2 and 3 are made as tall as each other (unless `landing.view.dynamic.slot.5.ignore`),
 *   and so are 4 and 5, so the two columns' rows line up (`alignTopWidgetRow` / `alignBottomWidgetRow`);
 * - the gaps start at their largest - 80 under slot 1, 50 between the rows, 60 between the columns
 *   (`resetToMaximumSpacing`) - and then give way to the room there is: the list is the window's
 *   height less 55 (never under 360, never over the layout's 767) and its width less 247 (never over
 *   925). Under slot 1 the gap is always 10 afterwards; between the rows it shrinks by however far
 *   the content overflows, down to 10 (`setVerticalSpacing`); between the columns it shrinks by
 *   however much narrower the list is, down to 10 (`setHorizontalSpacing`).
 *
 * A slot is occupied when its widget has a container - here, when the type is one the port draws
 * (`PORTED_LANDING_VIEW_WIDGETS`); a slot naming any other type stays empty, where Flash
 * would have shown that widget. The slots' separators (`landing.view.dynamic.slot.4/5.separator`,
 * `dynamic_widget_grid_separator`) are drawn when the hotel turns them on; it does not.
 */
import { Container as PixiContainer } from 'pixi.js';
import { ReactNode, useEffect, useState } from 'react';

import { hotelViewColorableFormat, hotelViewCommonSettings, hotelViewPaneWidths, hotelViewProperty, hotelViewSlotWidget, PORTED_LANDING_VIEW_WIDGETS, useConfigData, useTranslation } from '#base/context/system';
import { useViewportSize } from '#base/hooks';
import { Box, ColorableTextFormat, LayoutImage, Region, ThemeImage, ThemeText, useLayoutSize } from '#base/theme';

import { HotelViewSlotWidget } from './HotelViewSlotWidget';

/** `widgetlist_fromtop`'s place and size in the landing view's 1172x822 layout. */
export const HOTEL_VIEW_GRID_X = 256;
export const HOTEL_VIEW_GRID_Y = 4;
const LIST_WIDTH = 925;
const LIST_HEIGHT = 767;
/** `ABSOLUTE_MINIMUM_HEIGHT`. */
const LIST_MIN_HEIGHT = 360;
/** The layout's own size, which `resizeDynamicLayout` subtracts the desktop's from. */
const LAYOUT_WIDTH = 1172;
const LAYOUT_HEIGHT = 822;

/** `DynamicLayoutManager`'s spacings: the least and the most, top list, row and column gaps. */
const TOP_SPACING_MIN = 10;
const TOP_SPACING_MAX = 80;
const ROW_SPACING_MIN = 10;
const ROW_SPACING_MAX = 50;
const COLUMN_SPACING_MIN = 10;
const COLUMN_SPACING_MAX = 60;

/** `widget_slot_1`'s place in the list, and the width the top slot is laid out at. */
const SLOT_1_X = -1;
const SLOT_1_WIDTH = 800;

/** `dynamic_widget_grid_separator`: its height, the header line either side of the title. */
const SEPARATOR_HEIGHT = 20;

interface MeasuredSlotProps {
    slot: number;
    onHeight: (slot: number, height: number) => void;
    children: ReactNode;
}

/** Holds a slot's widget at its own size and reports that height to the grid. */
const MeasuredSlot = ({ slot, onHeight, children }: MeasuredSlotProps) => {
    const [ node, setNode ] = useState<PixiContainer | null>(null);
    const { height } = useLayoutSize(node);

    useEffect(() => {
        onHeight(slot, Math.ceil(height));
    }, [ slot, height, onHeight ]);

    return (
        <Box
            ref={setNode}
            layout={{ position: 'absolute', left: 0, top: 0 }}
        >
            {children}
        </Box>
    );
};

/** `enableSeparator`: `dynamic_widget_grid_separator` over slot 4 or 5, its title a text key. */
const Separator = ({ width, title, colorable }: { width: number; title: string; colorable: ColorableTextFormat }) => {
    const t = useTranslation();

    return (
        <Box layout={{ width, height: SEPARATOR_HEIGHT, flexDirection: 'row', flexShrink: 0 }}>
            <ThemeImage
                name="border_bar"
                src={LayoutImage('habbo-window-manager-com/illumina_light_border_top_center.png')}
                bitmap={{ pivot: 'center left', stretchedY: false }}
                layout={{ position: 'absolute', left: 0, top: 10, width: 12, height: 4 }}
            />
            <ThemeText
                name="separator_title"
                text={t(title)}
                textStyle="il_heading_3"
                textOptions={{ fontSize: 9, ...(colorable.fill ? { fill: colorable.fill } : {}) }}
                flashFormat={colorable.flashFormat}
                verticalAlign="top"
                layout={{ position: 'absolute', left: 18, top: 4 }}
            />
            <ThemeImage
                name="hdr_line"
                src={LayoutImage('habbo-window-manager-com/illumina_light_border_top_center.png')}
                bitmap={{ pivot: 'center left', stretchedY: false }}
                layout={{ position: 'absolute', left: 64, top: 10, width: 450, height: 4 }}
            />
        </Box>
    );
};

export const HotelViewWidgetGrid = () => {
    const config = useConfigData();
    const { width, height } = useViewportSize();
    const settings = hotelViewCommonSettings(config);
    const colorable = hotelViewColorableFormat(settings);
    const [ heights, setHeights ] = useState<Record<number, number>>({});
    const configString = (key: string) => hotelViewProperty(config, key);
    const configBoolean = (key: string) => configString(key) === 'true';
    const panes = hotelViewPaneWidths(config);

    const onHeight = (slot: number, slotHeight: number) => setHeights(previous => ((previous[slot] === slotHeight) ? previous : { ...previous, [slot]: slotHeight }));

    const widgetType = (slot: number) => hotelViewSlotWidget(config, slot);
    const occupied = (slot: number) => PORTED_LANDING_VIEW_WIDGETS.has(widgetType(slot));
    const natural = (slot: number) => (occupied(slot) ? (heights[slot] ?? 0) : ((slot === 1) ? 0 : 1));
    const separator = (slot: number) => (configBoolean(`landing.view.dynamic.slot.${slot}.separator`) ? configString(`landing.view.dynamic.slot.${slot}.title`) : undefined);

    // `resizeDynamicLayout` -> `resizeTo`.
    const listWidth = Math.min(LIST_WIDTH - (LAYOUT_WIDTH - width), LIST_WIDTH);
    const listHeight = Math.max(LIST_MIN_HEIGHT, Math.min(LIST_HEIGHT - (LAYOUT_HEIGHT - height), LIST_HEIGHT));

    // `alignTopWidgetRow` / `alignBottomWidgetRow`.
    const alignTop = (occupied(2) || occupied(3)) && !configBoolean('landing.view.dynamic.slot.5.ignore');
    const topRow = alignTop ? Math.max(natural(2), natural(3)) : 0;
    const slot2 = alignTop ? topRow : natural(2);
    const slot3 = alignTop ? topRow : natural(3);
    const bottomRow = (occupied(4) || occupied(5)) ? Math.max(natural(4), natural(5)) : 0;
    const slot4 = (occupied(4) || occupied(5)) ? bottomRow : natural(4);
    const slot5 = (occupied(4) || occupied(5)) ? bottomRow : natural(5);
    const separator4 = separator(4);
    const separator5 = separator(5);
    const slot4Root = slot4 + ((separator4 !== undefined) ? SEPARATOR_HEIGHT : 0);
    const slot5Root = slot5 + ((separator5 !== undefined) ? SEPARATOR_HEIGHT : 0);

    // `setVerticalSpacing(topItemListContentHeight - list height)`, measured at the largest spacings.
    const centerAtMax = Math.max(slot2 + ROW_SPACING_MAX + slot4Root, slot3 + ROW_SPACING_MAX + slot5Root);
    const overflow = (natural(1) + TOP_SPACING_MAX + centerAtMax - listHeight) + TOP_SPACING_MIN + ROW_SPACING_MIN;
    const rowSpacing = (overflow <= 0)
        ? ROW_SPACING_MAX
        : (overflow < (ROW_SPACING_MAX - ROW_SPACING_MIN)) ? (ROW_SPACING_MAX - overflow) : ROW_SPACING_MIN;
    const topSpacing = TOP_SPACING_MIN;

    // `setHorizontalSpacing`.
    const narrowedBy = LIST_WIDTH - listWidth;
    const columnSpacing = (narrowedBy > (COLUMN_SPACING_MAX - COLUMN_SPACING_MIN)) ? COLUMN_SPACING_MIN : Math.min(COLUMN_SPACING_MAX, COLUMN_SPACING_MAX - narrowedBy);

    const renderWidget = (slot: number) => (
        <HotelViewSlotWidget
            type={widgetType(slot)}
            slot={slot}
            code={null}
            settings={settings}
        />
    );

    const slotBox = (slot: number, slotWidth: number, slotHeight: number, left: number = 0) => (
        <Region
            name={`widget_slot_${slot}`}
            layout={{ marginLeft: left, width: slotWidth, height: slotHeight, flexShrink: 0 }}
        >
            {occupied(slot) && (
                <MeasuredSlot
                    slot={slot}
                    onHeight={onHeight}
                >
                    {renderWidget(slot)}
                </MeasuredSlot>
            )}
        </Region>
    );

    return (
        <Region
            name="widgetlist_fromtop"
            layout={{ position: 'absolute', left: HOTEL_VIEW_GRID_X, top: HOTEL_VIEW_GRID_Y, width: Math.max(0, listWidth), height: listHeight, flexDirection: 'column', gap: topSpacing, overflow: 'hidden' }}
        >
            {slotBox(1, SLOT_1_WIDTH, natural(1), SLOT_1_X)}
            <Region
                name="widget_slots_center_scrollable"
                layout={{ flexDirection: 'row', gap: columnSpacing, flexShrink: 0 }}
            >
                <Region
                    name="widget_slots_center_left"
                    layout={{ width: panes.left, flexDirection: 'column', gap: rowSpacing, flexShrink: 0 }}
                >
                    {slotBox(2, panes.left, slot2)}
                    <Region
                        name="widget_slot_4_root"
                        layout={{ width: panes.left, flexDirection: 'column', flexShrink: 0 }}
                    >
                        {(separator4 !== undefined) && (
                            <Separator
                                width={panes.left}
                                title={separator4}
                                colorable={colorable}
                            />
                        )}
                        {slotBox(4, panes.left, slot4)}
                    </Region>
                </Region>
                <Region
                    name="widget_slots_center_right"
                    layout={{ width: panes.right, flexDirection: 'column', gap: rowSpacing, flexShrink: 0 }}
                >
                    {slotBox(3, panes.right, slot3)}
                    <Region
                        name="widget_slot_5_root"
                        layout={{ width: panes.right, flexDirection: 'column', flexShrink: 0 }}
                    >
                        {(separator5 !== undefined) && (
                            <Separator
                                width={panes.right}
                                title={separator5}
                                colorable={colorable}
                            />
                        )}
                        {slotBox(5, panes.right, slot5)}
                    </Region>
                </Region>
            </Region>
        </Region>
    );
};
