/**
 * A slider knob dragged along its track - the gesture the WIRED slider, the sound settings' volumes
 * and the stacking helper share: from the knob's place when pressed, the knob moves as far as the
 * pointer has, held to `0..travel` (Flash's `WE_RELOCATED` on a button confined to its track). The
 * x is not rounded; a slider whose Flash knob stood on whole pixels rounds it.
 */
import { FederatedPointerEvent } from 'pixi.js';

import { useWindowPointerDrag } from './useWindowPointerDrag';

export interface SliderKnobDragHandlers {
    /** The knob's new x along the track, and the move that put it there. */
    onMove: (x: number, event: PointerEvent) => void;
    /** The pointer was let go or cancelled. */
    onEnd?: () => void;
}

export const useSliderKnobDrag = () => {
    const pointerDrag = useWindowPointerDrag();

    /** Follows the press from the knob at `knobX` on a track it can travel `travel` along. */
    const start = (event: FederatedPointerEvent, knobX: number, travel: number, handlers: SliderKnobDragHandlers) => {
        const pointerX = event.clientX;

        pointerDrag.start(event.pointerId, {
            onMove: move => handlers.onMove(Math.min(travel, Math.max(0, knobX + (move.clientX - pointerX))), move),
            onEnd: () => handlers.onEnd?.(),
        });
    };

    return { start, stop: pointerDrag.stop };
};
