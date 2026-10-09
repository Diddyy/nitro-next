import { useState } from 'react';

import { addRoomFilterWord, closeRoomFilter, removeRoomFilterWord } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useNavigatorActions, useNavigatorStore } from '#base/context/navigator';
import { TemplateWindow, useTemplate, useTemplateFrame } from '#base/theme';

const TEMPLATE = 'habbo-navigator-com/iro_room_filter_framed_xml';
const ROW_TEMPLATE = 'habbo-navigator-com/ros_badword_xml';

/** `refreshBadWords`: every row that holds a word is this high. */
const ROW_HEIGHT = 20;

/** `RoomFilterCtrl.getBgColor`. */
const ROW_COLOR_SELECTED = 0x9ab8d9;
const ROW_COLOR_HOVERED = 0xb6d9ff;
const ROW_COLOR_ODD = 0xffffff;
const ROW_COLOR_EVEN = 0xe9e9e1;

/** The add field's text as the layout has it, and as `onAddWordClick` puts it back. */
const ADD_WORD_DEFAULT = 'bobba';

/**
 * The room's word filter - `RoomFilterCtrl` over `habbo-navigator-com/iro_room_filter_framed_xml`,
 * opened from the room info panel's filter button (`startRoomFilterEdit`), which asks for the words.
 *
 * Each word is a `ros_badword` row in `badwords_itemlist`, 20 high and striped by `getBgColor`; a
 * click on its `bg_region` selects it and the pointer over it lights it. The field starts at
 * `bobba`; Add sends whatever is in it that is not empty, asks for the list again and puts `bobba`
 * back. Remove takes the selected word out of the list at once and sends it, without asking for the
 * list. The server's answer only ever adds words (`onRoomFilterSettings`).
 *
 * The close button disposes the window and its words (`disposeWindow`); a room enter or exit only
 * hides it (`close`). Flash leaves the removed row in the list at no height and keeps its selection
 * on it, so a second Remove sends the same word again; here the row goes and nothing stays selected.
 */
export const NavigatorRoomFilterView = () => {
    const words = useNavigatorStore(x => x.roomFilterWords);
    const selectedIndex = useNavigatorStore(x => x.roomFilterSelectedIndex);
    const { setRoomFilterSelectedIndex } = useNavigatorActions();
    const { send } = useWebSocketContext();
    const row = useTemplate(ROW_TEMPLATE);
    const frame = useTemplateFrame({ id: 'navigator_room_filter', centered: true, onClose: closeRoomFilter });
    const [ word, setWord ] = useState(ADD_WORD_DEFAULT);
    const [ hoveredIndex, setHoveredIndex ] = useState(-1);

    const rowColor = (index: number) => {
        if (index === selectedIndex) return ROW_COLOR_SELECTED;
        if (index === hoveredIndex) return ROW_COLOR_HOVERED;

        return ((index % 2) !== 0) ? ROW_COLOR_ODD : ROW_COLOR_EVEN;
    };

    const onAdd = () => {
        addRoomFilterWord(send, word);
        setWord(ADD_WORD_DEFAULT);
    };

    return (
        <TemplateWindow
            id={TEMPLATE}
            frame={frame}
            bindings={{
                roomfilter_addword_txt: { caption: word, onChange: setWord },
                badword_add_btn: { onPointerTap: onAdd },
                badword_remove_btn: { onPointerTap: () => removeRoomFilterWord(send) },
                badwords_itemlist: {
                    items: row
                        ? words.map((filtered, index) => ({
                                key: filtered,
                                from: row,
                                bindings: {
                                    '': { color: rowColor(index), background: true },
                                    bg_region: {
                                        onPointerTap: () => setRoomFilterSelectedIndex(index),
                                        onPointerOver: () => setHoveredIndex(index),
                                        onPointerOut: () => setHoveredIndex(current => ((current === index) ? -1 : current)),
                                    },
                                    badword_txt: { caption: filtered },
                                },
                                arrange: ({ root }) => root()?.setHeight(ROW_HEIGHT),
                            }))
                        : [],
                },
            }}
        />
    );
};
