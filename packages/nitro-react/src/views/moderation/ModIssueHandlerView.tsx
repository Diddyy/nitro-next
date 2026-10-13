import { CloseIssueDefaultActionComposer, CloseIssuesComposer, GetCfhChatlogComposer, GetGuestRoomComposer, GetModeratorUserInfoComposer, ModToolPreferencesComposer, ModToolSanctionComposer } from '@nitrodevco/nitro-packets';
import { useEffect, useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { useHelpStore } from '#base/context/help';
import { highestPriorityIssue, ISSUE_RESOLUTION_RESOLVED, ISSUE_RESOLUTION_USELESS, issueOpenTime, MOD_CHATLOG_CFH, moderationChatlogKey, moderationIssueStore, useModerationIssueStore, useModerationStore } from '#base/context/moderation';
import { systemStore } from '#base/context/system';
import { moderationIssueSends } from '#base/handlers/moderation';
import { findTemplateChild, TemplateItem, TemplateWindow, useTemplate } from '#base/theme';

import { issueCategoryName, issueSourceName } from './issueNames';
import { chatlogItems } from './ModChatlogView';
import { userInfoBindings } from './ModUserInfoView';

const TEMPLATE = 'habbo-moderation-com/issue_handler_xml';

/** `IssueHandler.update`: the window's place is sent only 5 s after it opened, once it changed. */
const PREFERENCES_DELAY_MS = 5000;

/**
 * Flash's `moderation/IssueHandler`: the `issue_handler` frame for a bundle this moderator handles,
 * where they last left one (`ModeratorToolPreferences`). The bundle's issues (reporter, topic,
 * source, open time; the highest priority one bold when there are more) and their messages
 * ("reporter: message"), the caller's and the reported player's user info (`UserInfoCtrl`, the
 * reported one taken out when the bundle names no one), and the call's chat
 * (`GetCfhChatlogMessageComposer` -> "Call For Help Evidence"). Close as useless (1) or resolved (3)
 * (`CloseIssuesMessageComposer`), close with the default sanction (`CloseIssueDefaultActionMessageComposer`:
 * the highest priority issue, the rest, -1) or release; then, with "Automatically open next issue"
 * ticked (it starts ticked), the next open bundle is picked (`checkAutoHandling`). The topic menu lists
 * every call for help topic as `help.cfh.topic.<id>` (`initializeTopicDropdown`), on the issue's own
 * (disabled for 27, "Useless reports"); opening and every topic picked ask the default sanction
 * (`ModToolSanctionComposer`), shown as `sanction_label` once `CfhSanction` comes. An issue still on
 * topic 28 ("Auto-triggered") cannot be closed with the sanction ("Topic missing").
 */
export const ModIssueHandlerView = ({ bundleId }: { bundleId: number }) => {
    const { send } = useWebSocketContext();
    const bundle = useModerationIssueStore(x => x.snapshot.find(b => b.id === bundleId));
    const preferences = useModerationIssueStore(x => x.preferences);
    const template = useTemplate(TEMPLATE);
    const evidenceTemplate = useTemplate('habbo-moderation-com/evidence_frame_xml');
    const userInfoTemplate = useTemplate('habbo-moderation-com/user_info_xml');
    const [ handleNext, setHandleNext ] = useState(true);
    const [ openedAt ] = useState(() => performance.now());
    const [ now, setNow ] = useState(() => performance.now());
    const issue = bundle && highestPriorityIssue(bundle);
    const issueId = issue?.issueId ?? 0;
    const reporterId = issue?.reporterUserId ?? 0;
    const reportedId = bundle?.reportedUserId ?? 0;
    const chatlog = useModerationStore(x => x.chatlogs[moderationChatlogKey(MOD_CHATLOG_CFH, issueId)]);
    const caller = useModerationStore(x => x.userInfos[reporterId]);
    const reported = useModerationStore(x => x.userInfos[reportedId]);
    const categories = useHelpStore(x => x.callForHelpCategories);
    const sanctionLabel = useModerationIssueStore(x => x.sanctionTexts[bundleId]);
    const issueTopic = issue?.reportedCategoryId ?? 0;
    // `initializeTopicDropdown`: every topic of every category, in order; the issue's own selected.
    const topicIds = categories.flatMap(category => category.topics.map(topic => topic.id));
    // `show`: an automatic report (source 3) still on topic 28 starts on topic 1.
    const autoTriggered = (issue?.categoryId === 3) && (issueTopic === 28);
    const [ topicSelection, setTopicSelection ] = useState<number | undefined>(undefined);
    const selectedTopic = topicSelection ?? topicIds.indexOf(autoTriggered ? 1 : issueTopic);

    // `show`: requestSanctionData(bundle, -1), then topic 1 for an automatic report on 28.
    useEffect(() => {
        if (!issueId) return;

        send(new ModToolSanctionComposer({ issueId, accountId: -1, topicId: -1 }));

        if (autoTriggered) send(new ModToolSanctionComposer({ issueId, accountId: -1, topicId: 1 }));
    }, [ send, issueId, autoTriggered ]);
    const [ frame ] = useState(() => ({
        id: `moderation-issue-handler-${bundleId}`,
        defaultPosition: { x: preferences.x, y: preferences.y },
        rememberPosition: false,
        onPositionChange: (position: { x: number; y: number }) => {
            const current = moderationIssueStore.getState().preferences;

            if ((performance.now() - openedAt) <= PREFERENCES_DELAY_MS) return;
            if ((position.x === current.x) && (position.y === current.y)) return;

            const next = { ...current, x: position.x, y: position.y };

            moderationIssueStore.getState().setPreferences(next);
            send(new ModToolPreferencesComposer({ windowX: next.x, windowY: next.y, windowWidth: next.width, windowHeight: next.height }));
        },
        onClose: () => moderationIssueStore.getState().removeHandler(bundleId),
    }));

    // `registerUpdateReceiver(this, 1000)`: the open times move on each second.
    useEffect(() => {
        const timer = setInterval(() => setNow(performance.now()), 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (issueId) send(new GetCfhChatlogComposer({ issueId }));
    }, [ send, issueId ]);

    useEffect(() => {
        if (reporterId) send(new GetModeratorUserInfoComposer({ userId: reporterId }));
        if (reportedId) send(new GetModeratorUserInfoComposer({ userId: reportedId }));
    }, [ send, reporterId, reportedId ]);

    if (!template || !bundle || !issue) return null;

    const issues = moderationIssueStore.getState();
    const sends = moderationIssueSends(send);
    const ids = [ ...bundle.issues.keys() ];
    const list = (name: string) => findTemplateChild(template.elements, name)?.children[0];
    const issueRow = list('issues_item_list');
    const messageRow = list('msg_item_list');
    const evidence = evidenceTemplate && findTemplateChild(evidenceTemplate.elements, 'evidence_list');
    const [ header, line ] = evidence?.children ?? [];

    // `checkAutoHandling` then `dispose`.
    const done = () => {
        if (handleNext) issues.autoPick('issue handler pick next', sends);

        issues.removeHandler(bundleId);
    };

    const issueItems: TemplateItem[] = issueRow
        ? [ ...bundle.issues.values() ].map((item, index) => ({
                key: `i${item.issueId}`,
                from: issueRow,
                bindings: {
                    '': { background: (index % 2) === 0 },
                    reporter: { caption: item.reporterUserName },
                    type: { caption: issueSourceName(item.categoryId) },
                    category: { caption: issueCategoryName(item.reportedCategoryId), style: ((item.issueId === issueId) && (bundle.issues.size > 1)) ? 'bold' : undefined },
                    time_open: { caption: issueOpenTime(item, now) },
                },
            }))
        : [];
    const messageItems: TemplateItem[] = messageRow
        ? [ ...bundle.issues.values() ].map((item, index) => ({
                key: `m${item.issueId}`,
                from: messageRow,
                bindings: { '': { caption: `${item.reporterUserName}: ${item.message}`, background: (index % 2) === 0 } },
            }))
        : [];
    const userInfo = (user: Parameters<typeof userInfoBindings>[0]) => (userInfoTemplate ? [ { key: 'user_info', from: userInfoTemplate, bindings: userInfoBindings(user) } ] : []);

    return (
        <TemplateWindow
            id={TEMPLATE}
            frame={frame}
            bindings={{
                issues_item_list: { items: issueItems },
                msg_item_list: { items: messageItems },
                caller_user_info: { items: userInfo(caller) },
                reported_user_info: reportedId ? { items: userInfo(reported) } : { visible: false },
                reported_user_info_caption: { visible: reportedId > 0 },
                evidence_list: { items: (chatlog && header && line) ? chatlogItems(chatlog.records, header, line, `issueHandler:${bundleId}`, roomId => send(new GetGuestRoomComposer({ roomId, enterRoom: false, roomForward: true }))) : [] },
                handle_next_checkbox: { selected: handleNext, onPointerTap: () => setHandleNext(!handleNext) },
                close_useless: {
                    onPointerTap: () => {
                        send(new CloseIssuesComposer({ issueIds: ids, closeReason: ISSUE_RESOLUTION_USELESS }));
                        done();
                    },
                },
                close_resolved: {
                    onPointerTap: () => {
                        send(new CloseIssuesComposer({ issueIds: ids, closeReason: ISSUE_RESOLUTION_RESOLVED }));
                        done();
                    },
                },
                close_sanction: {
                    onPointerTap: () => {
                        if (issueTopic === 28) {
                            systemStore.getState().showSimpleAlert({ caption: 'Topic missing', message: 'You need to select the topic first.' });

                            return;
                        }

                        send(new CloseIssueDefaultActionComposer({ issueId, otherIssueIds: ids.filter(x => x !== issueId), topicId: -1 }));
                        done();
                    },
                },
                cfh_topics: (issueTopic === 27)
                    ? { disabled: true }
                    : {
                            options: topicIds.map(id => `\${help.cfh.topic.${id}}`),
                            selection: (selectedTopic >= 0) ? selectedTopic : undefined,
                            // `refreshSanctionDataForSelectedTopic`.
                            onSelect: (index: number) => {
                                setTopicSelection(index);
                                send(new ModToolSanctionComposer({ issueId, accountId: -1, topicId: topicIds[index] }));
                            },
                        },
                sanction_label: (sanctionLabel !== undefined) ? { caption: sanctionLabel } : {},
                release: {
                    onPointerTap: () => {
                        issues.releaseBundle(bundleId, sends);
                        done();
                    },
                },
            }}
        />
    );
};
