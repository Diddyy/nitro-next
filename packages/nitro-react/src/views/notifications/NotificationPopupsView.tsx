import { isNotificationEventLink, notificationEventLink, openClientLink } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { NOTIFICATION_ASSETS, NotificationAssetName, NotificationPopupItem, useNotificationActions, useNotificationStore } from '#base/context/notifications';
import { useInterpolate } from '#base/context/system';
import { LayoutImage, ModalDialog, TemplateWindow, useTemplateFrame } from '#base/theme';

const TEMPLATE = 'habbo-notifications-com/layout_notification_popup_xml';

/** `NotificationPopup.CRITICAL_COLOR`, the frame's colour for `alertStyle` `critical`. */
const CRITICAL_COLOR = 0xffc42f3d;

/** A notifications library bitmap by name as `LayoutImage` names it, else the url as it is. */
const illustrationSource = (image: string) => {
    const file = NOTIFICATION_ASSETS[image as NotificationAssetName];

    return file ? LayoutImage(`habbo-notifications-com/${file}`) : image;
};

/**
 * Every open `NotificationPopup` (`com/sulake/habbo/notifications/NotificationPopup`), each a
 * modal dialog built from the notifications library's `layout_notification_popup`. Mounted once,
 * in `MainView`'s window layer.
 */
export const NotificationPopupsView = () => {
    const popups = useNotificationStore(x => x.popups);

    return (
        <>
            {popups.map(popup => (
                <NotificationPopupView
                    key={popup.key}
                    popup={popup}
                />
            ))}
        </>
    );
};

/**
 * One `NotificationPopup` over `layout_notification_popup`, built as a modal dialog
 * (`buildModalDialogFromXML`): the frame captioned with the `title` - `CRITICAL_COLOR` for
 * `alertStyle` `critical` - the `illustration`, and the `message`.
 *
 * With an `event:` url the `action` button shows, captioned with the `linkTitle` (the url when it
 * has none): it goes to the client's link bus (`createLinkEvent`) and closes the popup. Any other
 * url shows the `link`, which opens the page (`HabboWebTools.openWebPage`) and leaves the popup up.
 * The header close disposes it. The layout's item lists grow the frame with what they hold.
 */
const NotificationPopupView = ({ popup }: { popup: NotificationPopupItem }) => {
    const { removeNotificationPopup } = useNotificationActions();
    const { send } = useWebSocketContext();
    const interpolate = useInterpolate();
    const close = () => removeNotificationPopup(popup.key);
    const frame = useTemplateFrame({ id: `notification_popup_${popup.key}`, modal: true, rememberPosition: false, onClose: close });
    const hasLink = popup.linkUrl !== undefined;
    const isEventLink = isNotificationEventLink(popup.linkUrl);
    const linkTitle = interpolate(popup.linkTitle ?? popup.linkUrl ?? '');

    return (
        <ModalDialog>
            <TemplateWindow
                id={TEMPLATE}
                frame={frame}
                bindings={{
                    '': { caption: interpolate(popup.title), ...(popup.critical ? { color: CRITICAL_COLOR } : {}) },
                    illustration: { asset: illustrationSource(popup.image) },
                    message: { caption: interpolate(popup.message) },
                    action: {
                        visible: hasLink && isEventLink,
                        caption: linkTitle,
                        // `createLinkEvent(linkUrl.substr(6))`, then `dispose()`.
                        onPointerTap: () => {
                            if (popup.linkUrl) openClientLink(send, notificationEventLink(popup.linkUrl));

                            close();
                        },
                    },
                    link: {
                        visible: hasLink && !isEventLink,
                        caption: linkTitle,
                        // `HabboWebTools.openWebPage(linkUrl, "habboMain")`; the popup stays.
                        onPointerTap: () => {
                            if (popup.linkUrl) window.open(popup.linkUrl, 'habboMain', 'noopener');
                        },
                    },
                }}
            />
        </ModalDialog>
    );
};
