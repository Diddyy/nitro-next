import { useTranslation } from '#base/context/system';
import { Border, Button, Frame, Region, ScrollArea, ThemeText } from '#base/theme';

export interface MotdNotificationViewProps {
    /** The store's id of this window, which names its frame. */
    id: number;
    /** `MOTDNotificationEvent`'s messages, one list item each. */
    messages: string[];
    /** `close` and `header_button_close` - `MOTDNotification.dispose`. */
    onClose: () => void;
}

/**
 * One message-of-the-day window - Flash's `notifications/singular/MOTDNotification` on
 * `motd_notification` (436x227): a style 1 frame tinted `0x4c4c4c` under
 * `${notifications.motd.title}`, centred (`_window.center()`) and draggable (its params carry
 * `mouse_dragging_target`), with no drop shadow. In it the 420x160 `notifications_border` at
 * (1, 0) holds the `message_list` scrolling item list (410x149 at 5, 6), and under it the `close`
 * button (`${generic.ok}`) at (200, 168), which fits its caption from that left edge.
 *
 * Each message is a clone of `motd_notification_item`: a 405 wide `item_container` with the
 * `message_text` (a word-wrapped text, 395 wide at 5, 5, in the style 0 theme's default
 * `regular`; its `text_color="0x0"` is the style's own colour, not an override), made
 * `textHeight + 20` high. The text's own box is its `textHeight` plus the 2px
 * `TextField` gutter above and below, so the item takes 5 over the text and 11 under it.
 */
export const MotdNotificationView = ({ id, messages, onClose }: MotdNotificationViewProps) => {
    const t = useTranslation();

    return (
        <Frame
            variant="1"
            id={`motd-notification-${id}`}
            caption={t('notifications.motd.title')}
            tintColor="#4c4c4c"
            dropShadow={false}
            centered
            rememberPosition={false}
            onClose={onClose}
            resizeDirection="none"
            layout={{ width: 436, height: 227 }}
            margins={[ 6, 25, 6, 7 ]}
        >
            <Border
                variant="0"
                name="notifications_border"
                layout={{ position: 'absolute', left: 1, width: 420, top: 0, height: 160 }}
            >
                <ScrollArea
                    orientation="vertical"
                    variant="0"
                    layout={{ position: 'absolute', left: 5, width: 410, top: 6, height: 149 }}
                >
                    <Region
                        name="message_list"
                        layout={{ flexDirection: 'column', width: '100%' }}
                    >
                        {messages.map((message, index) => (
                            <Region
                                key={index}
                                name="item_container"
                                layout={{ width: 405, paddingLeft: 5, paddingTop: 5, paddingBottom: 11, flexShrink: 0 }}
                            >
                                <ThemeText
                                    text={message}
                                    textOptions={{ wordWrap: true, wordWrapWidth: 391 }}
                                    name="message_text"
                                    verticalAlign="top"
                                    layout={{ width: 395 }}
                                />
                            </Region>
                        ))}
                    </Region>
                </ScrollArea>
            </Border>
            <Button
                variant="0"
                name="close"
                onPointerTap={onClose}
                layout={{ position: 'absolute', left: 200, top: 168, height: 26 }}
            >
                {t('generic.ok')}
            </Button>
        </Frame>
    );
};
