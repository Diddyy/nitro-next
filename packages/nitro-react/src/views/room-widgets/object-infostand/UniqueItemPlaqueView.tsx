import { Box, LayoutImage, TemplateWindow, ThemeImage } from '#base/theme';

/** The `unique_item_label_number_glyphs` strip: `x, width` of each digit, from the window manager manifest. */
const GLYPHS: [number, number][] = [ [ 1, 5 ], [ 6, 3 ], [ 9, 5 ], [ 14, 5 ], [ 19, 5 ], [ 24, 5 ], [ 29, 5 ], [ 34, 5 ], [ 39, 5 ], [ 44, 5 ] ];
const GLYPH_HEIGHT = 5;
const GLYPH_STRIP = LayoutImage('habbo-window-manager-com/unique_item_label_number_glyphs.png');
/** `LimitedItemNumberBitmap.createBitmap` draws nothing for anything it cannot fit in six digits. */
const MAX_NUMBER = 999999;

/**
 * A number set in the strip's glyphs, centred in a `width`x5 slot (20 on the plaque) -
 * `LimitedItemNumberBitmap.createBitmap`. The catalogue's grid overlay sets its serial in a 24px slot.
 */
export const GlyphNumber = ({ value, width = 20, layout }: { value: number; width?: number; layout: { left: number; top?: number; bottom?: number } }) => {
    const digits = ((value < 0) || (value > MAX_NUMBER)) ? [] : String(value).split('').map(Number);

    return (
        <Box layout={{ position: 'absolute', width, height: GLYPH_HEIGHT, flexDirection: 'row', justifyContent: 'center', ...layout }}>
            {digits.map((digit, index) => (
                <ThemeImage
                    key={index}
                    src={GLYPH_STRIP}
                    frame={{ x: GLYPHS[digit][0], y: 0, width: GLYPHS[digit][1], height: GLYPH_HEIGHT }}
                    // Each glyph carries a pixel of spacing on its right; the last one gives it back.
                    layout={{ marginRight: (index === digits.length - 1) ? -1 : 0 }}
                />
            ))}
        </Box>
    );
};

/** The width of `unique_item_serial_number_bitmap` and `unique_item_edition_size_bitmap`, the slots the numbers are centred in. */
const NUMBER_WIDTH = 20;

export interface UniqueItemPlaqueViewProps {
    serialNumber: number;
    seriesSize: number;
    /** Where the widget's window is in the window that holds it. */
    layout?: { left?: number; top?: number; right?: number; bottom?: number };
}

/**
 * The little metal plaque a limited edition item wears - the infostand's `unique_item_plaque_widget`
 * (`widget_type` `limited_item_overlay_preview`), `LimitedItemPreviewOverlayWidget`, which builds
 * `habbo-window-manager-com/unique_item_overlay_preview_xml` as its root window: the
 * `unique_item_large_tile_upright` plate, and `set serialNumber` / `set seriesSize` filling
 * `unique_item_serial_number_bitmap` over `unique_item_edition_size_bitmap` with
 * `LimitedItemNumberBitmap.createBitmap`.
 */
export const UniqueItemPlaqueView = ({ serialNumber, seriesSize, layout }: UniqueItemPlaqueViewProps) => (
    <Box layout={{ position: 'absolute', ...layout }}>
        <TemplateWindow
            id="habbo-window-manager-com/unique_item_overlay_preview_xml"
            bindings={{
                unique_item_serial_number_bitmap: {
                    children: (
                        <GlyphNumber
                            value={serialNumber}
                            width={NUMBER_WIDTH}
                            layout={{ left: 0, top: 0 }}
                        />
                    ),
                },
                unique_item_edition_size_bitmap: {
                    children: (
                        <GlyphNumber
                            value={seriesSize}
                            width={NUMBER_WIDTH}
                            layout={{ left: 0, top: 0 }}
                        />
                    ),
                },
            }}
        />
    </Box>
);
