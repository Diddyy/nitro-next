/**
 * The socket's React context: whether the session is authenticated or disconnected, and the
 * functions to connect, send, subscribe to incoming packets and release the packets held until the
 * handlers are registered. `WebSocketContextProvider` fills it.
 */
import { IncomingPacketConstructor, IOutgoingPacket } from '@nitrodevco/nitro-api';
import { createContext } from 'react';

type WebSocketStore = {
    isAuthenticated: boolean;
    isDisconnected: boolean;
    connect: () => void;
    send: <T extends object>(...packets: IOutgoingPacket<T>[]) => void;
    /** Returns the unsubscribe. */
    subscribe: <T extends object>(event: IncomingPacketConstructor<T>, handler: (data: T) => void) => () => void;
    setReady: () => void;
};

/**
 * The part of the socket that code outside React needs: packet handlers subscribe through it and
 * commands send through it. Both functions close over refs only, so one captured copy stays good
 * for the life of the connection.
 */
export type WebSocketConnection = Pick<WebSocketStore, 'send' | 'subscribe'>;

/** The connection's `send`, the first argument of every command. */
export type Send = WebSocketConnection['send'];

export const WebSocketContext = createContext<WebSocketStore | undefined>(undefined);
