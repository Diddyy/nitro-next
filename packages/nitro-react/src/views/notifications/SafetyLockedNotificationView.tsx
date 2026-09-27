import { useState } from 'react';

import { openSafetyLockUnlockPage } from '#base/commands';
import { useSingularNotificationStore } from '#base/context/singular-notifications';
import { useTranslation } from '#base/context/system';
import { Border, Region, ThemeText } from '#base/theme';

/** `SafetyLockedNotification.LINK_COLOR_NORMAL` / `LINK_COLOR_HIGHLIGHT`. */
const LINK_COLOR_NORMAL = '#ffffff';
const LINK_COLOR_HIGHLIGHT = '#bae1f9';

/**
 * Flash's `notifications/singular/SafetyLockedNotification` on `safety_locked_notification`: the
 * toolbar extension `SingularNotificationController` docks as `safety_locked_notification` with
 * no priority, so it goes to the end of the extension column - mounted there, 2 under whatever is
 * above it (`extension_grid`'s spacing). Up while the account is safety locked and not yet
 * unlocked (`registerSingularNotificationHandlers`).
 *
 * The layout's root is its 192x79 style 6 border tinted `0x6f6f6f`, holding the `info_text`
 * (`${notifications.text.safety_locked}`, white Ubuntu 12, word-wrapped, 174x36 at 8, 6) and the
 * `unlock_link_region` at (8, 51) - 35x18, grown to its text (`expand_to_accommodate_children`) -
 * with the underlined `unlock_link` (`${notifications.button.safety_locked_unlock}`) at (0, 2),
 * white and `0xbae1f9` while the pointer is over the region. A click on either opens the unlock
 * page (`openSafetyLockUnlockPage`); the notification stays.
 */
export const SafetyLockedNotificationView = () => {
    const visible = useSingularNotificationStore(x => x.safetyLockedNotificationVisible);

    if (!visible) return null;

    return <SafetyLockedNotificationContent />;
};

const SafetyLockedNotificationContent = () => {
    const t = useTranslation();
    const [ linkHover, setLinkHover ] = useState(false);

    return (
        <Border
            variant="6"
            tintColor="#6f6f6f"
            layout={{ position: 'relative', width: 192, height: 79, marginTop: 2, flexShrink: 0 }}
        >
            <ThemeText
                text={t('notifications.text.safety_locked')}
                textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 12, wordWrap: true, wordWrapWidth: 170 }}
                flashFormat={{ antiAliasType: 'advanced' }}
                clip
                name="info_text"
                verticalAlign="top"
                layout={{ position: 'absolute', left: 8, width: 174, top: 6, height: 36 }}
            />
            <Region
                name="unlock_link_region"
                onPointerTap={openSafetyLockUnlockPage}
                onPointerOver={() => setLinkHover(true)}
                onPointerOut={() => setLinkHover(false)}
                cursor="pointer"
                layout={{ position: 'absolute', left: 8, minWidth: 35, top: 51, height: 18 }}
            >
                <ThemeText
                    text={t('notifications.button.safety_locked_unlock')}
                    textOptions={{ fill: linkHover ? LINK_COLOR_HIGHLIGHT : LINK_COLOR_NORMAL, fontFamily: 'Ubuntu', fontSize: 12 }}
                    flashFormat={{ underline: true, antiAliasType: 'advanced' }}
                    name="unlock_link"
                    verticalAlign="top"
                    layout={{ marginTop: 2 }}
                />
            </Region>
        </Border>
    );
};
