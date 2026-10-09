import { useStore } from 'zustand';

import { RoomFilterStore, roomFilterStore } from './store/RoomFilterStore';

/** A slice of the RoomFilterStore (`RoomFilterCtrl`), re-rendering only when that slice changes. */
export function useRoomFilterStore<T>(selector: (state: RoomFilterStore) => T) {
    return useStore(roomFilterStore, selector);
}
