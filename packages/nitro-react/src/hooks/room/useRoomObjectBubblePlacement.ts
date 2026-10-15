/**
 * Places a bubble over a room object on every `RoomRenderedEvent` - Flash's `ContextInfoView.update`.
 * The bubble is moved straight on its Pixi container: the room's screen location and bounding
 * rectangle are already in canvas pixels, the same space as a `position: 'absolute', top: 0, left: 0` node.
 *
 * Its bottom edge sits the gap above the highest of the object's recent heights, so it rises as
 * fast as the object does but falls at most a few pixels a frame, and never more than
 * `MAX_VERTICAL_LEAD_RATIO` of the object's height above its top. A bubble with no measured size
 * yet is not placed: placing a zero-sized node would put it somewhere else for a frame.
 *
 * The room frame comes before Pixi lays the stage out, so a bubble whose content has just changed
 * (another object's menu, a sub-menu, the minimised view) still has its old size then. Placed by
 * that size, the new content would show a frame too high or too low - pinned to the window's top
 * edge when it shrinks - before jumping into place. So the bubble is placed again from the same
 * room frame whenever its layout changes (`layout`, emitted during the prerender, before drawing).
 *
 * Given another object, the bubble starts over, hidden until placed. Showing it again is the
 * caller's, from `onRendered`.
 */
import { RoomObjectCategoryEnum, RoomRenderedEvent } from '@nitrodevco/nitro-api';
import { Container as PixiContainer, PointData, Rectangle } from 'pixi.js';
import { RefObject, useLayoutEffect, useRef } from 'react';

import { useRoom } from '#base/context/room';
import { FixedSizeStack } from '#base/utils';

import { useRoomEventDispatcher } from './useRoomEventDispatcher';

const BUBBLE_DROP_SPEED = 3;
/** `getMaximumVerticalLead`: the smoothed top may not lag the real one by more than this share of the object's height. */
const MAX_VERTICAL_LEAD_RATIO = 0.05;
const SPACE_AROUND_EDGES = 10;

/** `AvatarContextInfoView.getOffset`: a bubble over a person clears the head by this much... */
const AVATAR_GAP = 10;
/** ...and one over anything else (`ContextInfoView.getOffset`) by this. */
const OBJECT_GAP = 4;

/** Where the drop smoothing starts from, before any real height has been seen. */
const INITIAL_MAX_STACK = -1000000;

export interface RoomObjectBubblePlacementOptions {
    objectId: number;
    category: RoomObjectCategoryEnum;
    /** Humanoid units get the taller gap above the head. */
    isAvatar: boolean;
    /** How many recent heights the drop smoothing takes its maximum over. */
    stackSize: number;
    /** Keep the bubble `SPACE_AROUND_EDGES` inside the window. */
    keepOnScreen?: boolean;
    /**
     * Called after every room frame, with whether the bubble could be placed, and again with no
     * time passed when a change of size has placed it anew.
     */
    onRendered?: (placed: boolean, time: number) => void;
}

/** The object as the last room frame saw it, with the smoothed height above its location. */
interface ObjectSample {
    bounds: Rectangle;
    location: PointData;
    highest: number;
}

export const useRoomObjectBubblePlacement = (bubbleRef: RefObject<PixiContainer | null>, options: RoomObjectBubblePlacementOptions) => {
    const { objectId, category, stackSize } = options;
    const room = useRoom();
    const locationStack = useRef(new FixedSizeStack(stackSize));
    const maxStack = useRef(INITIAL_MAX_STACK);
    const sample = useRef<ObjectSample | undefined>(undefined);
    // Read by the listeners, so a room frame between a commit and its passive effects already sees the new object.
    const optionsRef = useRef(options);

    useLayoutEffect(() => {
        optionsRef.current = options;
    });

    /** Reads the object from the room and moves the drop smoothing on by one frame. */
    const takeSample = (): ObjectSample | undefined => {
        const { objectId, category } = optionsRef.current;

        if (!room) return undefined;

        const bounds = room.getRoomObjectBoundingRectangle(objectId, category);
        const location = room.getRoomObjectScreenLocation(objectId, category);

        if (!bounds || !location) return undefined;

        locationStack.current.addValue(location.y - bounds.top);

        const highest = Math.max(locationStack.current.getMax(), (maxStack.current - BUBBLE_DROP_SPEED));

        maxStack.current = highest;

        return { bounds, location, highest };
    };

    /** Puts the bubble over the last sample by its current size. */
    const place = (): boolean => {
        const node = bubbleRef.current;
        const { isAvatar, keepOnScreen = false } = optionsRef.current;

        if (!node || !sample.current) return false;

        const { bounds, location, highest } = sample.current;
        const nodeWidth = node.layout?.computedLayout.width ?? 0;
        const nodeHeight = node.layout?.computedLayout.height ?? 0;

        if (!nodeWidth || !nodeHeight) return false;

        // `getOffset`.
        const offset = -nodeHeight - (isAvatar ? AVATAR_GAP : OBJECT_GAP);
        const lowest = (bounds.top + offset) - Math.trunc(bounds.height * MAX_VERTICAL_LEAD_RATIO);

        let x = (location.x - (nodeWidth / 2));
        let y = Math.max((location.y - highest) + offset, lowest);

        if (keepOnScreen) {
            const maxLeft = ((window.innerWidth - nodeWidth) - SPACE_AROUND_EDGES);
            const maxTop = ((window.innerHeight - nodeHeight) - SPACE_AROUND_EDGES);

            if (x < SPACE_AROUND_EDGES) x = SPACE_AROUND_EDGES;
            else if (x > maxLeft) x = maxLeft;

            if (y < SPACE_AROUND_EDGES) y = SPACE_AROUND_EDGES;
            else if (y > maxTop) y = maxTop;
        }

        node.x = Math.trunc(x);
        node.y = Math.trunc(y);

        return true;
    };

    useRoomEventDispatcher<RoomRenderedEvent>(RoomRenderedEvent.ROOM_RENDERED, (event) => {
        sample.current = takeSample();

        optionsRef.current.onRendered?.(place(), event.time);
    });

    // A layout effect, so the ticker cannot draw the bubble at its old place before this runs.
    useLayoutEffect(() => {
        locationStack.current = new FixedSizeStack(stackSize);
        maxStack.current = INITIAL_MAX_STACK;
        sample.current = undefined;

        if (bubbleRef.current) bubbleRef.current.alpha = 0;
    }, [ objectId, category, stackSize ]);

    // The layout pass has measured the bubble anew: place it by that size before it is drawn.
    useLayoutEffect(() => {
        const node = bubbleRef.current;

        if (!node) return;

        const onLayout = () => {
            if (place()) optionsRef.current.onRendered?.(true, 0);
        };

        node.on('layout', onLayout);

        return () => {
            node.off('layout', onLayout);
        };
    }, [ bubbleRef ]);
};
