/**
 * What the help window's links send - `HabboHelp.requestSanctionInfo` (`GetMySanctionStatusComposer`)
 * and `requestReportsStatus` (`GetCfhMyReportStatusComposer`), both without a body. Flash shows the
 * answers in their own windows (`SanctionInfo`, `MyReportStatus`), which the port does not have yet.
 */
import { GetCfhMyReportStatusComposer, GetMySanctionStatusComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';

type Send = WebSocketConnection['send'];

export const requestSanctionStatus = (send: Send) => send(new GetMySanctionStatusComposer({}));

export const requestCfhReportsStatus = (send: Send) => send(new GetCfhMyReportStatusComposer({}));
