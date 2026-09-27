/**
 * `HabboCommunicationDemo.disconnected` and `DisconnectReasonEvent.resolveDisconnectedReasonLocalizationKey`:
 * show the hotel's localized logout alert over the existing scene.
 * This hosted client has no AIR account-login view: it uses the no-login-view alert branch.
 * The disconnected UI retains the gameplay tree, and stale dialogs are closed so that an
 * earlier confirmation cannot remain actionable after logout. Web logout redirects belong
 * to the hosting site and are not handled here.
 */
import { systemStore } from '#base/context/system';

const disconnectTextKey = (reason: number): string => {
    switch (reason) {
        case -2: return 'disconnected.maintenance';
        case 0: return 'disconnected.logged_out';
        case 1: return 'disconnected.just_banned';
        case 10: return 'disconnected.still_banned';
        case 2:
        case 11:
        case 13:
        case 18: return 'disconnected.concurrent_login';
        case 12:
        case 19: return 'disconnected.hotel_closed';
        case 20: return 'disconnected.incorrect_password';
        case 112: return 'disconnected.idle';
        case 122: return 'disconnected.incompatible_client_version';
        default: return 'disconnected.generic';
    }
};

export const showConnectionClosed = (reason: number) => {
    const { dialogs, closeDialog, getLocalizationValue, showAlert } = systemStore.getState();

    for (const dialog of dialogs) closeDialog(dialog.id);

    const title = getLocalizationValue(disconnectTextKey(reason));
    const message = getLocalizationValue('connection.login.logged_out', '', { reason: String(reason), reasonName: title });

    showAlert(title, message, { modal: true });
};
