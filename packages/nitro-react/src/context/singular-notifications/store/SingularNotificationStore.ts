/**
 * The notification windows of Flash's `notifications/singular` package that are windows rather
 * than bubbles: the message-of-the-day windows (`MOTDNotification`) and the club gift and safety
 * lock notifications `SingularNotificationController` docks in the toolbar's extension column.
 * The bubble stack itself is `notificationStore`. An app-wide singleton: the packets that raise
 * these arrive whatever is open, and the extension column reads them from here.
 *
 * `NewFeatureNotification` (the same controller's `notifications.new_feature.*` promotions) is
 * not here: it needs the reward track and the catalogue promo widgets it links to.
 */
import { createStore } from 'zustand';

import { createMotdNotificationSlice, MotdNotificationSlice } from './MotdNotificationSlice';
import { createToolbarNotificationSlice, ToolbarNotificationSlice } from './ToolbarNotificationSlice';

export type SingularNotificationStore = MotdNotificationSlice & ToolbarNotificationSlice;

export const createSingularNotificationStore = () => createStore<SingularNotificationStore>()((set, get, store) => ({
    ...createMotdNotificationSlice(set, get, store),
    ...createToolbarNotificationSlice(set, get, store),
}));

export const singularNotificationStore = createSingularNotificationStore();
