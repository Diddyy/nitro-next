/**
 * Flash `VariableLeaderboardController`: asks for the room's leaderboards when the room is entered,
 * applies the snapshot that answers, subscribes each leaderboard to the chunks its page needs and
 * takes in the chunks the server sends for them.
 */
import { CloseConnectionMessage, IVariableLeaderboardDescriptor, RoomEntryInfoMessage, VARIABLE_LEADERBOARD_PAGE_SIZES, VariableLeaderboardChunkUpdateMessage, VariableLeaderboardReplaceSubscriptionComposer, VariableLeaderboardSnapshotMessage } from '@nitrodevco/nitro-packets';

import { WebSocketConnection } from '#base/context/communication';
import { desiredLeaderboardChunks, leaderboardPageCount, leaderboardPageSize, VARIABLE_LEADERBOARD_MAX_OVERLAYS, VariableLeaderboardOverlay, wiredStore } from '#base/context/wired';

import { on, subscribeAll } from '../packetSubscriptions';

/** `VariableLeaderboardController.NULL_VARIABLE_ID`. */
const NULL_VARIABLE_ID = '0';

/** `VariableLeaderboardController.isDescriptorStructurallyValid`. */
const isStructurallyValid = (descriptor: IVariableLeaderboardDescriptor) => {
    const { columns, choices, defaultVariableId, pageSizeOption } = descriptor;

    if ((columns.length < 1) || (columns.length > 4) || (columns[0].type !== 0) || (choices.length > 10) || (pageSizeOption < 0) || (pageSizeOption > 2)) return false;
    if (columns.some(column => (column.width < 0) || (column.width > 3))) return false;

    const ids = new Set<string>();

    for (const choice of choices) {
        if (!choice.variableId || ids.has(choice.variableId)) return false;

        ids.add(choice.variableId);
    }

    return (choices.length === 0) ? (defaultVariableId === NULL_VARIABLE_ID) : ids.has(defaultVariableId);
};

/** `VariableLeaderboardController.resolveSelection`: the variable still offered, else the default. */
const resolveSelection = (descriptor: IVariableLeaderboardDescriptor, selected: string | null) => {
    if (!descriptor.choices.length) return null;

    return descriptor.choices.some(choice => choice.variableId === selected) ? selected : descriptor.defaultVariableId;
};

/** `VariableLeaderboardOverlayState.resetQueryScope`. */
const resetQueryScope = (overlay: VariableLeaderboardOverlay, selectedVariableId: string | null): VariableLeaderboardOverlay => ({ ...overlay, selectedVariableId, page: 0, direction: 0, totalCount: null, chunks: {}, subscribedChunks: [], subscribedVariableId: null });

/** The connection the handlers were registered on: the paging below sends through it. */
let sendComposer: WebSocketConnection['send'] | null = null;

/**
 * `reconcileSubscription`: sends the chunks the page needs when they differ from the ones
 * subscribed to, and keeps the chunks still wanted.
 */
const reconcile = (overlay: VariableLeaderboardOverlay): VariableLeaderboardOverlay => {
    const { leaderboardRoomId, leaderboardSnapshotReceived } = wiredStore.getState();

    if (!leaderboardRoomId || !leaderboardSnapshotReceived || !overlay.selectedVariableId) return overlay;

    const wanted = desiredLeaderboardChunks(overlay);

    if ((overlay.subscribedVariableId === overlay.selectedVariableId) && (wanted.join() === overlay.subscribedChunks.join())) return overlay;

    const chunks: Record<number, VariableLeaderboardOverlay['chunks'][number]> = {};

    for (const index of wanted) if (overlay.chunks[index]) chunks[index] = overlay.chunks[index];

    sendComposer?.(new VariableLeaderboardReplaceSubscriptionComposer({ overlayInstanceId: overlay.descriptor.overlayInstanceId, queryRevision: overlay.descriptor.queryRevision, selectedVariableId: overlay.selectedVariableId, chunkIndices: wanted }));

    return { ...overlay, chunks, subscribedChunks: wanted, subscribedVariableId: overlay.selectedVariableId };
};

/**
 * `refreshView`'s page size: the edited leaderboard pages by the size its editor describes, the rest
 * by their descriptor's. A size that changed starts the leaderboard over at its first page
 * (`VariableLeaderboardPagingState.entriesPerPage`) and subscribes to the chunks that page needs.
 */
const syncEntriesPerPage = () => {
    const { leaderboards, leaderboardLocationEdit, leaderboardLocationEditId, setLeaderboardSnapshot } = wiredStore.getState();
    let changed = false;

    const next = leaderboards.map((overlay) => {
        const edited = !!leaderboardLocationEdit && (leaderboardLocationEditId === overlay.descriptor.overlayInstanceId);
        const entriesPerPage = edited ? (VARIABLE_LEADERBOARD_PAGE_SIZES[leaderboardLocationEdit.draft.pageSizeOption] ?? VARIABLE_LEADERBOARD_PAGE_SIZES[0]) : leaderboardPageSize(overlay.descriptor);

        if (entriesPerPage === overlay.entriesPerPage) return overlay;

        changed = true;

        return reconcile({ ...overlay, entriesPerPage, page: 0, direction: 0 });
    });

    if (changed) setLeaderboardSnapshot(next);
};

export const registerWiredVariableLeaderboardHandlers = ({ send, subscribe }: WebSocketConnection) => {
    sendComposer = send;

    const unsubscribeStore = wiredStore.subscribe((state, previous) => {
        if ((state.leaderboardLocationEdit !== previous.leaderboardLocationEdit) || (state.leaderboards !== previous.leaderboards)) syncEntriesPerPage();
    });

    const unsubscribePackets = subscribeAll(subscribe, [
        // `onRoomEntryInfo`: a new room forgets the last one's leaderboards and asks for its own.
        on(RoomEntryInfoMessage, (data) => {
            const roomId = data.roomId;

            if (!roomId || (wiredStore.getState().leaderboardRoomId === roomId)) return;

            wiredStore.getState().setLeaderboardRoom(roomId);
            send(new VariableLeaderboardReplaceSubscriptionComposer({ overlayInstanceId: 0, queryRevision: 0, selectedVariableId: NULL_VARIABLE_ID, chunkIndices: [] }));
        }),

        // `onRoomConnectionClosed`.
        on(CloseConnectionMessage, () => wiredStore.getState().setLeaderboardRoom(0)),

        // `onSnapshot` + `applyDescriptor` / `applyRemoval`.
        on(VariableLeaderboardSnapshotMessage, (data) => {
            const { leaderboardRoomId, leaderboards, setLeaderboardSnapshot } = wiredStore.getState();

            if (!leaderboardRoomId || !data.valid) return;

            const named = new Set(data.descriptors.map(descriptor => descriptor.overlayInstanceId));
            const next = leaderboards.filter(overlay => named.has(overlay.descriptor.overlayInstanceId));
            const changed = new Set<number>();

            for (const descriptor of data.descriptors) {
                if (!isStructurallyValid(descriptor)) continue;

                const index = next.findIndex(overlay => overlay.descriptor.overlayInstanceId === descriptor.overlayInstanceId);

                if (index < 0) {
                    if (next.length >= VARIABLE_LEADERBOARD_MAX_OVERLAYS) continue;

                    next.push(resetQueryScope({ descriptor, selectedVariableId: null, entriesPerPage: leaderboardPageSize(descriptor), page: 0, direction: 0, totalCount: null, chunks: {}, subscribedChunks: [], subscribedVariableId: null }, resolveSelection(descriptor, null)));
                    changed.add(descriptor.overlayInstanceId);

                    continue;
                }

                const known = next[index];

                if (descriptor.queryRevision < known.descriptor.queryRevision) continue;

                const selection = resolveSelection(descriptor, known.selectedVariableId);

                next[index] = ((descriptor.queryRevision !== known.descriptor.queryRevision) || (selection !== known.selectedVariableId)) ? resetQueryScope({ ...known, descriptor }, selection) : { ...known, descriptor };

                if (next[index] !== known) changed.add(descriptor.overlayInstanceId);
            }

            setLeaderboardSnapshot(next);
            setLeaderboardSnapshot(wiredStore.getState().leaderboards.map(overlay => changed.has(overlay.descriptor.overlayInstanceId) ? reconcile(overlay) : overlay));
        }),

        // `onChunkUpdate`.
        on(VariableLeaderboardChunkUpdateMessage, (data) => {
            const { leaderboardRoomId, leaderboardSnapshotReceived, leaderboards, setLeaderboard } = wiredStore.getState();

            if (!leaderboardRoomId || !leaderboardSnapshotReceived || !data.valid) return;

            const overlay = leaderboards.find(existing => existing.descriptor.overlayInstanceId === data.overlayInstanceId);

            if (!overlay || (data.queryRevision !== overlay.descriptor.queryRevision) || (data.selectedVariableId !== overlay.selectedVariableId) || !overlay.subscribedChunks.includes(data.chunkIndex)) return;

            const updated = { ...overlay, chunks: { ...overlay.chunks, [data.chunkIndex]: data.rows }, totalCount: Math.max(0, data.totalCount) };
            const lastPage = leaderboardPageCount(updated) - 1;

            // `applyExactTotal`: a total that shrank below the page moves the page back.
            setLeaderboard(reconcile((updated.page > lastPage) ? { ...updated, page: lastPage, direction: -1 } : updated));
        }),
    ]);

    return () => {
        unsubscribeStore();
        unsubscribePackets();
    };
};

/** `selectVariable`: another of the leaderboard's variables, from the first page. */
export const selectLeaderboardVariable = (overlayInstanceId: number, variableId: string) => {
    const overlay = wiredStore.getState().leaderboards.find(existing => existing.descriptor.overlayInstanceId === overlayInstanceId);

    if (!overlay || (variableId === overlay.selectedVariableId) || !overlay.descriptor.choices.some(choice => choice.variableId === variableId)) return;

    wiredStore.getState().setLeaderboard(reconcile(resetQueryScope(overlay, variableId)));
};

/** `showPreviousPage` / `showNextPage` (`movePage`). */
export const moveLeaderboardPage = (overlayInstanceId: number, delta: number) => {
    const overlay = wiredStore.getState().leaderboards.find(existing => existing.descriptor.overlayInstanceId === overlayInstanceId);

    if (!overlay || (overlay.totalCount === null)) return;

    const page = overlay.page + delta;

    if ((page < 0) || (page >= leaderboardPageCount(overlay)) || (page === overlay.page)) return;

    wiredStore.getState().setLeaderboard(reconcile({ ...overlay, page, direction: (page > overlay.page) ? 1 : -1 }));
};
