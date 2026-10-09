/**
 * `RoomFilterCtrl`'s two listeners in `navigator/IncomingMessages`: `onRoomFilterSettings` hands the
 * room's words to it, and `onRoomEnter` hides its window (`roomFilterCtrl.close()`).
 */
import { RoomEntryInfoMessage, RoomFilterSettingsMessage } from '@nitrodevco/nitro-packets';

import { closeRoomFilter, onRoomFilterSettings } from '#base/commands';
import { WebSocketConnection } from '#base/context/communication';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerRoomFilterHandlers = ({ subscribe }: WebSocketConnection) => subscribeAll(subscribe, [
    on(RoomFilterSettingsMessage, data => onRoomFilterSettings(data.badWords)),
    on(RoomEntryInfoMessage, () => closeRoomFilter()),
]);
