import { useEffect, useState } from 'react';

import { requestClubExtendOfferFromPromo } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useConfigValue } from '#base/context/system';
import { getPurseClubType, useOwnClubSubscription } from '#base/context/user';
import { Box, TemplateWindow } from '#base/theme';

/** `ClubDiscountPromoExtension.onTextRegionMouseOver` / `onTextRegionMouseOut`: `promo_text`'s colours. */
const TEXT_COLOR_HIGHLIGHT = 0xbae1f9;
const TEXT_COLOR_NORMAL = 0xffffff;

/** `ClubDiscountPromoExtension.assignState`: the style `club_icon` gets. */
const ICON_STYLE_CLUB = '14';

/**
 * Flash's `toolbar/extensions/ClubDiscountPromoExtension` over `habbo-toolbar-com/club_discount_promotion_xml`:
 * the bar `HabboToolbar.initVipExtendExtension` creates while `club.membership.extend.vip.promotion.enabled`,
 * docked as `club_promo` at priority 10 - under the purse, above the targeted offer (13) - while the
 * membership is expiring and VIP (`onClubChanged`: `clubIsExpiring` and `isExtensionEnabled`, club level 2).
 * With under a day left it goes when the membership does (`onExtendOfferExpire`).
 *
 * `promo_text` and its shadow read `discount.bar.vip.expiring`; a click on `text_region` asks for the
 * extension offer (`onTextRegionClicked`), whose dialog `showClubExtendOffer` puts up. The text turns
 * `0xbae1f9` under the pointer.
 */
export const ClubDiscountPromoView = () => {
    const enabled = useConfigValue<boolean>('club.membership.extend.vip.promotion.enabled') === true;
    const subscription = useOwnClubSubscription();
    const minutesLeft = subscription.minutesUntilExpiration;
    // The countdown the bar was taken down for; a new subscription status brings it back.
    const [ expiredAt, setExpiredAt ] = useState<number | null>(null);

    // `onClubChanged`: a membership with under a day left takes the bar down when it runs out.
    useEffect(() => {
        if ((minutesLeft <= 0) || (minutesLeft >= 1440)) return;

        const timeout = setTimeout(() => setExpiredAt(minutesLeft), minutesLeft * 60 * 1000);

        return () => clearTimeout(timeout);
    }, [ minutesLeft ]);

    if (!enabled || (expiredAt === minutesLeft) || !subscription.isExpiring || (getPurseClubType(subscription) !== 2)) return null;

    return <ClubDiscountPromoContent />;
};

const ClubDiscountPromoContent = () => {
    const { send } = useWebSocketContext();
    const [ hover, setHover ] = useState(false);

    return (
        <Box layout={{ marginTop: 2, flexShrink: 0 }}>
            <TemplateWindow
                id="habbo-toolbar-com/club_discount_promotion_xml"
                bindings={{
                    club_icon: { style: ICON_STYLE_CLUB },
                    promo_text: { caption: '${discount.bar.vip.expiring}', color: hover ? TEXT_COLOR_HIGHLIGHT : TEXT_COLOR_NORMAL },
                    promo_text_shadow: { caption: '${discount.bar.vip.expiring}' },
                    text_region: {
                        onPointerTap: () => requestClubExtendOfferFromPromo(send),
                        onPointerOver: () => setHover(true),
                        onPointerOut: () => setHover(false),
                    },
                }}
            />
        </Box>
    );
};
