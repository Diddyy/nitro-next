/**
 * The room's word filter - `RoomFilterCtrl` over `habbo-navigator-com/iro_room_filter_framed_xml`
 * (`center()`ed when built), its list rows `ros_badword_xml` clones (`getListEntry`).
 *
 * Each row is coloured by `getBgColor`: the selected row `0xff9ab8d9`, odd rows white, even rows
 * `0xffe9e9e1`, and `0xffb6d9ff` while the pointer is over it (`onBgMouseOver`; `onBgMouseOut` puts
 * its own colour back). A click selects the row (`onBgMouseClick`). The add button sends the field's
 * word, the remove button the selected row's; the frame's close disposes the window.
 */
import { useState } from 'react';

import { addRoomFilterWord, disposeRoomFilter, removeRoomFilterWord } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { roomFilterStore, useRoomFilterStore } from '#base/context/room-filter';
import { TemplateBindings, TemplateWindow, useTemplate, useTemplateFrame } from '#base/theme';

const TEMPLATE = 'habbo-navigator-com/iro_room_filter_framed_xml';
const ROW_TEMPLATE = 'habbo-navigator-com/ros_badword_xml';

/** `getBgColor`. */
const ROW_COLOR_SELECTED = 0xff9ab8d9;
const ROW_COLOR_HOVER = 0xffb6d9ff;
const ROW_COLOR_ODD = 0xffffffff;
const ROW_COLOR_EVEN = 0xffe9e9e1;

/** `refreshBadWords`: a shown row is 20 high. */
const ROW_HEIGHT = 20;

const rowColor = (index: number, selectedRow: number) => ((index === selectedRow) ? ROW_COLOR_SELECTED : (((index % 2) !== 0) ? ROW_COLOR_ODD : ROW_COLOR_EVEN));

export const RoomFilterView = () => {
    const rows = useRoomFilterStore(x => x.rows);
    const selectedRow = useRoomFilterStore(x => x.selectedRow);
    const inputText = useRoomFilterStore(x => x.inputText);
    const rowTemplate = useTemplate(ROW_TEMPLATE);
    const { send } = useWebSocketContext();
    const [ hoveredRow, setHoveredRow ] = useState(-1);
    const frame = useTemplateFrame({ id: 'room_filter', centered: true, rememberPosition: false, resizeDirection: 'none', onClose: disposeRoomFilter });
    const set = roomFilterStore.getState().setRoomFilter;

    const bindings: TemplateBindings = {
        roomfilter_addword_txt: { caption: inputText, onChange: text => set({ inputText: text }) },
        badword_add_btn: { onPointerTap: () => addRoomFilterWord(send) },
        badword_remove_btn: { onPointerTap: () => removeRoomFilterWord(send) },
        badwords_itemlist: {
            items: rowTemplate
                ? rows.map((row, index) => ({
                        key: String(index),
                        from: rowTemplate,
                        arrange: ({ root }) => root()?.setHeight(row.visible ? ROW_HEIGHT : 0),
                        bindings: {
                            '': { visible: row.visible, color: (hoveredRow === index) ? ROW_COLOR_HOVER : rowColor(index, selectedRow) },
                            bg_region: {
                                onPointerTap: () => {
                                    // `refreshColorsAfterClick` recolours the row under the pointer too.
                                    set({ selectedRow: index });
                                    setHoveredRow(-1);
                                },
                                onPointerOver: () => setHoveredRow(index),
                                onPointerOut: () => setHoveredRow(current => ((current === index) ? -1 : current)),
                            },
                            badword_txt: { caption: row.word },
                        },
                    }))
                : [],
        },
    };

    return (
        <TemplateWindow
            id={TEMPLATE}
            frame={frame}
            bindings={bindings}
        />
    );
};
