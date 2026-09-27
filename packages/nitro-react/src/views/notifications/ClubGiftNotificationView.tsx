import { useState } from 'react';

import { openClubGiftList } from '#base/commands';
import { useSingularNotificationActions, useSingularNotificationStore } from '#base/context/singular-notifications';
import { useTranslation } from '#base/context/system';
import { Border, Button, Icon, Region, ThemeText } from '#base/theme';

/** `ClubGiftNotification.LINK_COLOR_NORMAL` / `LINK_COLOR_HIGHLIGHT`. */
const LINK_COLOR_NORMAL = '#ffffff';
const LINK_COLOR_HIGHLIGHT = '#bae1f9';

/** `ClubGiftNotification.ICON_STYLE_CLUB`: the style the constructor's `setClubIcon` gives `club_icon`. */
const ICON_STYLE_CLUB = '13';

/**
 * Flash's `notifications/singular/ClubGiftNotification` on `club_gift_notification`: the toolbar
 * extension `SingularNotificationController` docks as `club_gift_notification` with no priority,
 * so it goes to the end of the extension column - mounted there, 2 under whatever is above it
 * (`extension_grid`'s spacing).
 *
 * The layout's root is its 192x82 style 9 border tinted `0x686661`, holding the 16x16 `club_icon`
 * at (6, 7) - the layout's style 14 (VIP), which the constructor sets to 13 (club) - the
 * `info_text` (`${notifications.text.club_gift}`, white Ubuntu 12, word-wrapped, 174x36 at 25, 7),
 * the style 4 `open_catalog_button` (`${notifications.button.show_gift_list}`), which fits its
 * caption and keeps its right edge at 184 (`on_resize_align_right`), and the
 * `cancel_link_region` at (8, 49), the size of its underlined `cancel_link`
 * (`${notifications.button.later}`), white and `0xbae1f9` while the pointer is over it.
 *
 * The button opens the catalogue's `club_gifts` page and takes the notification down; "not now"
 * takes it down for the rest of the session (`isCancelled`).
 */
export const ClubGiftNotificationView = () => {
    const visible = useSingularNotificationStore(x => x.clubGiftNotificationVisible);

    if (!visible) return null;

    return <ClubGiftNotificationContent />;
};

const ClubGiftNotificationContent = () => {
    const t = useTranslation();
    const { closeClubGiftNotification } = useSingularNotificationActions();
    const [ linkHover, setLinkHover ] = useState(false);

    return (
        <Border
            variant="9"
            tintColor="#686661"
            layout={{ position: 'relative', width: 192, height: 82, marginTop: 2, flexShrink: 0, overflow: 'hidden' }}
        >
            <Icon
                variant={ICON_STYLE_CLUB}
                name="club_icon"
                layout={{ position: 'absolute', left: 6, width: 16, top: 7, height: 16 }}
            />
            <ThemeText
                text={t('notifications.text.club_gift')}
                textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 12, wordWrap: true, wordWrapWidth: 170 }}
                flashFormat={{ antiAliasType: 'advanced' }}
                clip
                name="info_text"
                verticalAlign="top"
                layout={{ position: 'absolute', left: 25, width: 174, top: 7, height: 36 }}
            />
            <Button
                variant="4"
                name="open_catalog_button"
                onPointerTap={openClubGiftList}
                layout={{ position: 'absolute', right: 8, top: 44, height: 28 }}
            >
                {t('notifications.button.show_gift_list')}
            </Button>
            <Region
                name="cancel_link_region"
                onPointerTap={() => closeClubGiftNotification(true)}
                onPointerOver={() => setLinkHover(true)}
                onPointerOut={() => setLinkHover(false)}
                cursor="pointer"
                layout={{ position: 'absolute', left: 8, top: 49 }}
            >
                <ThemeText
                    text={t('notifications.button.later')}
                    textOptions={{ fill: linkHover ? LINK_COLOR_HIGHLIGHT : LINK_COLOR_NORMAL, fontFamily: 'Ubuntu', fontSize: 12 }}
                    flashFormat={{ underline: true, antiAliasType: 'advanced' }}
                    name="cancel_link"
                    verticalAlign="top"
                />
            </Region>
        </Border>
    );
};
