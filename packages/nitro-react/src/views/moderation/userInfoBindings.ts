/**
 * The `user_info` window's bindings (`UserInfoCtrl.refresh`), for `ModUserInfoView`'s frame and the issue
 * handler's embedded user info. Kept apart from the views so each view module exports only its component (Fast Refresh).
 */
import { IModeratorUserInfoData } from '@nitrodevco/nitro-packets';

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
export const userInfoBindings = (user: IModeratorUserInfoData | undefined): Record<string, object> => {
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
