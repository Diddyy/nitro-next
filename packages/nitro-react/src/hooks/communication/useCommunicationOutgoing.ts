import { OutgoingPacketConstructor } from '@nitrodevco/nitro-api';
import { useRef } from 'react';

/**
 * The socket's outgoing packet registry: which header a composer class is sent under, looked up by
 * the composer's name. The `WebSocketContextProvider` fills it from the header maps.
 */
export const useCommunicationOutgoing = () => {
    const outgoingByHeader = useRef<Map<number, OutgoingPacketConstructor<object>>>(new Map());
    const outgoingHeaderByComposerName = useRef<Map<string, number>>(new Map());

    const registerOutgoing = <T extends object>(header: number, ctor: OutgoingPacketConstructor<T>) => {
        outgoingByHeader.current.set(header, ctor);
        outgoingHeaderByComposerName.current.set(ctor.name, header);
    };

    const registerManyOutgoing = <T extends object>(packets: Record<number, OutgoingPacketConstructor<T>>) => {
        for (const [ header, ctor ] of Object.entries(packets)) registerOutgoing(Number(header), ctor);
    };

    return { outgoingHeaderByComposerName, registerOutgoing, registerManyOutgoing };
};
