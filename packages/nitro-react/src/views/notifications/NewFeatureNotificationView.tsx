/**
 * Flash's `notifications/singular/NewFeatureNotification`: a promotion docked at the end of the
 * toolbar's extension column as `new_feature_<key>`, 2 under whatever is above it. Its type
 * (`notifications.new_feature.type.<key>`) picks the layout of `habbo-notifications-com`:
 * `normal` (the default) `new_feature_notification_xml`, `promo` `new_feature_notification_promo_xml`.
 *
 * `initLayout`: the `desc` text `notifications.new_feature.<key>.desc`, the `static_bitmap` the
 * asset `notifications.new_feature.image.<key>`, and the `border` (else the window) in
 * `notifications.new_feature.color.<key>` (`#686661` when none), with a normal notification's
 * `open_button` in that colour lightened halfway to white (its HSL lightness).
 *
 * `eventHandler`: the open button - or a promo's whole region - opens the configured link and shows
 * the cancel link; the cancel link takes the notification down.
 *
 * The `countdown` type, and a key with an expiry (`notifications.new_feature.expiry.<key>`, asked
 * of the server with `GetSecondsUntil`), are not drawn: both wait for the server's time.
 *
 * `SingularNotificationController.initComponent` looks for them 2 seconds after it starts
 * (`maybeShowNewFeatureNotification`).
 */
import { ColorConverter } from '@nitrodevco/nitro-api';
import { useEffect } from 'react';

import { getHotelProperty, maybeShowNewFeatureNotifications, openNewFeatureLink } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useSingularNotificationActions, useSingularNotificationStore } from '#base/context/singular-notifications';
import { useConfigData, useTranslation } from '#base/context/system';
import { Box, TemplateBindings, TemplateWindow } from '#base/theme';

/** `SingularNotificationController.initComponent`: `setTimeout(maybeShowNewFeatureNotification, 2000)`. */
const SHOW_DELAY_MS = 2000;

/** `BG_COLOR_NORMAL`. */
const BG_COLOR_NORMAL = '#686661';

/** `extension_grid`'s spacing above an extension. */
const EXTENSION_SPACING = 2;

/** `ColorConverter.hexToUint`: `#rrggbb` (or without the `#`) as a number. */
const hexToUint = (hex: string) => (parseInt(hex.replace('#', ''), 16) || 0);

const TYPE_NORMAL = 'normal';
const TYPE_PROMO = 'promo';

export const NewFeatureNotificationsView = () => {
    const keys = useSingularNotificationStore(x => x.newFeatureNotifications);
    // The configured texts and colours, read when they come in.
    useConfigData();

    useEffect(() => {
        const timer = setTimeout(maybeShowNewFeatureNotifications, SHOW_DELAY_MS);

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            {keys.map(key => (
                <NewFeatureNotification
                    key={key}
                    featureKey={key}
                />
            ))}
        </>
    );
};

const NewFeatureNotification = ({ featureKey }: { featureKey: string }) => {
    const t = useTranslation();
    const { send } = useWebSocketContext();
    const opened = useSingularNotificationStore(x => x.newFeatureNotificationsOpened.includes(featureKey));
    const { markNewFeatureNotificationOpened, closeNewFeatureNotification } = useSingularNotificationActions();
    const type = getHotelProperty(`notifications.new_feature.type.${featureKey}`) || TYPE_NORMAL;

    if (((type !== TYPE_NORMAL) && (type !== TYPE_PROMO)) || getHotelProperty(`notifications.new_feature.expiry.${featureKey}`)) return null;

    const color = hexToUint(getHotelProperty(`notifications.new_feature.color.${featureKey}`) || BG_COLOR_NORMAL);
    // `initLayout`: the open button's lightness halfway from the colour's to the top.
    const hsl = ColorConverter.rgbToHSL(color);
    const buttonColor = ColorConverter.hslToRGB((255 - Math.trunc((255 - (hsl & 0xff)) / 2)) | (hsl & 0xffff00));
    const open = () => {
        openNewFeatureLink(send, featureKey);
        markNewFeatureNotificationOpened(featureKey);
    };
    const cancel = () => closeNewFeatureNotification(featureKey);

    const bindings: TemplateBindings = {
        desc: { caption: t(`notifications.new_feature.${featureKey}.desc`, `notifications.new_feature.${featureKey}.desc`), setCaptionAfterBuild: true },
        static_bitmap: { asset: getHotelProperty(`notifications.new_feature.image.${featureKey}`) },
        cancel_link_region: { visible: (type === TYPE_NORMAL) || opened, onPointerTap: cancel },
    };

    if (type === TYPE_NORMAL) {
        bindings[''] = { color };
        bindings.open_button = { color: buttonColor, onPointerTap: open };
        bindings.cancel_link = { onPointerTap: cancel };
    } else {
        bindings.border = { color };
        bindings.main_region = { onPointerTap: open };
    }

    return (
        <Box layout={{ position: 'relative', marginTop: EXTENSION_SPACING, flexShrink: 0 }}>
            <TemplateWindow
                id={(type === TYPE_NORMAL) ? 'habbo-notifications-com/new_feature_notification_xml' : 'habbo-notifications-com/new_feature_notification_promo_xml'}
                bindings={bindings}
            />
        </Box>
    );
};
