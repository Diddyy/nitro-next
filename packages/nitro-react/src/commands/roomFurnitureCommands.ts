/**
 * A room furni used from its context menu - `RoomObjectEventHandler`'s `UseFurnitureMessageComposer`
 * for a furni whose logic does not use it itself.
 */
import { UseFurnitureComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';

type Send = WebSocketConnection['send'];

/** `UseFurnitureMessageComposer(objectId, param)`. */
export const sendUseFurniture = (send: Send, objectId: number, param: number = 0) => send(new UseFurnitureComposer({ objectId, param }));
