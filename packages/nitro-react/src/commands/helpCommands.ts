/**
 * What the help window sends - `HabboHelp`:
 * - `requestSanctionInfo` (`GetMySanctionStatusComposer`) and `requestReportsStatus`
 *   (`GetCfhMyReportStatusComposer`), both without a body; the answers open their own windows.
 * - `TopicsFlowHelpController.submitCallForHelp` for a report started from the help window: first
 *   `ignoreAndUnfriendReportedUser` (ignore the reported user and, if they are a friend, remove
 *   them - except for topic 21, `TOPICS_WITHOUT_IGNORE_AND_UNFRIEND`), then a bullying report goes
 *   to the guardians (`ChatReviewSessionCreateComposer`) when `guides.enabled` and
 *   `guardians.enabled` are on, and anything else is a `CallForHelpComposer` with the chat lines
 *   ticked (`ChatReportController.collectSelectedEntries(1, -1)`: user id and text per line).
 */
import { GetConfigValue } from '@nitrodevco/nitro-api';
import { CallForHelpComposer, ChatReviewSessionCreateComposer, GetCfhMyReportStatusComposer, GetMySanctionStatusComposer, ICallForHelpTopic, IgnoreUserComposer, RemoveFriendComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { helpStore } from '#base/context/help';
import { userStore } from '#base/context/user';

type Send = WebSocketConnection['send'];

/** `HabboHelp.TOPICS_WITHOUT_IGNORE_AND_UNFRIEND`. */
const TOPICS_WITHOUT_IGNORE_AND_UNFRIEND = [ 21 ];

/** The topic `submitCallForHelp` hands to the guardians. */
const BULLYING_TOPIC_NAME = 'bullying';

export const requestSanctionStatus = (send: Send) => send(new GetMySanctionStatusComposer({}));

export const requestCfhReportsStatus = (send: Send) => send(new GetCfhMyReportStatusComposer({}));

/** `ChatReportController.collectSelectedEntries(1, -1)`: the ticked lines, oldest first. */
export const collectSelectedChatEntries = (): (number | string)[] => helpStore.getState().chatItems
    .filter(item => item.selected)
    .flatMap(item => [ item.userId, item.text ]);

/** `HabboHelp.ignoreAndUnfriendReportedUser`. */
const ignoreAndUnfriendReportedUser = (send: Send, topicId: number) => {
    const reportedUserId = helpStore.getState().reportedUserId;

    if ((reportedUserId <= 0) || TOPICS_WITHOUT_IGNORE_AND_UNFRIEND.includes(topicId)) return;

    send(new IgnoreUserComposer({ userId: reportedUserId }));

    if (userStore.getState().friends[reportedUserId]) send(new RemoveFriendComposer({ playerIds: [ reportedUserId ] }));
};

/** `TopicsFlowHelpController.submitCallForHelp` for a report started from the help window. */
export const submitCallForHelp = (send: Send, message: string, topic: ICallForHelpTopic, toGuardians: boolean) => {
    const { reportedUserId, reportedRoomId } = helpStore.getState();

    ignoreAndUnfriendReportedUser(send, topic.id);

    if (toGuardians && (topic.name === BULLYING_TOPIC_NAME) && (GetConfigValue<boolean>('guides.enabled') === true) && (GetConfigValue<boolean>('guardians.enabled') === true)) {
        send(new ChatReviewSessionCreateComposer({ reportedUserId, roomId: reportedRoomId }));

        return;
    }

    send(new CallForHelpComposer({ message, topicId: topic.id, reportedUserId, roomId: reportedRoomId, chatEntries: collectSelectedChatEntries(), name: '', email: '' }));
};
