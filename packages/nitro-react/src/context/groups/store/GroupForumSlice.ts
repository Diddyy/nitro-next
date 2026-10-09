import { StateCreator } from 'zustand';

/**
 * What the client knows of the group forums without their window - Flash's `GroupForumController`,
 * whose `unreadForumsCount` the toolbar shows on the me menu's forums item and adds to the me menu
 * icon's count (`HabboToolbar.onUnseenForumsCountUpdate`). The forums window itself is not ported.
 */
type State = {
    /** `GroupForumController.unreadForumsCount`. */
    unreadForumsCount: number;
};

type Actions = {
    /** `updateUnreadForumsCount`. */
    setUnreadForumsCount: (count: number) => void;
};

export const GroupForumSliceInitialState: State = {
    unreadForumsCount: 0,
};

export type GroupForumSlice = State & Actions;

export const createGroupForumSlice: StateCreator<GroupForumSlice, [], [], GroupForumSlice> = set => ({
    ...GroupForumSliceInitialState,
    setUnreadForumsCount: unreadForumsCount => set({ unreadForumsCount }),
});
