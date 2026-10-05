import { Container as PixiContainer } from 'pixi.js';
import { useState } from 'react';

import { isNotificationEventLink, notificationEventLink, openClientLink } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { NOTIFICATION_ASSETS, NotificationAssetName, NotificationPopupItem, useNotificationActions, useNotificationStore } from '#base/context/notifications';
import { useInterpolate } from '#base/context/system';
import { Button, Frame, LayoutImage, ModalDialog, Region, ThemeImage, ThemeText, useLayoutSize } from '#base/theme';

/** `layout_notification_popup`'s frame colour. */
const FRAME_COLOR = '#67a3bf';
/** `NotificationPopup.CRITICAL_COLOR` (`0xffc42f3d`), for `alertStyle` `critical`. */
const CRITICAL_COLOR = '#c42f3d';

/** The frame as built (306x92), and its `itemlist_horizontal` (294x46) - the frame grows by what the list grows. */
const FRAME_WIDTH = 306;
const FRAME_HEIGHT = 92;
const LIST_WIDTH = 294;
const LIST_HEIGHT = 46;
/** The vertical `itemlist` beside the illustration, and its `message`. */
const TEXT_LIST_WIDTH = 293;
/** The `illustration` before it has a bitmap: 1x1. */
const EMPTY_ILLUSTRATION = 1;

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
 * One `NotificationPopup`: a style 3 frame tinted `0x67a3bf` - `CRITICAL_COLOR` for
 * `alertStyle` `critical` - captioned with the `title`, over an `itemlist_horizontal` of the
 * `illustration` (`fit_size_to_contents`) and a vertical `itemlist` of the `u_regular` `message`
 * (293 wide, word wrapped, an 8px bottom margin), the underlined `link` and the `action` button.
 *
 * With an `event:` url the `action` button shows, captioned with the `linkTitle`: it goes to the
 * client's link bus (`createLinkEvent`) and closes the popup. Any other url shows the `link`,
 * which opens the page (`HabboWebTools.openWebPage`) and leaves the popup up. The header close
 * disposes it.
 *
 * Both lists `resize_to_accommodate_children` and `reflect_resize_to_parent`, so the frame is its
 * 306x92 grown by whatever the horizontal list grew past 294x46: the illustration's width, and
 * the taller of the text list and the illustration (`WE_RESIZED` makes the illustration's height
 * the list's minimum). A hidden `link` or `action` takes no room in the list. The `action`
 * button sits at its layout x of 136 and widens to its caption from there
 * (`on_accommodate_align_left`).
 */
const NotificationPopupView = ({ popup }: { popup: NotificationPopupItem }) => {
    const { removeNotificationPopup } = useNotificationActions();
    const { send } = useWebSocketContext();
    const interpolate = useInterpolate();
    const [ illustrationNode, setIllustrationNode ] = useState<PixiContainer | null>(null);
    const [ textListNode, setTextListNode ] = useState<PixiContainer | null>(null);
    const illustrationSize = useLayoutSize(illustrationNode);
    const textListSize = useLayoutSize(textListNode);
    const illustrationWidth = (illustrationSize.width > 0) ? illustrationSize.width : EMPTY_ILLUSTRATION;
    const listHeight = Math.max(Math.ceil(textListSize.height), illustrationSize.height);
    const width = FRAME_WIDTH + ((illustrationWidth + TEXT_LIST_WIDTH) - LIST_WIDTH);
    const height = (listHeight > 0) ? (FRAME_HEIGHT + (listHeight - LIST_HEIGHT)) : FRAME_HEIGHT;
    const isEventLink = isNotificationEventLink(popup.linkUrl);
    const linkTitle = interpolate(popup.linkTitle ?? '');

    const close = () => removeNotificationPopup(popup.key);

    // `action`: `createLinkEvent(linkUrl.substr(6))`, then `dispose()`.
    const followAction = () => {
        if (popup.linkUrl) openClientLink(send, notificationEventLink(popup.linkUrl));

        close();
    };

    // `link`: `HabboWebTools.openWebPage(linkUrl, "habboMain")`; the popup stays.
    const followLink = () => {
        if (popup.linkUrl) window.open(popup.linkUrl, 'habboMain', 'noopener');
    };

    return (
        <ModalDialog>
            <Frame
                variant="3"
                id={`notification-popup-${popup.key}`}
                caption={interpolate(popup.title)}
                tintColor={popup.critical ? CRITICAL_COLOR : FRAME_COLOR}
                dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
                onClose={close}
                rememberPosition={false}
                resizeDirection="none"
                margins={[ 3, 36, 3, 3 ]}
                layout={{ width, height }}
            >
                <Region layout={{ position: 'absolute', left: 3, top: 2, flexDirection: 'row', alignItems: 'flex-start' }}>
                    <ThemeImage
                        ref={setIllustrationNode}
                        src={illustrationSource(popup.image)}
                        bitmap={{ stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                        layout={{ flexShrink: 0 }}
                    />
                    <Region
                        ref={setTextListNode}
                        layout={{ width: TEXT_LIST_WIDTH, flexShrink: 0, flexDirection: 'column' }}
                    >
                        <Region layout={{ width: TEXT_LIST_WIDTH, flexShrink: 0, paddingBottom: 8 }}>
                            <ThemeText
                                text={interpolate(popup.message)}
                                textStyle="u_regular"
                                textOptions={{ wordWrap: true, wordWrapWidth: TEXT_LIST_WIDTH - 4 }}
                                markup
                                verticalAlign="top"
                            />
                        </Region>
                        {(popup.linkUrl !== undefined) && !isEventLink && (
                            <Region
                                cursor="pointer"
                                onPointerTap={followLink}
                                layout={{ width: TEXT_LIST_WIDTH, flexShrink: 0, flexDirection: 'row', justifyContent: 'center' }}
                            >
                                <ThemeText
                                    text={linkTitle}
                                    textStyle="u_regular"
                                    textOptions={{ wordWrap: true, wordWrapWidth: TEXT_LIST_WIDTH - 4, align: 'center' }}
                                    flashFormat={{ underline: true }}
                                    verticalAlign="top"
                                />
                            </Region>
                        )}
                        {isEventLink && (
                            <Button
                                variant="3"
                                onPointerTap={followAction}
                                layout={{ height: 30, minWidth: 20, marginLeft: 136, flexShrink: 0, alignSelf: 'flex-start' }}
                            >
                                {linkTitle}
                            </Button>
                        )}
                    </Region>
                </Region>
            </Frame>
        </ModalDialog>
    );
};
