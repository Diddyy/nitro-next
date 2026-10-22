/** Turbo's `client.modules` extension: the server names the client modules its plugins ship. */
export const TURBO_CLIENT_MODULES_CAPABILITY = 'client.modules';

/**
 * The headers a client module's packets may use - a Turbo plugin's (`ExtensionPackets.IsPluginHeader`):
 * 20000 to 32767, without Turbo's own 30000 to 30099.
 */
export const isClientModuleHeader = (header: number) => Number.isInteger(header) && (header >= 20000) && (header <= 32767) && ((header < 30000) || (header > 30099));
