import { TurboClientModulesMessage, TurboServerCapabilitiesMessage } from '@nitrodevco/nitro-packets';

import { stopClientModules, syncClientModules } from '#base/commands';
import { TURBO_CLIENT_MODULES_CAPABILITY } from '#base/context/client-modules';
import { WebSocketConnection } from '#base/context/communication';
import { userStore } from '#base/context/user';

import { on, subscribeAll } from '../packetSubscriptions';

/**
 * Not Flash's: Turbo's `client.modules` extension - the client modules the server's plugins ship,
 * run by `syncClientModules`. The set is taken only once the server has accepted the extension, so a
 * server that uses the header for something else cannot make the client run code; one that declines
 * it stops whatever ran. The modules stop with the connection.
 */
export const registerClientModuleHandlers = (connection: WebSocketConnection) => {
    const unsubscribe = subscribeAll(connection.subscribe, [
        on(TurboServerCapabilitiesMessage, (data) => {
            if (!data.capabilities.some(capability => capability.name === TURBO_CLIENT_MODULES_CAPABILITY)) void stopClientModules();
        }),

        on(TurboClientModulesMessage, (data) => {
            if (userStore.getState().turboCapabilities.has(TURBO_CLIENT_MODULES_CAPABILITY)) void syncClientModules(connection, data.modules);
        }),
    ]);

    return () => {
        unsubscribe();
        void stopClientModules();
    };
};
