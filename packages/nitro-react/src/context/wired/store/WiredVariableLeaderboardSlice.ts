/**
 * The room's WIRED leaderboards - Flash `VariableLeaderboardController` with its
 * `VariableLeaderboardOverlayState` and `VariableLeaderboardPagingState` per leaderboard.
 *
 * The room is entered (`RoomEntryInfo`): the client asks for the room's leaderboards with the room
 * open subscription. Each leaderboard in the `VariableLeaderboardSnapshot` that answers it shows
 * one page of its selected variable; the page needs one or two chunks of 50 rows, which the client
 * subscribes to (`VariableLeaderboardReplaceSubscription`) and the server sends and keeps sending
 * as they change (`VariableLeaderboardChunkUpdate`). A chunk for another revision, variable or a
 * chunk not subscribed to is dropped.
 */
import { IVariableLeaderboardDescriptor, IVariableLeaderboardRow, VARIABLE_LEADERBOARD_CHUNK_SIZE, VARIABLE_LEADERBOARD_PAGE_SIZES } from '@nitrodevco/nitro-packets';
import { StateCreator } from 'zustand';

/** `VariableLeaderboardController.MAX_OVERLAYS`. */
export const VARIABLE_LEADERBOARD_MAX_OVERLAYS = 4;

/** `VariableLeaderboardPagingState.MAX_CLIENT_PAGE_SIZE`: the rows a view has. */
export const VARIABLE_LEADERBOARD_MAX_ROWS = 20;

/** One leaderboard as the client holds it (`VariableLeaderboardOverlayState`). */
export interface VariableLeaderboardOverlay {
    descriptor: IVariableLeaderboardDescriptor;
    /** The variable shown; null when the leaderboard offers none. */
    selectedVariableId: string | null;
    /** The page shown, from 0 (`clientPage`). */
    page: number;
    /** +1 after a move forward, -1 after a move back or a shrink, 0 otherwise: which neighbour chunk to prefetch. */
    direction: number;
    /** The number of entries, once a chunk told it. */
    totalCount: number | null;
    /** Rows by chunk index, for the chunks subscribed to that have arrived. */
    chunks: Record<number, IVariableLeaderboardRow[]>;
    subscribedChunks: number[];
    /** The variable the subscription was sent for, null before one was sent. */
    subscribedVariableId: string | null;
}

export interface WiredVariableLeaderboardSlice {
    /** The room the leaderboards belong to (`activeRoomId`), 0 outside a room. */
    leaderboardRoomId: number;
    /** Whether the room's snapshot arrived (`_-H2W`): chunks before it are dropped. */
    leaderboardSnapshotReceived: boolean;
    /** The leaderboards in the order the server first named them. */
    leaderboards: VariableLeaderboardOverlay[];
    setLeaderboardRoom: (roomId: number) => void;
    setLeaderboardSnapshot: (leaderboards: VariableLeaderboardOverlay[]) => void;
    setLeaderboard: (leaderboard: VariableLeaderboardOverlay) => void;
}

export const WiredVariableLeaderboardSliceInitialState = {
    leaderboardRoomId: 0,
    leaderboardSnapshotReceived: false,
    leaderboards: [] as VariableLeaderboardOverlay[],
};

export const createWiredVariableLeaderboardSlice: StateCreator<WiredVariableLeaderboardSlice> = set => ({
    ...WiredVariableLeaderboardSliceInitialState,
    setLeaderboardRoom: roomId => set({ ...WiredVariableLeaderboardSliceInitialState, leaderboardRoomId: roomId }),
    setLeaderboardSnapshot: leaderboards => set({ leaderboards, leaderboardSnapshotReceived: true }),
    setLeaderboard: leaderboard => set(state => ({ leaderboards: state.leaderboards.map(existing => (existing.descriptor.overlayInstanceId === leaderboard.descriptor.overlayInstanceId) ? leaderboard : existing) })),
});

/** `VariableLeaderboardDescriptorData.entriesPerPage`. */
export const leaderboardPageSize = (descriptor: IVariableLeaderboardDescriptor) => VARIABLE_LEADERBOARD_PAGE_SIZES[descriptor.pageSizeOption] ?? VARIABLE_LEADERBOARD_PAGE_SIZES[0];

/** `VariableLeaderboardPagingState.pageCount`. */
export const leaderboardPageCount = (overlay: VariableLeaderboardOverlay) => ((overlay.totalCount ?? 0) > 0) ? Math.ceil(overlay.totalCount! / leaderboardPageSize(overlay.descriptor)) : 1;

const firstRowIndex = (overlay: VariableLeaderboardOverlay) => overlay.page * leaderboardPageSize(overlay.descriptor);

const currentChunkIndex = (overlay: VariableLeaderboardOverlay) => Math.floor(firstRowIndex(overlay) / VARIABLE_LEADERBOARD_CHUNK_SIZE);

const lastChunkIndex = (overlay: VariableLeaderboardOverlay) => {
    const first = firstRowIndex(overlay);
    const end = Math.min(first + leaderboardPageSize(overlay.descriptor), overlay.totalCount ?? 0);

    return Math.floor(Math.max(first, end - 1) / VARIABLE_LEADERBOARD_CHUNK_SIZE);
};

/**
 * `VariableLeaderboardPagingState.desiredChunkIndices`: the chunk the page starts in, the one it
 * ends in when that differs, else the neighbour the page is moving towards when it is close (three
 * pages ahead, two behind), else a neighbour already subscribed to.
 */
export const desiredLeaderboardChunks = (overlay: VariableLeaderboardOverlay): number[] => {
    const current = currentChunkIndex(overlay);
    const last = lastChunkIndex(overlay);

    if (last !== current) return [ current, last ];
    if (overlay.totalCount === null) return [ current ];

    const pageSize = leaderboardPageSize(overlay.descriptor);
    const first = firstRowIndex(overlay);
    const chunkCount = (overlay.totalCount > 0) ? Math.ceil(overlay.totalCount / VARIABLE_LEADERBOARD_CHUNK_SIZE) : 1;
    let neighbour = -1;

    if ((overlay.direction > 0) && ((first + (3 * pageSize)) > ((current + 1) * VARIABLE_LEADERBOARD_CHUNK_SIZE)) && (current < (chunkCount - 1))) neighbour = current + 1;
    else if ((overlay.direction < 0) && ((first - (2 * pageSize)) < (current * VARIABLE_LEADERBOARD_CHUNK_SIZE)) && (current > 0)) neighbour = current - 1;

    if (neighbour < 0) neighbour = overlay.subscribedChunks.find(index => (index !== current) && (Math.abs(index - current) === 1) && (index < chunkCount)) ?? -1;

    return (neighbour < 0) ? [ current ] : [ current, neighbour ].sort((a, b) => a - b);
};

/** The rows the page shows, null while a chunk it needs has not arrived (`getBodyState` loading). */
export const leaderboardPageRows = (overlay: VariableLeaderboardOverlay): IVariableLeaderboardRow[] | null => {
    if (!overlay.selectedVariableId || (overlay.totalCount === 0)) return [];

    for (let index = currentChunkIndex(overlay); index <= lastChunkIndex(overlay); index++) {
        if (!overlay.chunks[index]) return null;
    }

    const first = firstRowIndex(overlay);
    const rows: IVariableLeaderboardRow[] = [];

    for (let i = 0; (i < leaderboardPageSize(overlay.descriptor)) && ((first + i) < (overlay.totalCount ?? 0)); i++) {
        const row = overlay.chunks[Math.floor((first + i) / VARIABLE_LEADERBOARD_CHUNK_SIZE)]?.[(first + i) % VARIABLE_LEADERBOARD_CHUNK_SIZE];

        if (row) rows.push(row);
    }

    return rows;
};
