/**
 * The strip that folds a bar away: the `roomtools_minimizebutton` arrow over a style 2 border in
 * `0x3b3933`. Three layouts draw it - the room tools' `side_bar_collapse` / `side_bar_expand`
 * (`room_tools_toolbar`), the bottom bar's `collapse_left` / `collapse_right` with the border at
 * (-6, 0) of `bottom_bar_left`, and the friend bar's `collapse_left` / `collapse_right` of
 * `new_bar` - each with the same art and tint and its own geometry, so the geometry is the
 * caller's and the art is this.
 *
 * The region clips, as a Flash region does: a 20-wide border in a 15-wide region shows rounded
 * corners on one side only, which is how the bottom bar and friend bar strips are cut.
 */
import { Border, BoxLayout, LayoutImage, Region, ThemeImage } from '#base/theme';

/** `[ x, y, width, height ]` inside the strip's region. */
type Rect = readonly [ number, number, number, number ];

export interface RoomToolsMinimizeButtonProps {
    /** The clickable region's own box. */
    layout: BoxLayout;
    /** The style 2 border behind the arrow. */
    border: Rect;
    /** The arrow's box; the 6x8 bitmap is drawn unstretched and centred in it (`pivot_point` center). */
    arrow: Rect;
    /** `zoom_x` -1: the arrow points right instead of left. */
    mirrored?: boolean;
    /** `etching_color` 0x48000000, which only the bottom bar's `icons_toolbar_collapse_right` carries. */
    etched?: boolean;
    alpha?: number;
    onPress: () => void;
}

export const RoomToolsMinimizeButton = ({
    layout, border: [ borderX, borderY, borderWidth, borderHeight ], arrow: [ arrowX, arrowY, arrowWidth, arrowHeight ],
    mirrored = false, etched = false, alpha, onPress,
}: RoomToolsMinimizeButtonProps) => (
    <Region
        onPointerTap={onPress}
        cursor="pointer"
        alpha={alpha}
        layout={{ ...layout, overflow: 'hidden' }}
    >
        <Border
            variant="2"
            tintColor="#3b3933"
            layout={{ position: 'absolute', left: borderX, top: borderY, width: borderWidth, height: borderHeight }}
        />
        <ThemeImage
            src={LayoutImage('habbo-window-manager-com/roomtools_minimizebutton.png')}
            bitmap={{
                stretchedX: false,
                stretchedY: false,
                pivot: 'center',
                ...(mirrored && { zoomX: -1 }),
                ...(etched && { etchingColor: 0x48000000 }),
            }}
            layout={{ position: 'absolute', left: arrowX, top: arrowY, width: arrowWidth, height: arrowHeight }}
        />
    </Region>
);
