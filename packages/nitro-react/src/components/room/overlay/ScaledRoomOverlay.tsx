/**
 * A window drawn over the room at the room's zoom - Flash `ScaledWindow` as of WIN63-202610131318
 * (`com/sulake/habbo/window/utils/ScaledWindow.as`, class `core.window.utils.ScaledWindow`), which the
 * WIRED leaderboard panel and, since that build, the furniture labels are drawn in.
 *
 * Flash draws the content's graphic context into a sprite scaled by `scale` and puts a region of
 * `ceil(content * scale)` in the window tree that forwards the pointer to the content at
 * `local / scale` (`updateSize` 144-151, `onWindowEvent` 153-215). Here the content is a Pixi
 * container scaled the same way: Pixi hit-tests and routes the pointer through the scale itself, so
 * only what Flash adds on top is kept:
 * - `scale` follows the room on every room frame: `geometry.scale / 64 * |canvas scale|`
 *   (`VariableLeaderboardLocationProjector.getScale` 164-168; `FurnitureLabelView.updatePosition` 169).
 * - `draggable` (118-132): while set, the whole window is dragged and its content takes no input
 *   (`findTarget` is skipped, 168); every move is reported as `WE_RELOCATED` is (`onDragged`).
 * - A scrollbar lift dragged inside it follows the pointer in the content's own pixels (1318,
 *   `beginScrollbarDrag` 217-249): the theme's scroll controller converts the pointer by the lift's
 *   world scale.
 *
 * Users mount it among the room widgets before the others, as Flash puts the leaderboard and the
 * labels in the desktop's `background_widgets` container under the rest of the room UI
 * (`DesktopLayoutManager.as` 95).
 */
import { RoomRenderedEvent } from '@nitrodevco/nitro-api';
import { Container as PixiContainer, FederatedPointerEvent } from 'pixi.js';
import { ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

import { useRoomEventDispatcher } from '#base/hooks';
import { Box } from '#base/theme';

import { getRoomOverlayScale } from './getRoomOverlayScale';

export type ScaledRoomOverlayProps = {
    /**
     * Where the window's top-left goes, given its size on screen (content size times `scale`)
     * and the scale; null hides it. Called after every room frame. Flash rounds the result
     * (`VariableLeaderboardView.setAnchor` 435-436, `FurnitureLabelView.updatePosition`), and so
     * does this.
     */
    place: (width: number, height: number, scale: number) => { x: number; y: number } | null;
    /** `ScaledWindow.draggable`: drag the whole window; its content takes no input meanwhile. */
    draggable?: boolean;
    /** Each drag step's new top-left and on-screen size, as `WE_RELOCATED` reports it. */
    onDragged?: (x: number, y: number, width: number, height: number) => void;
    /** `blend`, e.g. 0.35 for a leaderboard that is not the one being edited. */
    alpha?: number;
    children?: ReactNode;
};

export const ScaledRoomOverlay = ({ place, draggable = false, onDragged, alpha = 1, children }: ScaledRoomOverlayProps) => {
    const nodeRef = useRef<PixiContainer>(null);
    const placedRef = useRef(false);
    const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
    const placeRef = useRef(place);
    const onDraggedRef = useRef(onDragged);

    useLayoutEffect(() => {
        placeRef.current = place;
        onDraggedRef.current = onDragged;
    });

    const contentSize = (node: PixiContainer) => ({ width: node.layout?.computedLayout.width ?? 0, height: node.layout?.computedLayout.height ?? 0 });

    const update = () => {
        const node = nodeRef.current;

        if (!node || dragRef.current) return;

        const scale = getRoomOverlayScale();
        const { width, height } = contentSize(node);

        node.scale.set(scale);

        // A window with no measured size yet is not placed: it would show somewhere else for a frame.
        const position = (width && height) ? placeRef.current(Math.ceil(width * scale), Math.ceil(height * scale), scale) : null;

        placedRef.current = !!position;
        node.alpha = position ? alpha : 0;

        if (!position) return;

        node.x = Math.round(position.x);
        node.y = Math.round(position.y);
    };

    const updateRef = useRef(update);

    useLayoutEffect(() => {
        updateRef.current = update;
    });

    useRoomEventDispatcher<RoomRenderedEvent>(RoomRenderedEvent.ROOM_RENDERED, update);

    /*
     * Drawn transparent until the first frame places it. The room frame comes before Pixi lays
     * the stage out, so it is placed again once the layout pass has measured a change of size,
     * before that size is drawn at the old one's place.
     */
    useLayoutEffect(() => {
        const node = nodeRef.current;

        if (!node) return;

        if (!placedRef.current) node.alpha = 0;

        const onLayout = () => updateRef.current();

        node.on('layout', onLayout);

        return () => {
            node.off('layout', onLayout);
        };
    }, []);

    useEffect(() => {
        if (nodeRef.current && placedRef.current) nodeRef.current.alpha = alpha;
    }, [ alpha ]);

    // `draggable = false` ends a drag under way (`ScaledWindow.draggable` 118-132).
    useEffect(() => {
        if (!draggable) dragRef.current = null;
    }, [ draggable ]);

    const onPointerDown = (event: FederatedPointerEvent) => {
        const node = nodeRef.current;

        if (!draggable || !node) return;

        event.stopPropagation();
        dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: node.x, y: node.y };

        const move = (moveEvent: PointerEvent) => {
            const drag = dragRef.current;

            if (!drag || !nodeRef.current) return;

            const x = Math.round(drag.x + (moveEvent.clientX - drag.pointerX));
            const y = Math.round(drag.y + (moveEvent.clientY - drag.pointerY));
            const { width, height } = contentSize(nodeRef.current);
            const scale = nodeRef.current.scale.x;

            nodeRef.current.x = x;
            nodeRef.current.y = y;
            onDraggedRef.current?.(x, y, Math.ceil(width * scale), Math.ceil(height * scale));
        };

        const up = () => {
            dragRef.current = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };

        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    return (
        <Box
            ref={nodeRef}
            layout={{ position: 'absolute', top: 0, left: 0 }}
            eventMode={draggable ? 'static' : 'passive'}
            interactiveChildren={!draggable}
            cursor={draggable ? 'move' : undefined}
            onPointerDown={onPointerDown}
        >
            {children}
        </Box>
    );
};
