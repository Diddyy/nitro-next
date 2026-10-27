/**
 * Not Flash's: a core packet a plugin carries inside one of its own - a relay of another room's
 * objects, say - read with the client's own parser for its header (`api.packets.parseCore`). Only
 * parsed: no handler of the client's hears it. The body is read from where the module's reader
 * stands, or from bytes it already took out (`readBytes`, an `ArrayBuffer`).
 */
import { BinaryReader, EvaWireDataWrapper, IBinaryReader, IMessageDataWrapper, IncomingPacketConstructor } from '@nitrodevco/nitro-api';
import { GetIncomingPackets } from '@nitrodevco/nitro-packets';

/** Where a core packet's body is read from. */
export type ClientModuleCorePacketBody = IMessageDataWrapper | IBinaryReader | ArrayBuffer;

let parsers: Record<number, IncomingPacketConstructor> | undefined;

const isBinaryReader = (body: IMessageDataWrapper | IBinaryReader): body is IBinaryReader => (typeof (body as IBinaryReader).remaining === 'function');

const wrapperOf = (header: number, body: ClientModuleCorePacketBody): IMessageDataWrapper => {
    if (body instanceof ArrayBuffer) return new EvaWireDataWrapper(header, new BinaryReader(body));

    return isBinaryReader(body) ? new EvaWireDataWrapper(header, body) : body;
};

/**
 * The core packet at `header`, read from `body` by the client's parser for it: `undefined`, and
 * `warn` told why, when the client has no parser at that header or the body does not read as it.
 */
export const parseClientModuleCorePacket = (header: number, body: ClientModuleCorePacketBody, warn: (message: string) => void): unknown => {
    parsers ??= GetIncomingPackets();

    const Parser = Number.isInteger(header) ? parsers[header] : undefined;

    if (!Parser) {
        warn(`header ${header} is not a packet of the client's.`);

        return undefined;
    }

    try {
        return new Parser().parse(wrapperOf(header, body));
    } catch (error) {
        warn(`header ${header} (${Parser.name}) did not read: ${error instanceof Error ? error.message : String(error)}`);

        return undefined;
    }
};
