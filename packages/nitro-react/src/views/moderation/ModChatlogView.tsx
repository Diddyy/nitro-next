import { GetRoomChatlogComposer, GetUserChatlogComposer, IRoomChatlogData } from '@nitrodevco/nitro-packets';
import { useEffect, useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { MOD_CHATLOG_ROOM, moderationChatlogKey, moderationStore, useModerationStore } from '#base/context/moderation';
import { findTemplateChild, TemplateItem, TemplateWindow, useTemplate } from '#base/theme';

const TEMPLATE = 'habbo-moderation-com/evidence_frame_xml';

/** `ChatlogCtrl.populateContentLine`'s alternating row colours (`4291030266`, `4294967295`), the first line the shaded one. */
const ROW_COLORS = [ 0xFFC3ECFA, 0xFFFFFFFF ];

/** A room record's header (`populateEvidence`, record type 1): "Room: name", or "Room #id" without one. */
const headerCaption = (record: IRoomChatlogData) => {
    const roomName = record.context.get('roomName');

    if (record.recordType !== 1) return 'Context';

    return roomName ? `Room: ${String(roomName)}` : `Room #${String(record.context.get('roomId') ?? 0)}`;
};

/**
 * Flash's `moderation/ChatlogCtrl`, not embedded: the `evidence_frame` window, which asks its chatlog
 * (`GetRoomChatlogMessageComposer(0, roomId)` or `GetUserChatlogMessageComposer(userId)`) and stays
 * hidden until it comes (`onChatlog` sets the caption and shows it). Each record is the list's first
 * item cloned as a header ("Room: name" with its "Room tool" button) and its lines the second
 * (`chatline`): time, chatter (a link to their user info; "Bot / pet" for 0) and message, rows in
 * alternating shades.
 */
export const ModChatlogView = ({ type, id }: { type: number; id: number }) => {
    const { send } = useWebSocketContext();
    const chatlog = useModerationStore(x => x.chatlogs[moderationChatlogKey(type, id)]);
    const template = useTemplate(TEMPLATE);
    const [ frame ] = useState(() => ({ id: `moderation-chatlog-${type}-${id}`, onClose: () => moderationStore.getState().closeWindow({ kind: 'chatlog', type, id }) }));

    useEffect(() => {
        send((type === MOD_CHATLOG_ROOM) ? new GetRoomChatlogComposer({ roomType: 0, roomId: id }) : new GetUserChatlogComposer({ userId: id }));
    }, [ send, type, id ]);

    const list = template && findTemplateChild(template.elements, 'evidence_list');
    const [ header, line ] = list?.children ?? [];

    if (!chatlog || !header || !line) return null;

    const { showWindow } = moderationStore.getState();
    const items: TemplateItem[] = [];

    chatlog.records.forEach((record, recordIndex) => {
        const roomId = Number(record.context.get('roomId') ?? 0);

        items.push({
            key: `h${recordIndex}`,
            from: header,
            bindings: {
                text: { caption: headerCaption(record) },
                btnHeaderAction: (roomId > 0) ? { caption: 'Room tool', onPointerTap: () => showWindow({ kind: 'roomTool', roomId }) } : { visible: false },
                btnHeaderAction2: { visible: false },
            },
        });

        record.chatlog.forEach((entry, index) => {
            const color = ROW_COLORS[index % 2];

            items.push({
                key: `l${recordIndex}:${index}`,
                from: line,
                bindings: {
                    '': { color },
                    time_txt: { caption: entry.timeStamp },
                    chatter_txt: (entry.chatterId > 0)
                        ? { caption: entry.chatterName, underline: true, onPointerTap: () => showWindow({ kind: 'userInfo', userId: entry.chatterId }) }
                        : { caption: (entry.chatterId === 0) ? 'Bot / pet' : '-', underline: false },
                    msg_txt: { caption: entry.msg },
                },
            });
        });
    });

    return (
        <TemplateWindow
            id={TEMPLATE}
            frame={frame}
            bindings={{
                '': { caption: chatlog.caption },
                evidence_list: { items },
            }}
        />
    );
};
