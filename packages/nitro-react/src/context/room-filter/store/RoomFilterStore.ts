/**
 * The room's word filter window - the state of Flash's `navigator/roomsettings/RoomFilterCtrl`.
 *
 * - `flatId` (`_flatId`): the room being edited, 0 once closed.
 * - `badWords` (`_badWords`): the words the server sent, each kept once. `onRoomFilterSettings` only
 *   adds; a removed word leaves at once (`onRemoveWordClick`). Kept while the window is only hidden
 *   (`close`), dropped when it is disposed (its close button).
 * - `rows`: the list's rows, `refreshBadWords`' items - the row `i` shows `badWords[i]`, and a row
 *   with no word, or the one whose word was removed, is hidden (height 0) until the next refresh.
 * - `selectedRow` (`_selectedRow`): the row last clicked, -1 for none.
 * - `inputText`: `roomfilter_addword_txt`.
 */
import { createStore } from 'zustand';

export interface RoomFilterRow {
    word: string;
    visible: boolean;
}

/** The layout's caption for `roomfilter_addword_txt`, which `addBadWord` also puts back. */
export const ROOM_FILTER_INPUT_TEXT = 'bobba';

type State = {
    open: boolean;
    flatId: number;
    badWords: string[];
    rows: RoomFilterRow[];
    selectedRow: number;
    inputText: string;
};

type Actions = {
    setRoomFilter: (changes: Partial<State>) => void;
};

export type RoomFilterStore = State & Actions;

export const ROOM_FILTER_INITIAL: State = {
    open: false,
    flatId: 0,
    badWords: [],
    rows: [],
    selectedRow: -1,
    inputText: ROOM_FILTER_INPUT_TEXT,
};

export const createRoomFilterStore = () => createStore<RoomFilterStore>()(set => ({
    ...ROOM_FILTER_INITIAL,
    setRoomFilter: changes => set(changes),
}));

export const roomFilterStore = createRoomFilterStore();
