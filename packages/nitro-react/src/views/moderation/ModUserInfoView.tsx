import { GetModeratorUserInfoComposer, IModeratorUserInfoData } from '@nitrodevco/nitro-packets';
import { useEffect, useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { MOD_CHATLOG_USER, moderationStore, useModerationStore } from '#base/context/moderation';
import { TemplateWindow } from '#base/theme';

/** `UserInfoCtrl.formatTime`. */
const formatModerationTime = (seconds: number) => {
    if (seconds < 2 * 60) return `${seconds} secs ago`;
    if (seconds < 2 * 3600) return `${Math.round(seconds / 60)} mins ago`;
    if (seconds < 2 * 86400) return `${Math.round(seconds / 3600)} hours ago`;
    if (seconds < 2 * 31536000) return `${Math.round(seconds / 86400)} days ago`;

    return `${Math.round(seconds / 31536000)} years ago`;
};

/** `UserInfoCtrl.setTxt`: the value, or the fallback when it is empty. */
const txt = (value: string | undefined, fallback = '') => ({ caption: value ? value : fallback });

/** `UserInfoCtrl.refresh`'s fields, and `setAlertTxt`'s counts with their "view" link only when there is one. */
const userInfoBindings = (user: IModeratorUserInfoData | undefined): Record<string, object> => {
    if (!user) return { fields: { visible: false }, loading_txt: { visible: true } };

    const bindings: Record<string, object> = {
        fields: { visible: true },
        loading_txt: { visible: false },
        name_txt: txt(user.userName),
        registered_txt: txt(formatModerationTime(user.registrationAgeInMinutes * 60)),
        cfh_count_txt: txt(String(user.cfhCount)),
        trading_lock_expiry_txt: txt(user.tradingExpiryDate, 'No active lock'),
        last_login_txt: txt(formatModerationTime(user.minutesSinceLastLogin * 60)),
        online_txt: txt(user.online ? 'Yes' : 'No'),
        last_purchase_txt: txt(user.lastPurchaseDate, 'No purchases'),
        email_address_txt: txt(user.primaryEmailAddress, 'No email found'),
        id_bans_txt: txt(String(user.identityRelatedBanCount)),
        user_class_txt: txt(user.userClassification, '-'),
        // Within 48 hours the time reddens with how recent it is.
        last_sanction_time_txt: { ...txt(user.lastSanctionTime), ...((user.sanctionAgeHours <= 48) ? { color: Math.floor((255 * (48 - user.sanctionAgeHours)) / 48) << 16 } : {}) },
    };

    const alertTxt = (name: string, value: number) => {
        bindings[name] = { caption: String(value) };
        bindings[`view_${name}`] = { visible: (value > 0) };
    };

    alertTxt('abusive_cfh_count_txt', user.abusiveCfhCount);
    alertTxt('caution_count_txt', user.cautionCount);
    alertTxt('ban_count_txt', user.banCount);
    alertTxt('trading_lock_count_txt', user.tradingLockCount);

    return bindings;
};

/**
 * Flash's `moderation/UserInfoFrameCtrl` with its `UserInfoCtrl`: the `user_info_frame` window
 * ("User Info") holding `user_info`, which shows "Loading..." until `ModeratorUserInfo` for the
 * player arrives (`load` asks it). Its buttons open the player's chatlog and the send-message
 * window; the mod action is off for "No identity". Room visits, the mod action window and the
 * housekeeping links are not built yet.
 */
export const ModUserInfoView = ({ userId }: { userId: number }) => {
    const { send } = useWebSocketContext();
    const user = useModerationStore(x => x.userInfos[userId]);
    const [ frame ] = useState(() => ({ id: `moderation-user-info-${userId}`, onClose: () => moderationStore.getState().closeWindow({ kind: 'userInfo', userId }) }));

    useEffect(() => {
        send(new GetModeratorUserInfoComposer({ userId }));
    }, [ send, userId ]);

    const { showWindow } = moderationStore.getState();

    return (
        <TemplateWindow
            id="habbo-moderation-com/user_info_frame_xml"
            frame={frame}
            bindings={{
                '': { caption: 'User Info' },
                content: {
                    children: (
                        <TemplateWindow
                            id="habbo-moderation-com/user_info_xml"
                            bindings={{
                                ...userInfoBindings(user),
                                chatlog_but: { onPointerTap: () => user && showWindow({ kind: 'chatlog', type: MOD_CHATLOG_USER, id: user.userId }) },
                                message_but: { onPointerTap: () => user && showWindow({ kind: 'sendMessage', userId: user.userId, userName: user.userName }) },
                                modaction_but: { disabled: user?.primaryEmailAddress === 'No identity' },
                            }}
                        />
                    ),
                },
            }}
        />
    );
};
