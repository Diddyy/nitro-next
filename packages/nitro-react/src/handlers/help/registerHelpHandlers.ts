/**
 * `HabboHelp`'s listeners for the help window's status links: `onMySanctionStatusMessageEvent`
 * (`SanctionInfo.openWindow`) and `onMyCfhReportStatusMessageEvent` (`MyReportStatus.openWindow`).
 * Each answer opens its window anew (`openWindow` disposes the one already up first).
 */
import { MyCfhReportStatusMessage, SanctionStatusEventMessage } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { systemStore } from '#base/context/system';

import { on, subscribeAll } from '../packetSubscriptions';

export const registerHelpHandlers = ({ subscribe }: WebSocketConnection) => subscribeAll(subscribe, [
    on(SanctionStatusEventMessage, data => systemStore.getState().showWindow('help_sanction_info', { sanctions: data.sanctions, openedAt: performance.now() })),
    on(MyCfhReportStatusMessage, data => systemStore.getState().showWindow('help_my_reports', { reports: data.reports, openedAt: performance.now() })),
]);
