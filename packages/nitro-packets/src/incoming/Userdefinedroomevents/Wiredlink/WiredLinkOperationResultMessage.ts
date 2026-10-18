import { IIncomingPacket, IMessageDataWrapper } from '@nitrodevco/nitro-api';

/** One link network of the player's, as the Room Linker's link window lists it. Flash `WiredLinkNetwork`. */
export type WiredLinkNetworkType = {
    id: string;
    name: string;
    connectionCount: number;
    linkedInCurrentRoom: boolean;
};

export type WiredLinkOperationResultMessageType = {
    roomId: number;
    furniId: number;
    /** 0 configuration request, 1 save, 2 create, 3 rename, 4 delete, 5 connections (Flash `WiredLinkView.operationFailed`). */
    operation: number;
    /** 0 on success, else the tail of the text key `wiredlink.error.<resultCode>`. */
    resultCode: number;
    hasConfiguration: boolean;
    selectedNetworkId: string;
    receiveLocal: boolean;
    removedNetworkId: string;
    networks: WiredLinkNetworkType[];
};

/**
 * The answer to every Room Linker link request. Flash parser `wiredlink._-X29`; Flash's
 * `WiredLinkController.onResult` drops it unless it is for the linker its link window was opened
 * for, and the live hotel never opens one (it answers each request with code 7), so nothing
 * listens for it here.
 */
export class WiredLinkOperationResultMessage implements IIncomingPacket<WiredLinkOperationResultMessageType> {
    public parse(wrapper: IMessageDataWrapper): WiredLinkOperationResultMessageType {
        const roomId = wrapper.readInt();
        const furniId = wrapper.readInt();
        const operation = wrapper.readInt();
        const resultCode = wrapper.readInt();
        const hasConfiguration = wrapper.readBoolean();
        const selectedNetworkId = hasConfiguration ? wrapper.readString() : '0';
        const receiveLocal = hasConfiguration ? wrapper.readBoolean() : false;
        const removedNetworkId = wrapper.readString();
        const networks: WiredLinkNetworkType[] = [];

        let count = wrapper.readInt();

        while (count-- > 0) {
            networks.push({
                id: wrapper.readString(),
                name: wrapper.readString(),
                connectionCount: wrapper.readInt(),
                linkedInCurrentRoom: wrapper.readBoolean(),
            });
        }

        return { roomId, furniId, operation, resultCode, hasConfiguration, selectedNetworkId, receiveLocal, removedNetworkId, networks };
    }
}
