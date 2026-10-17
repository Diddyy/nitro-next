import { useFriendBarWidth, useToolbarAreaWidth } from '#base/context/system';
import { useRoomToolsCollapsed } from '#base/context/user';
import { useViewportSize } from '#base/hooks';
import { roomToolsRight } from '#base/views/room-widgets/room-tools/roomToolsGeometry';

/** `RoomChatInputView.updatePosition` - the gap kept from whatever sits left of the chat bar. */
const LEFT_MARGIN = 12;
/** The room the centred bar must leave the toolbar's icons on top of its own margin - `updatePosition`'s `+ 100`. */
const TOOLBAR_CLEARANCE = 100;
/** `bubblecont.y`: `height - 104` in the toolbar, `height - 160` above it. */
const BUBBLECONT_FROM_BOTTOM_IN_TOOLBAR = 104;
const BUBBLECONT_FROM_BOTTOM_ABOVE_TOOLBAR = 160;

/**
 * `RoomChatInputView.updatePosition`: `bubblecont` (`width` wide) sits centred in the toolbar when
 * the toolbar's icons and the friend bar leave it the room - its top `height - 104` - and otherwise
 * moves up to `height - 160` and starts right of the room tools, still centred if the centre is
 * clear of them.
 */
export const useChatInputPlacement = (width: number) => {
    // The bar starts where the room tools end, as `RoomToolsWidget.getWidgetAreaWidth` told it to.
    const roomToolsCollapsed = useRoomToolsCollapsed();
    const { width: viewportWidth, height: viewportHeight } = useViewportSize();
    const toolbarAreaWidth = useToolbarAreaWidth();
    const friendBarWidth = useFriendBarWidth();

    const centredLeft = ~~((viewportWidth / 2) - (width / 2));
    const fitsInToolbar = ((viewportWidth - toolbarAreaWidth - friendBarWidth) > (width + LEFT_MARGIN))
        && (centredLeft >= (toolbarAreaWidth + LEFT_MARGIN + TOOLBAR_CLEARANCE))
        && ((centredLeft + width) <= (viewportWidth - friendBarWidth));
    const left = fitsInToolbar ? centredLeft : Math.max(centredLeft, roomToolsRight(roomToolsCollapsed) + LEFT_MARGIN);
    const top = viewportHeight - (fitsInToolbar ? BUBBLECONT_FROM_BOTTOM_IN_TOOLBAR : BUBBLECONT_FROM_BOTTOM_ABOVE_TOOLBAR);

    return { left, top };
};
