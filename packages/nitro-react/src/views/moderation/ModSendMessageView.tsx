import { ModMessageComposer } from '@nitrodevco/nitro-packets';
import { useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { moderationStore, useModerationStore } from '#base/context/moderation';
import { useSystemStore } from '#base/context/system';
import { TemplateWindow } from '#base/theme';

/** `SendMsgsCtrl`'s topic for a message not tied to a call-for-help topic. */
const NO_TOPIC = -999;

/**
 * Flash's `moderation/SendMsgsCtrl`: the `send_msgs` window ("Msg To: name"). A template from the
 * drop menu fills the input; the layout's own text is a placeholder the first focus clears
 * (`onInputClick`). Send refuses an empty or placeholder message with "You must input a message to
 * the user", else sends `ModMessageMessageComposer(userId, text, -999, -1)` and closes.
 */
export const ModSendMessageView = ({ userId, userName }: { userId: number; userName: string }) => {
    const { send } = useWebSocketContext();
    const templates = useModerationStore(x => x.init?.messageTemplates ?? []);
    const showSimpleAlert = useSystemStore(x => x.showSimpleAlert);
    // `_placeHolderMessage`: the layout's caption until the input is focused or a template picked.
    const [ text, setText ] = useState<string | undefined>(undefined);
    const close = () => moderationStore.getState().closeWindow({ kind: 'sendMessage', userId, userName });
    const [ frame ] = useState(() => ({ id: `moderation-send-message-${userId}`, onClose: close }));

    const sendMessage = () => {
        if (!text) {
            showSimpleAlert({ caption: 'Alert', message: 'You must input a message to the user' });

            return;
        }

        send(new ModMessageComposer({ userId, message: text, topicId: NO_TOPIC, issueId: -1 }));
        close();
    };

    return (
        <TemplateWindow
            id="habbo-moderation-com/send_msgs_xml"
            frame={frame}
            bindings={{
                '': { caption: `Msg To: ${userName}` },
                msgTemplatesSelect: { options: templates, onSelect: index => setText(templates[index]) },
                message_input: { ...((text !== undefined) ? { caption: text } : {}), onFocus: () => setText(text ?? ''), onChange: setText },
                send_message_but: { onPointerTap: sendMessage },
            }}
        />
    );
};
