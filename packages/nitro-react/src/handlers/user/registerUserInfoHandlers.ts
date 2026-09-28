import { ChangeUserNameResultMessageCode } from '@nitrodevco/nitro-api';
import { AccountPreferencesEventMessage, AccountSafetyLockStatusChangeMessage, AvailabilityStatusMessage, ChangeUserNameResultMessage, EmailStatusResultEventMessage, FigureUpdateEventMessage, GetSoundSettingsComposer, GetUserNftChatStylesComposer, NoobnessLevelMessage, PerkAllowancesMessage, PetRespectFailedMessage, TurboClientCapabilitiesComposer, TurboPermissionNodesMessage, TurboServerCapabilitiesMessage, UserNameChangedMessage, UserNftChatStylesMessage, UserObjectMessage, UserPurchasableChatStyleChangedMessage, UserPurchasableChatStylesMessage, UserRightsMessage } from '@nitrodevco/nitro-packets';

import { clampChatFontSizeMode } from '#base/chat';
import { WebSocketConnection } from '#base/context/communication';
import { systemStore } from '#base/context/system';
import { SOUND_VOLUME_SCALE, TURBO_PERMISSION_NODES_CAPABILITY, userStore } from '#base/context/user';
import { configReader } from '#base/utils';

import { on, subscribeAll } from '../packetSubscriptions';

/**
 * Who you are - Flash's `SessionDataManager`: the user object at login, figure and name changes,
 * rights, noobness level, email status, the account preferences and the chat styles the account
 * owns (NFT and bought ones, which the chat input's style picker offers). Also gives a pet respect
 * back when the server refuses one (`onPetRespectFailed`): the respect was spent when it was sent,
 * and follows the account's safety lock (`onAccountSafetyLockStatusChanged`: locked while the status is 0)
 * and the hotel's availability (`onAvailabilityStatus`), which trading checks for a shutdown.
 *
 * Not Flash's: after the user object it asks the server for Turbo's `permission.nodes` extension,
 * unless `turbo.extensions.disabled` is set. A Turbo server answers and sends the nodes the user
 * holds, which every `ClientGate` then asks; any other server ignores the unknown packet and the
 * gates keep to `securityLevel`. Nodes are taken only once the server has accepted the extension,
 * so a server that happens to use the same header for something else cannot feed the gates.
 */
export const registerUserInfoHandlers = ({ send, subscribe }: WebSocketConnection) => {
    const { setAvailabilityStatus, setRights, setPermissionNodes, setTurboCapabilities, mergePerks, setNoobnessLevel, increasePetRespects, setChatPreferences, setSoundVolumes, setUiFlags, setRoomCameraFollowDisabled, setRoomInvitesIgnored, setOnlineIndicatorPreference, setUserInfo, setName, setFigure, setAccountSafetyLocked, setEmailVerified, setNftChatStyles, setPurchasableChatStyles, setPurchasableChatStyleOwned } = userStore.getState();

    return subscribeAll(subscribe, [
        on(FigureUpdateEventMessage, (data) => {
            setFigure(data.figure, data.gender);
        }),

        on(UserObjectMessage, (data) => {
            setUserInfo(data.userInfo);
            // `SessionDataManager.initSessionData`.
            send(new GetUserNftChatStylesComposer({}));
            // `HabboSoundManagerFlash10.initComponent`: asks for the sound settings `AccountPreferences` answers.
            send(new GetSoundSettingsComposer({}));
            if (!configReader(systemStore.getState().config).configBoolean('turbo.extensions.disabled')) send(new TurboClientCapabilitiesComposer({ capabilities: [ { name: TURBO_PERMISSION_NODES_CAPABILITY, version: 1 } ] }));
        }),

        // A Turbo server that declined `permission.nodes` leaves the gates on the level.
        on(TurboServerCapabilitiesMessage, (data) => {
            const capabilities = new Map(data.capabilities.map(x => [ x.name, x.version ]));

            setTurboCapabilities(capabilities);

            if (!capabilities.has(TURBO_PERMISSION_NODES_CAPABILITY)) setPermissionNodes(null);
        }),

        on(TurboPermissionNodesMessage, (data) => {
            if (userStore.getState().turboCapabilities.has(TURBO_PERMISSION_NODES_CAPABILITY)) setPermissionNodes(new Set(data.nodes));
        }),

        // `PerkManager.onPerkAllowances`.
        on(PerkAllowancesMessage, data => mergePerks(data.perks)),

        on(UserNftChatStylesMessage, (data) => {
            setNftChatStyles(data.chatStyleIds);
        }),

        on(UserPurchasableChatStylesMessage, (data) => {
            setPurchasableChatStyles(data.chatStyleIds);
        }),

        on(UserPurchasableChatStyleChangedMessage, (data) => {
            setPurchasableChatStyleOwned(data.styleId, data.added);
        }),

        on(NoobnessLevelMessage, (data) => {
            setNoobnessLevel(data.noobnessLevel);
        }),

        on(AvailabilityStatusMessage, data => setAvailabilityStatus(data.isOpen, data.onShutDown, data.isAuthenticHabbo)),

        on(UserRightsMessage, (data) => {
            setRights(data.clubLevel, data.securityLevel, data.isAmbassador);
        }),

        // `SessionDataManager.onPetRespectFailed`: the respect `givePetRespect` took is returned.
        on(PetRespectFailedMessage, () => increasePetRespects()),

        on(ChangeUserNameResultMessage, (data) => {
            if (data.resultCode !== ChangeUserNameResultMessageCode.NameOk) return;

            setName(data.name, false);
        }),

        on(UserNameChangedMessage, (data) => {
            if (data.webId !== userStore.getState().userId) return;

            setName(data.newName, false);
        }),

        on(AccountSafetyLockStatusChangeMessage, data => setAccountSafetyLocked(data.status === 0)),

        on(EmailStatusResultEventMessage, (data) => {
            setEmailVerified(data.isVerified);
        }),

        on(AccountPreferencesEventMessage, (data) => {
            setUiFlags(data.uiFlags);
            /*
             * `HabboSoundManagerFlash10.onSoundSettingsEvent`: each percentage is scaled back to
             * 0..1, and a `uiVolume` of exactly 1 is read as 100 - an old stored value that would
             * otherwise mute the client's own sounds to a hundredth.
             */
            setSoundVolumes(
                ((data.uiVolume === 1) ? SOUND_VOLUME_SCALE : data.uiVolume) / SOUND_VOLUME_SCALE,
                data.furniVolume / SOUND_VOLUME_SCALE,
                data.traxVolume / SOUND_VOLUME_SCALE,
            );
            setRoomCameraFollowDisabled(data.roomCameraFollowDisabled);
            setRoomInvitesIgnored(data.roomInvitesIgnored);
            setOnlineIndicatorPreference(data.onlineIndicatorPreference);
            setChatPreferences({
                preferredChatStyle: data.preferedChatStyle,
                freeFlowChatDisabled: data.freeFlowChatDisabled,
                // `HabboFreeFlowChat.onAccountPreferences`: `clampChatFontSizeMode(chatSizePreference)`.
                chatSizePreference: clampChatFontSizeMode(data.chatSizePreference),
                chatMode: data.chatMode,
                chatBubbleWidth: data.chatBubbleWidth,
                chatScrollSpeed: data.chatScrollSpeed,
            });
        }),
    ]);
};
