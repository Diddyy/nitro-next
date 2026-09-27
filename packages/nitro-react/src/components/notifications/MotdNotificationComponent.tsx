/**
 * Mounts the message-of-the-day windows - one `MOTDNotification` for every one the store holds,
 * each closed by its own buttons. `registerSingularNotificationHandlers` opens them.
 */
import { useSingularNotificationActions, useSingularNotificationStore } from '#base/context/singular-notifications';
import { MotdNotificationView } from '#base/views/notifications/MotdNotificationView';

export const MotdNotificationComponent = () => {
    const motdNotifications = useSingularNotificationStore(x => x.motdNotifications);
    const { closeMotdNotification } = useSingularNotificationActions();

    return (
        <>
            {motdNotifications.map(notification => (
                <MotdNotificationView
                    key={notification.id}
                    id={notification.id}
                    messages={notification.messages}
                    onClose={() => closeMotdNotification(notification.id)}
                />
            ))}
        </>
    );
};
