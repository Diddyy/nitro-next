/**
 * The moderation store - what Flash's `ModerationManager` keeps for its tool:
 *
 * - `init` (`ModerationManager.initMsg`): the `ModeratorInit` the server sends a moderator; the
 *   start panel shows once it arrives (`ModerationMessageHandler.onModeratorInit`).
 * - `selectedUser` (`StartPanelCtrl.userSelected`): the last user clicked in the room, which the
 *   start panel's user info button opens.
 * - `currentRoomId` (`ModerationManager.currentFlatId`): the guest room entered, 0 out of one;
 *   the room tool and chatlog buttons follow it (`StartPanelCtrl.guestRoomEntered` / `roomExited`).
 * - `windows` (`WindowTracker`): the tool windows up, each once per kind and id (`ITrackedWindow`'s
 *   `getType` / `getId`), the newest last.
 * - `userInfos`, `roomInfos`, `chatlogs`: the answers their windows wait for.
 */
import type { IModeratorRoomInfoData, IModeratorUserInfoData, IRoomChatlogData, ModeratorInitMessageType } from '@nitrodevco/nitro-packets';
import { createStore } from 'zustand';

/** `ChatlogCtrl`'s types: 4 a room's chatlog, 5 a user's (`ModerationMessageHandler.onRoomChatlog` / `onUserChatlog`). */
export const MOD_CHATLOG_ROOM = 4;
export const MOD_CHATLOG_USER = 5;

export type ModerationWindow
    = | { kind: 'userInfo'; userId: number }
        | { kind: 'roomTool'; roomId: number }
        | { kind: 'chatlog'; type: number; id: number }
        | { kind: 'sendMessage'; userId: number; userName: string };

export interface ModerationChatlog {
    caption: string;
    records: IRoomChatlogData[];
}

export interface ModerationStore {
    init: ModeratorInitMessageType | undefined;
    selectedUser: { userId: number; userName: string } | undefined;
    currentRoomId: number;
    windows: ModerationWindow[];
    userInfos: Record<number, IModeratorUserInfoData>;
    roomInfos: Record<number, IModeratorRoomInfoData>;
    chatlogs: Record<string, ModerationChatlog>;
    setInit: (init: ModeratorInitMessageType) => void;
    userSelected: (userId: number, userName: string) => void;
    setCurrentRoomId: (roomId: number) => void;
    /** `WindowTracker.show`: a window already up for the same kind and id is closed first. */
    showWindow: (window: ModerationWindow) => void;
    closeWindow: (window: ModerationWindow) => void;
    setUserInfo: (info: IModeratorUserInfoData) => void;
    setRoomInfo: (info: IModeratorRoomInfoData) => void;
    setChatlog: (type: number, id: number, chatlog: ModerationChatlog) => void;
}

export const moderationWindowKey = (window: ModerationWindow) => {
    switch (window.kind) {
        case 'userInfo': return `userInfo:${window.userId}`;
        case 'roomTool': return `roomTool:${window.roomId}`;
        case 'chatlog': return `chatlog:${window.type}:${window.id}`;
        case 'sendMessage': return `sendMessage:${window.userId}`;
    }
};

export const moderationChatlogKey = (type: number, id: number) => `${type}:${id}`;

export const createModerationStore = () => createStore<ModerationStore>(set => ({
    init: undefined,
    selectedUser: undefined,
    currentRoomId: 0,
    windows: [],
    userInfos: {},
    roomInfos: {},
    chatlogs: {},
    setInit: init => set({ init }),
    userSelected: (userId, userName) => set({ selectedUser: { userId, userName } }),
    setCurrentRoomId: currentRoomId => set({ currentRoomId }),
    showWindow: window => set((state) => {
        const key = moderationWindowKey(window);

        return { windows: [ ...state.windows.filter(x => moderationWindowKey(x) !== key), window ] };
    }),
    closeWindow: window => set((state) => {
        const key = moderationWindowKey(window);

        return { windows: state.windows.filter(x => moderationWindowKey(x) !== key) };
    }),
    setUserInfo: info => set(state => ({ userInfos: { ...state.userInfos, [info.userId]: info } })),
    setRoomInfo: info => set(state => ({ roomInfos: { ...state.roomInfos, [info.flatId]: info } })),
    setChatlog: (type, id, chatlog) => set(state => ({ chatlogs: { ...state.chatlogs, [moderationChatlogKey(type, id)]: chatlog } })),
}));

export const moderationStore = createModerationStore();
