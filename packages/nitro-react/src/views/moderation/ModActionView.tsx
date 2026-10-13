import { DefaultSanctionComposer, ModAlertComposer, ModBanComposer, ModKickComposer, ModMessageComposer, ModMuteComposer, ModToolSanctionComposer, ModTradingLockComposer } from '@nitrodevco/nitro-packets';
import { useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { useHelpStore } from '#base/context/help';
import { moderationFrame, moderationStore, moderationWindowKey, useModerationStore } from '#base/context/moderation';
import { useSystemStore, useTranslation } from '#base/context/system';
import { TemplateWindow } from '#base/theme';

/** `ModActionDefinition(actionId, name, actionType, sanctionTypeId, actionLengthHours)`. */
interface ModActionDefinition {
    actionId: number;
    name: string;
    actionType: number;
    sanctionTypeId: number;
    actionLengthHours: number;
}

/** `ModActionCtrl`'s twelve actions (`ModActionCtrl.as:64-75`), in its drop menu's order. */
const MOD_ACTIONS: readonly ModActionDefinition[] = [
    { actionId: 1, name: 'Alert', actionType: 1, sanctionTypeId: 1, actionLengthHours: 0 },
    { actionId: 2, name: 'Mute 1h', actionType: 2, sanctionTypeId: 2, actionLengthHours: 0 },
    { actionId: 3, name: 'Ban 18h', actionType: 3, sanctionTypeId: 3, actionLengthHours: 0 },
    { actionId: 4, name: 'Ban 7 days', actionType: 3, sanctionTypeId: 4, actionLengthHours: 0 },
    { actionId: 5, name: 'Ban 30 days (step 1)', actionType: 3, sanctionTypeId: 5, actionLengthHours: 0 },
    { actionId: 7, name: 'Ban 30 days (step 2)', actionType: 3, sanctionTypeId: 7, actionLengthHours: 0 },
    { actionId: 6, name: 'Ban 100 years', actionType: 3, sanctionTypeId: 6, actionLengthHours: 0 },
    { actionId: 106, name: 'Ban avatar-only 100 years', actionType: 3, sanctionTypeId: 6, actionLengthHours: 0 },
    { actionId: 101, name: 'Kick', actionType: 4, sanctionTypeId: 0, actionLengthHours: 0 },
    { actionId: 102, name: 'Lock trade 1 week', actionType: 5, sanctionTypeId: 0, actionLengthHours: 168 },
    { actionId: 104, name: 'Lock trade permanent', actionType: 5, sanctionTypeId: 0, actionLengthHours: 876000 },
    { actionId: 105, name: 'Message', actionType: 6, sanctionTypeId: 0, actionLengthHours: 0 },
];

/** Not taken from an issue (`getIssueId` with no issue): the composers then leave the issue id out. */
const NO_ISSUE = -1;

/**
 * Flash's `moderation/ModActionCtrl`: the `modact_summary` window ("Mod action on: name"), opened
 * from the user info. A CFH topic (every topic of every category, `${help.cfh.topic.<id>}`) and a
 * sanction are picked; picking a topic clears the sanction (the topic-to-sanction map is never
 * filled, `initializeTopicToSanctionTypeMapping`) and asks the account's default sanction
 * (`ModToolSanction(-1, userId, topic)`), whose `CfhSanction` labels and enables "Default
 * sanction". "Custom sanction" refuses without a topic or a sanction, holds alert, ban and kick to
 * the init's permissions ("You have insufficient permissions.") and a message to text, then sends
 * the action's message (`onCustomSanctionButton`, `ModActionCtrl.as:233-300`) and closes.
 */
export const ModActionView = ({ userId, userName }: { userId: number; userName: string }) => {
    const { send } = useWebSocketContext();
    const t = useTranslation();
    const init = useModerationStore(x => x.init);
    const defaultSanction = useModerationStore(x => x.defaultSanctions[userId]);
    const categories = useHelpStore(x => x.callForHelpCategories);
    const showSimpleAlert = useSystemStore(x => x.showSimpleAlert);
    const [ topic, setTopic ] = useState(-1);
    const [ action, setAction ] = useState(-1);
    const [ text, setText ] = useState('');
    const close = () => moderationStore.getState().closeWindow({ kind: 'modAction', userId, userName });
    const [ frame ] = useState(() => moderationFrame(moderationWindowKey({ kind: 'modAction', userId, userName }), close));

    const topicIds = categories.flatMap(category => category.topics.map(x => x.id));
    const alert = (message: string) => showSimpleAlert({ caption: 'Alert', message });

    const selectTopic = (index: number) => {
        setTopic(index);
        setAction(-1);
        send(new ModToolSanctionComposer({ issueId: NO_ISSUE, accountId: userId, topicId: topicIds[index] }));
    };

    const giveDefault = () => {
        if (topic < 0) return alert('Please select a topic.');

        send(new DefaultSanctionComposer({ userId, topicId: topicIds[topic], message: text, issueId: NO_ISSUE }));
        close();
    };

    const giveCustom = () => {
        if (topic < 0) return alert('Please select a topic.');
        if (action < 0) return alert('Please select a sanction.');
        if (!init) return;

        const topicId = topicIds[topic];
        const definition = MOD_ACTIONS[action];
        const base = { userId, message: text, topicId, issueId: NO_ISSUE };

        switch (definition.actionType) {
            case 1:
                if (!init.alertPermission) return alert('You have insufficient permissions.');
                send(new ModAlertComposer(base));
                break;
            case 2:
                send(new ModMuteComposer(base));
                break;
            case 3:
                if (!init.banPermission) return alert('You have insufficient permissions.');
                send(new ModBanComposer({ ...base, sanctionTypeId: definition.sanctionTypeId, avatarOnly: definition.actionId === 106 }));
                break;
            case 4:
                if (!init.kickPermission) return alert('You have insufficient permissions.');
                send(new ModKickComposer(base));
                break;
            case 5:
                send(new ModTradingLockComposer({ userId, message: text, lengthMinutes: definition.actionLengthHours * 60, topicId, issueId: NO_ISSUE }));
                break;
            case 6:
                if (!text) return alert('Please write a message to user.');
                send(new ModMessageComposer(base));
                break;
        }

        close();
    };

    return (
        <TemplateWindow
            id="habbo-moderation-com/modact_summary_xml"
            frame={frame}
            bindings={{
                '': { caption: `Mod action on: ${userName}` },
                cfh_topics: { options: topicIds.map(id => t(`help.cfh.topic.${id}`)), selection: topic, onSelect: selectTopic },
                sanction_type: { options: MOD_ACTIONS.map(x => x.name), selection: action, onSelect: setAction },
                message_input: { onChange: setText },
                default_sanction_label: defaultSanction ? { caption: defaultSanction } : {},
                default_sanction_button: { disabled: !defaultSanction, onPointerTap: () => defaultSanction && giveDefault() },
                custom_sanction_button: { onPointerTap: giveCustom },
            }}
        />
    );
};
