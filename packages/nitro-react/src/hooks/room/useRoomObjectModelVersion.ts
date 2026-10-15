/**
 * Which version of a room object's model the component last saw: changes whenever the object's
 * model does (a hand item taken or dropped, an effect, a posture, a furni's state or owner), and
 * when the object itself is replaced or goes.
 *
 * The model is engine state that tells nothing when it changes, so a component reading it while
 * rendering kept what it read until something else re-rendered it - and with the React Compiler
 * not even then, as the reads stay cached on the object. The room's frames say when to look again:
 * `useSyncExternalStore` compares the model's update counter once a frame and re-renders only when
 * it moved. Read the model in a function given this version (`readX(model, version)`), so the
 * compiler recomputes the read with it.
 */
import { RoomObjectCategoryEnum, RoomRenderedEvent } from '@nitrodevco/nitro-api';
import { useCallback, useSyncExternalStore } from 'react';

import { useRoom } from '#base/context/room';

export const useRoomObjectModelVersion = (objectId: number, category: RoomObjectCategoryEnum): string => {
    const room = useRoom();

    const subscribe = useCallback((onChange: () => void) => {
        if (!room) return () => undefined;

        room.eventDispatcher.addEventListener(RoomRenderedEvent.ROOM_RENDERED, onChange);

        return () => room.eventDispatcher.removeEventListener(RoomRenderedEvent.ROOM_RENDERED, onChange);
    }, [ room ]);

    const getSnapshot = () => {
        const roomObject = room?.getRoomObject(objectId, category);

        return roomObject ? `${roomObject.instanceId}:${roomObject.model.updateCounter}` : '';
    };

    return useSyncExternalStore(subscribe, getSnapshot);
};
