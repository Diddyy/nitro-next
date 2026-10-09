/**
 * `RoomFilterCtrl` - the room's own word filter, which Room info's "Room Filter" button opens for the
 * room the user is in (`startRoomFilterEdit`). Opening asks for the words
 * (`GetCustomRoomFilterMessageComposer`) and shows the window at once; the answer
 * (`RoomFilterSettingsMessage`) adds the words it does not have yet. Adding a word sends it
 * (`UpdateRoomFilterMessageComposer(flatId, true, word)`), asks for the list again and puts
 * `bobba` back in the field; removing the selected row's word sends it with `false` and hides the row.
 * Entering a room hides the window (`close`); its close button disposes it, and its words with it.
 */
import { GetCustomRoomFilterComposer, UpdateRoomFilterComposer } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { navigatorStore } from '#base/context/navigator';
import { ROOM_FILTER_INITIAL, ROOM_FILTER_INPUT_TEXT, RoomFilterRow, roomFilterStore } from '#base/context/room-filter';

type Send = WebSocketConnection['send'];

/** `UpdateRoomFilterMessageComposer`'s add and remove flags. */
const ADD_WORD = true;
const REMOVE_WORD = false;

const filter = () => roomFilterStore.getState();

/** `refreshBadWords`: row `i` shows word `i`; a row without one is hidden. */
const refreshedRows = (rows: RoomFilterRow[], badWords: string[]): RoomFilterRow[] => {
    const next: RoomFilterRow[] = [];

    for (let i = 0; (i < rows.length) || (i < badWords.length); i++) {
        next.push((badWords[i] !== undefined) ? { word: badWords[i], visible: true } : { word: rows[i].word, visible: false });
    }

    return next;
};

/** `startRoomFilterEdit` -> `refreshWindow` -> `prepareWindow`. */
export const startRoomFilterEdit = (send: Send, flatId: number) => {
    filter().setRoomFilter({ flatId });
    send(new GetCustomRoomFilterComposer({ roomId: flatId }));

    if (!navigatorStore.getState().enteredRoom) return;

    // A window built afresh lists the words it has.
    const { open, rows, badWords } = filter();

    filter().setRoomFilter({ open: true, rows: open ? rows : refreshedRows([], badWords) });
};

/** `onRoomFilterSettings`: each word not yet held is added, and an open window lists them again. */
export const onRoomFilterSettings = (words: string[]) => {
    const { badWords, open, rows } = filter();
    const next = [ ...badWords ];

    for (const word of words) {
        if (!next.includes(word)) next.push(word);
    }

    filter().setRoomFilter({ badWords: next, rows: open ? refreshedRows(rows, next) : rows });
};

/** `onAddWordClick` -> `addBadWord`. */
export const addRoomFilterWord = (send: Send) => {
    const { flatId, inputText } = filter();

    if (!inputText.length) return;

    send(new UpdateRoomFilterComposer({ roomId: flatId, isAddingWord: ADD_WORD, word: inputText }));
    send(new GetCustomRoomFilterComposer({ roomId: flatId }));
    filter().setRoomFilter({ inputText: ROOM_FILTER_INPUT_TEXT });
};

/** `onRemoveWordClick`: the selected row's word, hidden and sent. */
export const removeRoomFilterWord = (send: Send) => {
    const { flatId, selectedRow, rows, badWords } = filter();
    const row = rows[selectedRow];

    if ((selectedRow < 0) || !row) return;

    filter().setRoomFilter({
        rows: rows.map((current, index) => ((index === selectedRow) ? { ...current, visible: false } : current)),
        badWords: badWords.filter(word => word !== row.word),
    });
    send(new UpdateRoomFilterComposer({ roomId: flatId, isAddingWord: REMOVE_WORD, word: row.word }));
};

/** `close`: entering a room hides the window and keeps its words. */
export const closeRoomFilter = () => filter().setRoomFilter({ flatId: 0, open: false });

/** `disposeWindow`: the close button - the window and its words go (`_flatId` and `_selectedRow` stay). */
export const disposeRoomFilter = () => filter().setRoomFilter({ ...ROOM_FILTER_INITIAL, flatId: filter().flatId, selectedRow: filter().selectedRow });
