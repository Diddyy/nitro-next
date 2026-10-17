import { GetGuestRoomComposer, GetRoomChatlogComposer, GetUserChatlogComposer, IRoomChatlogData } from '@nitrodevco/nitro-packets';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { MOD_CHATLOG_ROOM, moderationChatlogKey, moderationFrame, moderationStore, moderationWindowKey, useModerationStore } from '#base/context/moderation';
import { findLayoutChildByName, findTemplateChild, getLayoutListItems, TemplateBindings, TemplateElement, TemplateItem, TemplateWindow, TemplateWindows, useTemplate } from '#base/theme';

const TEMPLATE = 'habbo-moderation-com/evidence_frame_xml';

/** `ChatlogCtrl.populateContentLine`'s alternating row colours (`4291030266`, `4294967295`), the first line the shaded one. */
const ROW_COLORS = [ 0xFFC3ECFA, 0xFFFFFFFF ];

/** `populateContentLine` / `refreshListDims`: a line is its message's `textHeight + 5` tall. */
const LINE_TEXT_MARGIN = 5;

/** `refreshScrollBarVisibility`: the list takes the scroller's 22px while the scroller is hidden. */
const SCROLLER_SPACE = 22;

/**
 * `populateContentLine`, before the line goes into the list: its message, time and chatter as tall as
 * the larger of the time and the message's `textHeight + 5` (the message wrapped at its layout width).
 */
const arrangeLine = ({ find, root }: TemplateWindows) => {
    const line = root();
    const time = find('time_txt');
    const chatter = find('chatter_txt');
    const msg = find('msg_txt');

    if (!line || !time || !chatter || !msg) return;

    const height = Math.max(time.height, msg.textHeight + LINE_TEXT_MARGIN);

    msg.setHeight(height);
    chatter.setHeight(height);
    time.setHeight(height);
    line.setHeight(height);
};

/** A room record's header (`populateEvidence`, record type 1): "Room: name", or "Room #id" without one. */
const headerCaption = (record: IRoomChatlogData) => {
    const roomName = record.context.get('roomName');

    if (record.recordType !== 1) return 'Context';

    return roomName ? `Room: ${String(roomName)}` : `Room #${String(record.context.get('roomId') ?? 0)}`;
};

/**
 * `ChatlogCtrl.populateEvidence`: each record the list's first item cloned as a header ("Room: name" with
 * its "Room tool" button, and for a room "View room" when `viewRoom` is given) and its lines the second
 * (`chatline`): time, chatter (a link to their user info; "Bot / pet" for 0) and message, rows in alternating shades. Windows it opens go beside `caller`.
 */
export const chatlogItems = (records: IRoomChatlogData[], header: TemplateElement, line: TemplateElement, caller: string, viewRoom?: (roomId: number) => void) => {
    const { showWindow } = moderationStore.getState();
    const items: TemplateItem[] = [];

    records.forEach((record, recordIndex) => {
        const roomId = Number(record.context.get('roomId') ?? 0);

        items.push({
            key: `h${recordIndex}`,
            from: header,
            bindings: {
                text: { caption: headerCaption(record) },
                btnHeaderAction: (roomId > 0) ? { caption: 'Room tool', onPointerTap: () => showWindow({ kind: 'roomTool', roomId }, caller) } : { visible: false },
                // `OpenRoomInSpectatorMode`: "View room" goes to the room (`ModerationManager.goToRoom`).
                btnHeaderAction2: ((record.recordType === 1) && (roomId > 0) && viewRoom) ? { caption: 'View room', onPointerTap: () => viewRoom(roomId) } : { visible: false },
            },
        });

        record.chatlog.forEach((entry, index) => {
            const color = ROW_COLORS[index % 2];
            // The time, chatter and message take the line's colour (`_loc4_.color = _loc7_.color`).
            const fill = color & 0xFFFFFF;

            items.push({
                key: `l${recordIndex}:${index}`,
                from: line,
                bindings: {
                    '': { color },
                    time_txt: { caption: entry.timeStamp },
                    chatter_txt: (entry.chatterId > 0)
                        ? { caption: entry.chatterName, underline: true, backgroundColor: fill, onPointerTap: () => showWindow({ kind: 'userInfo', userId: entry.chatterId }, caller) }
                        : { caption: (entry.chatterId === 0) ? 'Bot / pet' : '-', underline: false, backgroundColor: fill },
                    msg_txt: { caption: entry.msg, backgroundColor: fill },
                },
                arrange: arrangeLine,
            });
        });
    });

    return items;
};

/**
 * `ChatlogCtrl.onResizeTimer`, run once the chatlog is in (and again on each resize): `refreshListDims`
 * widens each `chatline`'s message to the line's right edge and makes the line its message's
 * `textHeight + 5` tall; `refreshScrollBarVisibility` hides the list's sibling `scroller` while the
 * lines fit, the list taking its 22px - its lines stretch with it, their messages keep their width.
 * Returns the bindings that hide the scroller and the window's `arrange`, for the frame and for the
 * issue handler, which shows the chatlog in its own `evidence_list` (`_embedded`).
 */
export const useChatlogArrange = (): { bindings: TemplateBindings; arrange: (windows: TemplateWindows) => void } => {
    const [ scrollerHidden, setScrollerHidden ] = useState(false);
    const fits = useRef(scrollerHidden);

    useLayoutEffect(() => {
        if (fits.current !== scrollerHidden) setScrollerHidden(fits.current);
    });

    const arrange = ({ find }: TemplateWindows) => {
        const list = find('evidence_list');

        if (!list) return;

        for (const line of getLayoutListItems(list)) {
            if (line.element?.name !== 'chatline') continue;

            const msg = findLayoutChildByName(line, 'msg_txt');

            if (!msg) continue;

            msg.setWidth(line.width - msg.x);
            msg.setHeight(msg.textHeight + LINE_TEXT_MARGIN);
            line.setHeight(msg.height);
        }

        fits.current = list.scrollableRegion.height <= list.height;

        if (scrollerHidden) list.setWidth(list.width + SCROLLER_SPACE);
    };

    return { bindings: scrollerHidden ? { scroller: { visible: false } } : {}, arrange };
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
    const key = moderationWindowKey({ kind: 'chatlog', type, id });
    const [ frame ] = useState(() => moderationFrame(key, () => moderationStore.getState().closeWindow({ kind: 'chatlog', type, id })));
    const { bindings, arrange } = useChatlogArrange();

    useEffect(() => {
        send((type === MOD_CHATLOG_ROOM) ? new GetRoomChatlogComposer({ roomType: 0, roomId: id }) : new GetUserChatlogComposer({ userId: id }));
    }, [ send, type, id ]);

    const list = template && findTemplateChild(template.elements, 'evidence_list');
    const [ header, line ] = list?.children ?? [];

    if (!chatlog || !header || !line) return null;

    const items = chatlogItems(chatlog.records, header, line, key, roomId => send(new GetGuestRoomComposer({ roomId, enterRoom: false, roomForward: true })));

    return (
        <TemplateWindow
            id={TEMPLATE}
            frame={frame}
            bindings={{
                ...bindings,
                '': { caption: chatlog.caption },
                evidence_list: { items },
            }}
            arrange={arrange}
        />
    );
};
