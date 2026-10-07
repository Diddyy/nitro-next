/**
 * The toolbar's word filter window - `toolbar/extensions/settings/WordFilterSettingsView`, drawn from
 * its `custom_word_filter_settings` template (layout name `memenu_chat_settings`, 242 x 248): the
 * words this account filters out of what it is shown, with a field and an Add button over the list
 * and a Remove button under it. Opened from the settings list under the purse - which only offers it
 * while `user.custom.filter.enabled`.
 *
 * The list is the server's. The window asks for it as it opens (`prepareWindow` sends
 * `GetCustomFilterMessageComposer`) and every add and remove waits for
 * `ModifyCustomFilterResultMessageEvent` before the list changes, so a word the server refuses
 * never appears. Each word is a `custom_word_filter_item` window in `wordlist` (`getListEntry`),
 * 20 high (`refreshBadWords`), coloured by `getBgColor`; a click on its `bg_region` selects it and
 * the Remove button acts on that row (`§_-TR§`).
 */
import { useEffect, useState } from 'react';

import { addToCustomFilter, removeFromCustomFilter, requestCustomFilter } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useUserStore, useUserWordFilterActions } from '#base/context/user';
import { useTemplate } from '#base/theme';

import { ToolbarSettingsWindow } from './ToolbarSettingsWindow';

/** `refreshBadWords` gives every visible row this height, not the 18 its layout declares. */
const ROW_HEIGHT = 20;

/** `WordFilterSettingsView.getBgColor`. */
const ROW_COLOR_SELECTED = 0x9ab8d9;
const ROW_COLOR_HOVERED = 0xb6d9ff;
const ROW_COLOR_ODD = 0xffffff;
const ROW_COLOR_EVEN = 0xe9e9e1;

export const ToolbarWordFilterView = ({ onClose }: { onClose: () => void }) => {
    const { send } = useWebSocketContext();
    const filteredWords = useUserStore(x => x.filteredWords);
    const selectedWordIndex = useUserStore(x => x.selectedWordIndex);
    const { setSelectedWordIndex } = useUserWordFilterActions();
    const [ word, setWord ] = useState('');
    const [ hoveredIndex, setHoveredIndex ] = useState(-1);
    const item = useTemplate('habbo-toolbar-com/custom_word_filter_item_xml');

    // `prepareWindow`: the window asks for the list as it opens.
    useEffect(() => requestCustomFilter(send), [ send ]);

    /** `onAddWordClick`: the field is cleared only where the word was actually sent. */
    const onAdd = () => {
        if (addToCustomFilter(send, word)) setWord('');
    };

    // `getBgColor`: the selection wins over the hover, and the hover over the row's own stripe.
    const rowColor = (index: number) => {
        if (index === selectedWordIndex) return ROW_COLOR_SELECTED;
        if (index === hoveredIndex) return ROW_COLOR_HOVERED;

        return ((index % 2) !== 0) ? ROW_COLOR_ODD : ROW_COLOR_EVEN;
    };

    return (
        <ToolbarSettingsWindow
            windowId="toolbar_word_filter"
            templateId="habbo-toolbar-com/custom_word_filter_settings_xml"
            bindings={{
                add_word_input: { caption: word, onChange: setWord, onEnter: onAdd },
                add_btn: { onPointerTap: onAdd },
                remove_btn: { onPointerTap: () => removeFromCustomFilter(send) },
                back_btn: { onPointerTap: onClose },
                wordlist: {
                    items: item
                        ? filteredWords.map((filtered, index) => ({
                                key: filtered,
                                from: item,
                                bindings: {
                                    '': { color: rowColor(index), background: true },
                                    bg_region: {
                                        onPointerTap: () => setSelectedWordIndex(index),
                                        onPointerOver: () => setHoveredIndex(index),
                                        onPointerOut: () => setHoveredIndex(current => ((current === index) ? -1 : current)),
                                    },
                                    text: { caption: filtered },
                                },
                                arrange: ({ root }) => root()?.setHeight(ROW_HEIGHT),
                            }))
                        : [],
                },
            }}
        />
    );
};
