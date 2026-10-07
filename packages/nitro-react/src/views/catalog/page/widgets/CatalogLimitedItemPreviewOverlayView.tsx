import { TemplateWindow } from '#base/theme';
import { GlyphNumber } from '#base/views/room-widgets/object-infostand/UniqueItemPlaqueView';

/** The width of `unique_item_serial_number_bitmap` and `unique_item_edition_size_bitmap`, the slots the numbers are centred in. */
const NUMBER_WIDTH = 20;

export interface CatalogLimitedItemPreviewOverlayViewProps {
    /** `serialNumber`. */
    serialNumber: number;
    /** `seriesSize`. */
    seriesSize: number;
}

/**
 * The limited edition plaque over a preview - the `limited_item_overlay_preview` window widget,
 * `LimitedItemPreviewOverlayWidget`, which builds `unique_item_overlay_preview_xml` as its root
 * window. `set serialNumber` and `set seriesSize` fill `unique_item_serial_number_bitmap` and
 * `unique_item_edition_size_bitmap` with `LimitedItemNumberBitmap.createBitmap`.
 */
export const CatalogLimitedItemPreviewOverlayView = ({ serialNumber, seriesSize }: CatalogLimitedItemPreviewOverlayViewProps) => (
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
);
