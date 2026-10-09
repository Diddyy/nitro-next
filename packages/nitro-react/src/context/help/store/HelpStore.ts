/**
 * The help store - what Flash's `HabboHelp` keeps for the call-for-help flow:
 *
 * - `chatItems` (`ChatRegistry`): every chat line of another user heard in a room, fed by
 *   `ChatEventHandler.onRoomChat`. `addChatItem` purges (`purgeRegistry`) unless `holdPurges` is on:
 *   lines older than 16 x 65.5 s go (`int(age / 65500) <= 15` stay), and past 120 lines only the
 *   last 100 stay. `selected` is the line's checkbox in the report flow.
 * - `users` (`UserRegistry`): the users seen in rooms (`HabboHelp.onUsers`), newest last, at most
 *   80 (`purgeUserIndex` drops the oldest); each with the room it was seen in. A user seen before
 *   the room's name is known gets it when `registerRoom` brings one (`addRoomNameForMissing`).
 * - `callForHelpCategories` (`onCfhTopics`): the report reasons and their topics.
 * - `reportedUserId` / `reportedRoomId` (`CallForHelpManager`'s): who and where is being reported.
 */
import type { ICallForHelpCategory } from '@nitrodevco/nitro-packets';
import { createStore } from 'zustand';

/** `ChatRegistry.MAX_ITEMS_TO_STORE` / `ITEMS_TO_PURGE`. */
const MAX_CHAT_ITEMS = 120;
const CHAT_ITEMS_TO_PURGE = 20;
/** `purgeRegistry`: a line stays while `int(age / 65500) <= 15`. */
const CHAT_AGE_UNIT_MS = 65500;
const CHAT_MAX_AGE_UNITS = 15;
/** `UserRegistry.MAX_USERS_TO_STORE`. */
const MAX_USERS = 80;

/** `ChatRegistryItem`. */
export interface HelpChatItem {
    index: number;
    roomId: number;
    roomName: string;
    userId: number;
    userName: string;
    text: string;
    selected: boolean;
    chatTime: number;
}

/** `UserRegistryItem`. */
export interface HelpUserItem {
    userId: number;
    userName: string;
    figure: string;
    roomId: number;
    roomName: string;
}

type State = {
    chatItems: HelpChatItem[];
    /** `_-s13`: the next line's index. */
    nextChatIndex: number;
    holdPurges: boolean;
    users: HelpUserItem[];
    /** `UserRegistry.roomId` / `roomName`: the room the next users are seen in. */
    userRoomId: number;
    userRoomName: string;
    /** `_-22V`: users registered while the room had no name yet. */
    usersMissingRoomName: number[];
    callForHelpCategories: ICallForHelpCategory[];
    reportedUserId: number;
    reportedRoomId: number;
};

type Actions = {
    /** `ChatRegistry.addItem`. */
    addChatItem: (roomId: number, roomName: string, userId: number, userName: string, text: string) => void;
    setChatItemSelected: (index: number, selected: boolean) => void;
    setHoldPurges: (holdPurges: boolean) => void;
    /** `TopicsFlowHelpController.deselectChatEntries`. */
    deselectChatItems: () => void;
    /** `UserRegistry.registerRoom`. */
    registerRoom: (roomId: number, roomName: string) => void;
    /** `UserRegistry.registerUser`. */
    registerUser: (userId: number, userName: string, figure: string) => void;
    setCallForHelpCategories: (categories: ICallForHelpCategory[]) => void;
    setReportedUserId: (reportedUserId: number) => void;
    setReportedRoomId: (reportedRoomId: number) => void;
};

export type HelpStore = State & Actions;

const INITIAL: State = {
    chatItems: [],
    nextChatIndex: 0,
    holdPurges: false,
    users: [],
    userRoomId: 0,
    userRoomName: '',
    usersMissingRoomName: [],
    callForHelpCategories: [],
    reportedUserId: -1,
    reportedRoomId: -1,
};

/** `ChatRegistry.purgeRegistry`. */
const purgeChatItems = (items: HelpChatItem[], now: number): HelpChatItem[] => {
    const kept = items.filter(item => Math.trunc((now - item.chatTime) / CHAT_AGE_UNIT_MS) <= CHAT_MAX_AGE_UNITS);

    return (kept.length > MAX_CHAT_ITEMS) ? kept.slice(kept.length - (MAX_CHAT_ITEMS - CHAT_ITEMS_TO_PURGE)) : kept;
};

export const createHelpStore = () => createStore<HelpStore>()(set => ({
    ...INITIAL,
    addChatItem: (roomId, roomName, userId, userName, text) => set((x) => {
        const now = Date.now();
        const chatItems = [ ...x.chatItems, { index: x.nextChatIndex, roomId, roomName, userId, userName, text, selected: false, chatTime: now } ];

        return { chatItems: x.holdPurges ? chatItems : purgeChatItems(chatItems, now), nextChatIndex: x.nextChatIndex + 1 };
    }),
    setChatItemSelected: (index, selected) => set(x => ({ chatItems: x.chatItems.map(item => ((item.index === index) ? { ...item, selected } : item)) })),
    setHoldPurges: holdPurges => set({ holdPurges }),
    deselectChatItems: () => set(x => ({ chatItems: x.chatItems.map(item => (item.selected ? { ...item, selected: false } : item)) })),
    registerRoom: (roomId, roomName) => set((x) => {
        if (roomName === '') return { userRoomId: roomId, userRoomName: roomName };

        const missing = new Set(x.usersMissingRoomName);
        const users = x.users.map(user => ((missing.has(user.userId) && (user.roomId === roomId)) ? { ...user, roomName } : user));

        return { userRoomId: roomId, userRoomName: roomName, users, usersMissingRoomName: [] };
    }),
    registerUser: (userId, userName, figure) => set((x) => {
        const users = [ ...x.users.filter(user => user.userId !== userId), { userId, userName, figure, roomId: x.userRoomId, roomName: x.userRoomName } ];

        return {
            users: users.slice(Math.max(0, users.length - MAX_USERS)),
            usersMissingRoomName: (x.userRoomName === '') ? [ ...x.usersMissingRoomName, userId ] : x.usersMissingRoomName,
        };
    }),
    setCallForHelpCategories: callForHelpCategories => set({ callForHelpCategories }),
    setReportedUserId: reportedUserId => set({ reportedUserId }),
    setReportedRoomId: reportedRoomId => set({ reportedRoomId }),
}));

export const helpStore = createHelpStore();
