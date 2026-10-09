import { IEventCategory, IFlatCategory, IRoomEventData, IRoomInfo, ISavedSearch, ISearchResultList, ISearchResultSet, ITopLevelContext } from '@nitrodevco/nitro-packets';
import { createStore } from 'zustand';

/**
 * The room-entry popup the navigator shows while a locked/password room is being entered
 * (the Flash `GuestRoomDoorbell` / `GuestRoomPasswordInput` windows):
 * - `doorbell`: ask to ring; `doorbell_rung`: rung, window hidden until the server answers; `doorbell_waiting`:
 *   the server acknowledged the ring; `doorbell_no_answer`: nobody let us in.
 * - `password`: ask for the password; `password_sent`: window hidden while the server checks it; `password_retry`: rejected.
 * The `_rung`/`_sent` modes are the Flash windows' hidden-but-not-disposed state: a later
 * server reply re-shows the same window instead of creating a new one.
 */
export type NavigatorRoomEntryDialogMode = 'doorbell' | 'doorbell_rung' | 'doorbell_waiting' | 'doorbell_no_answer' | 'password' | 'password_sent' | 'password_retry';

export interface NavigatorRoomEntryDialog {
    room: IRoomInfo;
    mode: NavigatorRoomEntryDialogMode;
}

/** A modal message (the Flash `SimpleAlertView`): localization keys for the title and body. */
export interface NavigatorAlert {
    titleKey: string;
    messageKey: string;
}

/**
 * Where you are standing in the line into a full room. Flash raised one `RoomSessionQueueEvent`
 * per queue set and the widget kept only the active one, which is all this holds.
 */
export interface NavigatorRoomQueue {
    /** How many are ahead, plus you. */
    position: number;
    /** The spectator line rather than the visitor one. */
    spectator: boolean;
    /** Standing in the club lane, which moves faster. */
    clubQueue: boolean;
    /** There is another line to move to. */
    canChangeQueue: boolean;
}

/**
 * One room the user has been in this session, as Flash's `RoomVisitHistoryEntry`. The name is
 * filled in from whichever `GetGuestRoomResultMessage` names the room, so a room entered before
 * its info arrived is renamed rather than duplicated.
 */
export interface RoomVisitHistoryEntry {
    roomId: number;
    roomName: string;
}

/**
 * The room the user is actually standing in - Flash's `NavigatorData.enteredGuestRoom`. Only a
 * `GetGuestRoomResultMessage` with `enterRoom` set writes it; looking up another room's info
 * does not, which is why it is its own record.
 */
export interface EnteredRoom {
    info: IRoomInfo;
    /** Whether we own it - the favourite buttons are not offered on your own rooms. */
    isOwner: boolean;
    /** From `GetGuestRoomResultMessage`, not from the room settings. */
    isStaffPicked: boolean;
    canMute: boolean;
    allInRoomMuted: boolean;
}

/** `RoomVisitHistory.MAX_HISTORY_LENGTH` - the oldest entries fall off the front past this. */
const MAX_ROOM_VISIT_HISTORY = 20;

/** A search as `SearchContextHistoryManager` keeps it - Flash's `SearchContext`. */
export interface NavigatorSearchContext {
    searchCode: string;
    filteringData: string;
}

/** `NavigatorCache.EXPIRATION_TIME`: a search's results answer the same search again for this long. */
const SEARCH_CACHE_EXPIRATION_MS = 4000;

/** `NavigatorCache`'s key: `<searchCode>/<filteringData>`. */
const searchCacheKey = (searchCode: string, filteringData: string) => `${searchCode}/${filteringData}`;

/** A `NavigatorCacheEntry`: the results and when they stop answering. */
interface NavigatorSearchCacheEntry {
    result: ISearchResultSet;
    expiresAt: number;
}

/** The window's place and size, as `NavigatorView` reads them off `_window`. */
export interface NavigatorWindowGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * `NavigatorView`'s `_lastWindowX` ... `_lastLeftPaneHidden` and the time they were last sent
 * (`sendWindowPreferences`). Flash names the flag `_lastLeftPaneHidden` but fills it with
 * `left_pane.visible`, and that is what goes to the server.
 */
export interface NavigatorSentWindowPreferences extends NavigatorWindowGeometry {
    leftPaneVisible: boolean;
    sentAt: number;
}

/**
 * The answer `RoomEventViewCtrl.onRoomAdError` takes: the field it names gets the filtered text
 * and the error. `serial` tells one answer from the next.
 */
export interface NavigatorRoomAdError {
    errorCode: number;
    filteredText: string;
    serial: number;
}

/** filter_type_drop_menu options from navigator_frame_2 */
export type NavigatorFilterType = 'anything' | 'room.name' | 'owner' | 'tag' | 'group';

/**
 * The drop menu's modes in its own order, each with the prefix a search's `filteringData` carries
 * for it - `SearchView`'s selector entries over `FilterMode.FILTER_PREFIX`.
 */
export const NAVIGATOR_FILTER_TYPES: { type: NavigatorFilterType; prefix: string }[] = [
    { type: 'anything', prefix: '' },
    { type: 'room.name', prefix: 'roomname:' },
    { type: 'owner', prefix: 'owner:' },
    { type: 'tag', prefix: 'tag:' },
    { type: 'group', prefix: 'group:' },
];

/**
 * `SearchView.setTextAndSearchModeFromFilter` via `FilterMode.filterInInput`: a filter that starts
 * with a mode's prefix selects that mode and shows the rest in the field (`owner:Test` is the
 * owner mode and `Test`); any other filter is the first mode with the whole text.
 */
export const splitNavigatorFilter = (filteringData: string): { filterType: NavigatorFilterType; searchFilter: string } => {
    const mode = NAVIGATOR_FILTER_TYPES.find(x => (x.prefix !== '') && filteringData.startsWith(x.prefix));

    return mode
        ? { filterType: mode.type, searchFilter: filteringData.slice(mode.prefix.length) }
        : { filterType: 'anything', searchFilter: filteringData };
};

type State = {
    topLevelContexts: ITopLevelContext[];
    topLevelContext: ITopLevelContext | undefined;
    savedSearches: ISavedSearch[];
    /* NewNavigatorPreferencesMessage — HabboNewNavigator.onPreferences */
    preferences: { windowX: number; windowY: number; windowWidth: number; windowHeight: number; resultsMode: number } | undefined;
    flatCategories: IFlatCategory[];
    eventCategories: IEventCategory[];
    searchResult: ISearchResultSet | undefined;
    collapsedCategories: string[];
    expandedCategories: string[];
    viewModes: Record<string, number>;
    searchFilter: string;
    filterType: NavigatorFilterType;
    leftPaneHidden: boolean;
    isSearching: boolean;
    enteredRoom: EnteredRoom | undefined;
    /**
     * Where the user has been this session, oldest first, and where in it they are standing.
     * The room tools' back and forward arrows walk this rather than the server's room history:
     * Flash kept the same list in a process-wide `RoomVisitHistory`.
     */
    roomVisitHistory: RoomVisitHistoryEntry[];
    roomVisitIndex: number;
    /** `RoomRatingMessage`: the room's score, and whether this visit may still add to it. */
    currentRoomRating: number;
    canRateCurrentRoom: boolean;
    /** `FavouritesMessage` - which rooms are favourited, and how many may be. */
    favouriteRoomIds: number[];
    favouriteRoomLimit: number;
    roomEntryDialog: NavigatorRoomEntryDialog | undefined;
    alert: NavigatorAlert | undefined;
    roomQueue: NavigatorRoomQueue | undefined;
    /** `SearchContextHistoryManager`: every search answered, and where the back button stands in them. */
    searchHistory: NavigatorSearchContext[];
    searchHistoryIndex: number;
    /** `_noPushToHistoryDueToNavigation`: the next answer comes from walking the history, so it is not added to it. */
    skipNextSearchHistoryPush: boolean;
    /** `_lastSearchCode` / `_lastSearchFilter`: the last search sent to the server, which the refresh button repeats. */
    lastSearch: NavigatorSearchContext | undefined;
    /** `NavigatorCache`, by `<searchCode>/<filteringData>`. */
    searchCache: Record<string, NavigatorSearchCacheEntry>;
    /** Where the window is now - written by the window while it is up, read by the preference sync. */
    windowGeometry: NavigatorWindowGeometry | undefined;
    /** What was last sent; `undefined` until the window has been created (`createMainWindow`). */
    sentWindowPreferences: NavigatorSentWindowPreferences | undefined;
    /** `NavigatorData.roomEventData`: the event running in the room the user is in, if any. */
    roomEventData: IRoomEventData | undefined;
    /**
     * `RoomEventInfoCtrl.canExtend`. Flash works it out on each `refresh`; here when the event
     * arrives, which is the refresh it changes on - the time passing between refreshes moves it by
     * minutes at most.
     */
    roomEventExtendable: boolean;
    /** `RoomEventInfoCtrl._expanded`. */
    roomEventInfoExpanded: boolean;
    /** `NavigatorData.currentRoomId` / `currentRoomOwner`: `RoomEntryInfoMessage`'s room and owner flag. */
    currentRoomId: number;
    currentRoomOwner: boolean;
    /** `RoomEventViewCtrl`'s window is up. */
    roomEventSettingsVisible: boolean;
    roomAdError: NavigatorRoomAdError | undefined;
    /** `EnforceCategoryCtrl.show(selectionType)`: the dialog is up. */
    enforceCategorySelectionType: number | undefined;
    /** `RoomFilterCtrl._flatId`: the room whose word filter is being edited, 0 for none. */
    roomFilterFlatId: number;
    /** `RoomFilterCtrl`'s words, as the server has sent them and the window has removed them. */
    roomFilterWords: string[];
    /** `RoomFilterCtrl._selectedRow`. */
    roomFilterSelectedIndex: number;
};

type Actions = {
    setTopLevelContexts: (topLevelContexts: ITopLevelContext[]) => void;
    setTopLevelContext: (topLevelContext: ITopLevelContext | undefined) => void;
    setSavedSearches: (savedSearches: ISavedSearch[]) => void;
    setPreferences: (preferences: { windowX: number; windowY: number; windowWidth: number; windowHeight: number; resultsMode: number }) => void;
    setFlatCategories: (flatCategories: IFlatCategory[]) => void;
    setEventCategories: (eventCategories: IEventCategory[]) => void;
    setSearchResult: (searchResult: ISearchResultSet | undefined) => void;
    setCollapsedCategories: (collapsedCategories: string[]) => void;
    toggleCollapsedCategory: (code: string) => void;
    toggleExpandedCategory: (code: string) => void;
    setFilterType: (filterType: NavigatorFilterType) => void;
    setLeftPaneHidden: (leftPaneHidden: boolean) => void;
    setViewMode: (code: string, mode: number) => void;
    setSearchFilter: (searchFilter: string) => void;
    setIsSearching: (isSearching: boolean) => void;
    setEnteredRoom: (enteredRoom: EnteredRoom | undefined) => void;
    /** Merges into the room already entered; a no-op when it is a different room or none. */
    updateEnteredRoom: (roomId: number, changes: Partial<Omit<EnteredRoom, 'info'>>) => void;
    /** A room was entered: it becomes the current entry, and anything ahead of it is reordered behind it. */
    recordRoomVisit: (roomId: number, roomName: string) => void;
    /** A room named itself, wherever it sits in the history. */
    renameRoomVisit: (roomId: number, roomName: string) => void;
    /** Steps the cursor and hands back the room to go to, or nothing when there is none that way. */
    stepRoomVisitHistory: (direction: -1 | 1) => RoomVisitHistoryEntry | undefined;
    setRoomRating: (rating: number, canRate: boolean) => void;
    setFavouriteRooms: (favouriteRoomIds: number[], favouriteRoomLimit: number) => void;
    setRoomFavourite: (roomId: number, favourite: boolean) => void;
    setRoomEntryDialog: (dialog: NavigatorRoomEntryDialog | undefined) => void;
    /** Changes the mode of the open room-entry dialog; a no-op when none is open (the Flash windows ignore state changes once disposed). */
    setRoomEntryDialogMode: (mode: NavigatorRoomEntryDialogMode) => void;
    setAlert: (alert: NavigatorAlert | undefined) => void;
    setRoomQueue: (roomQueue: NavigatorRoomQueue | undefined) => void;
    /**
     * `HabboNewNavigator.onSearchResult`: the results are added to the history (unless walking it),
     * cached, and shown.
     */
    receiveSearchResult: (searchResult: ISearchResultSet) => void;
    /** `NavigatorCache.getEntry`: an unexpired entry, dropping it once it has expired. */
    getCachedSearchResult: (searchCode: string, filteringData: string) => ISearchResultSet | undefined;
    removeCachedSearchResult: (searchCode: string, filteringData: string) => void;
    setLastSearch: (lastSearch: NavigatorSearchContext) => void;
    /** `goBack`: steps back and hands back the search to make, or nothing when there is none before it. */
    stepBackSearchHistory: () => NavigatorSearchContext | undefined;
    setWindowGeometry: (geometry: Partial<NavigatorWindowGeometry>) => void;
    setSentWindowPreferences: (preferences: NavigatorSentWindowPreferences) => void;
    /** The event and whether it may be extended (`RoomEventInfoCtrl.canExtend`, worked out as it arrives). */
    setRoomEventData: (roomEventData: IRoomEventData | undefined, roomEventExtendable?: boolean) => void;
    setRoomEventInfoExpanded: (expanded: boolean) => void;
    setCurrentRoom: (roomId: number, owner: boolean) => void;
    setRoomEventSettingsVisible: (visible: boolean) => void;
    setRoomAdError: (errorCode: number, filteredText: string) => void;
    setEnforceCategorySelectionType: (selectionType: number | undefined) => void;
    setRoomFilterFlatId: (flatId: number) => void;
    /** `onRoomFilterSettings`: only the words not already held are added - none are dropped. */
    mergeRoomFilterWords: (words: string[]) => void;
    /** `onRemoveWordClick`'s local half: the word leaves the list at once. */
    removeRoomFilterWord: (word: string) => void;
    setRoomFilterSelectedIndex: (index: number) => void;
    /** `disposeWindow`: the window's words and selection go with it. */
    clearRoomFilter: () => void;
    resetNavigator: () => void;
};

const initialState: State = {
    topLevelContexts: [],
    topLevelContext: undefined,
    savedSearches: [],
    preferences: undefined,
    flatCategories: [],
    eventCategories: [],
    searchResult: undefined,
    collapsedCategories: [],
    expandedCategories: [],
    viewModes: {},
    searchFilter: '',
    filterType: 'anything',
    // `createMainWindow` hides the left pane; the preferences show it again.
    leftPaneHidden: true,
    isSearching: false,
    enteredRoom: undefined,
    roomVisitHistory: [],
    roomVisitIndex: -1,
    currentRoomRating: 0,
    canRateCurrentRoom: false,
    favouriteRoomIds: [],
    favouriteRoomLimit: 0,
    roomEntryDialog: undefined,
    alert: undefined,
    roomQueue: undefined,
    searchHistory: [],
    searchHistoryIndex: -1,
    skipNextSearchHistoryPush: false,
    lastSearch: undefined,
    searchCache: {},
    windowGeometry: undefined,
    sentWindowPreferences: undefined,
    roomEventData: undefined,
    roomEventExtendable: false,
    roomEventInfoExpanded: true,
    currentRoomId: 0,
    currentRoomOwner: false,
    roomEventSettingsVisible: false,
    roomAdError: undefined,
    enforceCategorySelectionType: undefined,
    roomFilterFlatId: 0,
    roomFilterWords: [],
    roomFilterSelectedIndex: -1,
};

export type NavigatorStore = State & Actions;

export const createNavigatorStore = () => createStore<NavigatorStore>()((set, get) => ({
    ...initialState,
    setTopLevelContexts: topLevelContexts => set({ topLevelContexts }),
    setTopLevelContext: topLevelContext => set({ topLevelContext }),
    setSavedSearches: savedSearches => set({ savedSearches }),
    setPreferences: preferences => set({ preferences }),
    setFlatCategories: flatCategories => set({ flatCategories }),
    setEventCategories: eventCategories => set({ eventCategories }),
    /*
     * `NavigatorView.onSearchResults`: the tab of the search the results answer is selected, when
     * there is one, and the filter they carry is put back in the drop menu and the field - so a
     * search made from elsewhere (`owner:<name>` from a profile) reads as one made here.
     */
    setSearchResult: searchResult => set((x) => {
        const cleared = {
            searchResult,
            isSearching: false,
            // BlockResultsView reseeds _searchCodeViewMode from the incoming blocks
            viewModes: Object.fromEntries((searchResult?.blocks ?? []).map(block => [ block.searchCode, block.viewMode ])),
        };

        if (!searchResult) return cleared;

        return {
            ...cleared,
            topLevelContext: x.topLevelContexts.find(context => context.searchCode === searchResult.searchCodeOriginal) ?? x.topLevelContext,
            ...splitNavigatorFilter(searchResult.filteringData),
        };
    }),
    setCollapsedCategories: collapsedCategories => set({ collapsedCategories }),
    toggleCollapsedCategory: code => set(x => ({
        collapsedCategories: x.collapsedCategories.includes(code)
            ? x.collapsedCategories.filter(y => y !== code)
            : [ ...x.collapsedCategories, code ],
    })),
    toggleExpandedCategory: code => set(x => ({
        expandedCategories: x.expandedCategories.includes(code)
            ? x.expandedCategories.filter(y => y !== code)
            : [ ...x.expandedCategories, code ],
    })),
    setFilterType: filterType => set({ filterType }),
    setLeftPaneHidden: leftPaneHidden => set({ leftPaneHidden }),
    setViewMode: (code, mode) => set(x => ({ viewModes: { ...x.viewModes, [code]: mode } })),
    setSearchFilter: searchFilter => set({ searchFilter }),
    setIsSearching: isSearching => set({ isSearching }),
    setEnteredRoom: enteredRoom => set({ enteredRoom }),
    updateEnteredRoom: (roomId, changes) => set(x => ((x.enteredRoom && (x.enteredRoom.info.roomId === roomId))
        ? { enteredRoom: { ...x.enteredRoom, ...changes } }
        : x)),
    recordRoomVisit: (roomId, roomName) => set((x) => {
        const history = x.roomVisitHistory.map(entry => ((entry.roomId === roomId) ? { ...entry, roomName } : entry));
        const index = Math.min(Math.max(x.roomVisitIndex, history.length ? 0 : -1), history.length - 1);

        // Standing on it already - only the name can have changed.
        if (history[index]?.roomId === roomId) return { roomVisitHistory: history, roomVisitIndex: index };

        /*
         * Walking back and then somewhere new does not throw the forward entries away, as a
         * browser would: Flash reversed them behind the cursor, so the room you came from is
         * the next one back. `RoomVisitHistory.reverseSuffix(index, length - 1)`.
         */
        if (index >= 0 && index < history.length - 1) {
            const tail = history.slice(index).reverse();

            history.length = index;
            history.push(...tail);
        }

        // The room reversing put at the end is the one we are entering: stand on it.
        if (history.length && (history[history.length - 1].roomId === roomId)) {
            history[history.length - 1] = { roomId, roomName };

            return { roomVisitHistory: history, roomVisitIndex: history.length - 1 };
        }

        history.push({ roomId, roomName });

        const trimmed = history.slice(Math.max(0, history.length - MAX_ROOM_VISIT_HISTORY));

        return { roomVisitHistory: trimmed, roomVisitIndex: trimmed.length - 1 };
    }),
    renameRoomVisit: (roomId, roomName) => set(x => ({
        roomVisitHistory: x.roomVisitHistory.map(entry => ((entry.roomId === roomId) ? { ...entry, roomName } : entry)),
    })),
    stepRoomVisitHistory: (direction) => {
        const { roomVisitHistory, roomVisitIndex } = get();
        const index = roomVisitIndex + direction;

        if (index < 0 || index >= roomVisitHistory.length) return undefined;

        set({ roomVisitIndex: index });

        return roomVisitHistory[index];
    },
    setRoomRating: (currentRoomRating, canRateCurrentRoom) => set({ currentRoomRating, canRateCurrentRoom }),
    setFavouriteRooms: (favouriteRoomIds, favouriteRoomLimit) => set({ favouriteRoomIds, favouriteRoomLimit }),
    setRoomFavourite: (roomId, favourite) => set(x => ({
        favouriteRoomIds: favourite
            ? (x.favouriteRoomIds.includes(roomId) ? x.favouriteRoomIds : [ ...x.favouriteRoomIds, roomId ])
            : x.favouriteRoomIds.filter(id => id !== roomId),
    })),
    setRoomEntryDialog: roomEntryDialog => set({ roomEntryDialog }),
    setRoomEntryDialogMode: mode => set(x => (x.roomEntryDialog ? { roomEntryDialog: { ...x.roomEntryDialog, mode } } : {})),
    setAlert: alert => set({ alert }),
    setRoomQueue: roomQueue => set({ roomQueue }),
    receiveSearchResult: (searchResult) => {
        const now = Date.now();

        set((x) => {
            // `addSearchContextAtCurrentOffset`: anything ahead of the current entry goes.
            const history = x.skipNextSearchHistoryPush
                ? x.searchHistory
                : [ ...x.searchHistory.slice(0, x.searchHistoryIndex + 1), { searchCode: searchResult.searchCodeOriginal, filteringData: searchResult.filteringData } ];
            // `NavigatorCache.put` drops the expired entries first.
            const searchCache = Object.fromEntries(Object.entries(x.searchCache).filter(([ , entry ]) => entry.expiresAt > now));

            searchCache[searchCacheKey(searchResult.searchCodeOriginal, searchResult.filteringData)] = { result: searchResult, expiresAt: now + SEARCH_CACHE_EXPIRATION_MS };

            return {
                searchHistory: history,
                searchHistoryIndex: x.skipNextSearchHistoryPush ? x.searchHistoryIndex : history.length - 1,
                skipNextSearchHistoryPush: false,
                searchCache,
            };
        });

        get().setSearchResult(searchResult);
    },
    getCachedSearchResult: (searchCode, filteringData) => {
        const entry = get().searchCache[searchCacheKey(searchCode, filteringData)];

        if (!entry) return undefined;

        if (entry.expiresAt <= Date.now()) {
            get().removeCachedSearchResult(searchCode, filteringData);

            return undefined;
        }

        return entry.result;
    },
    removeCachedSearchResult: (searchCode, filteringData) => set((x) => {
        const key = searchCacheKey(searchCode, filteringData);

        return { searchCache: Object.fromEntries(Object.entries(x.searchCache).filter(([ entryKey ]) => entryKey !== key)) };
    }),
    setLastSearch: lastSearch => set({ lastSearch }),
    stepBackSearchHistory: () => {
        const { searchHistory, searchHistoryIndex } = get();

        // `hasPrevious`.
        if ((searchHistoryIndex <= 0) || !searchHistory.length) return undefined;

        set({ searchHistoryIndex: searchHistoryIndex - 1, skipNextSearchHistoryPush: true });

        return searchHistory[searchHistoryIndex - 1];
    },
    setWindowGeometry: geometry => set((x) => {
        const current = x.windowGeometry ?? { x: 0, y: 0, width: 0, height: 0 };
        const next = { ...current, ...geometry };

        // The window reports its size on every layout pass; an unchanged one writes nothing.
        if (x.windowGeometry && (next.x === current.x) && (next.y === current.y) && (next.width === current.width) && (next.height === current.height)) return x;

        return { windowGeometry: next };
    }),
    setSentWindowPreferences: sentWindowPreferences => set({ sentWindowPreferences }),
    setRoomEventData: (roomEventData, roomEventExtendable = false) => set({ roomEventData, roomEventExtendable }),
    setRoomEventInfoExpanded: roomEventInfoExpanded => set({ roomEventInfoExpanded }),
    setCurrentRoom: (currentRoomId, currentRoomOwner) => set({ currentRoomId, currentRoomOwner }),
    setRoomEventSettingsVisible: roomEventSettingsVisible => set({ roomEventSettingsVisible }),
    setRoomAdError: (errorCode, filteredText) => set(x => ({ roomAdError: { errorCode, filteredText, serial: (x.roomAdError?.serial ?? 0) + 1 } })),
    setEnforceCategorySelectionType: enforceCategorySelectionType => set({ enforceCategorySelectionType }),
    setRoomFilterFlatId: roomFilterFlatId => set({ roomFilterFlatId }),
    mergeRoomFilterWords: words => set(x => ({ roomFilterWords: [ ...x.roomFilterWords, ...words.filter((word, index) => !x.roomFilterWords.includes(word) && (words.indexOf(word) === index)) ] })),
    removeRoomFilterWord: word => set(x => ({ roomFilterWords: x.roomFilterWords.filter(held => held !== word), roomFilterSelectedIndex: -1 })),
    setRoomFilterSelectedIndex: roomFilterSelectedIndex => set({ roomFilterSelectedIndex }),
    clearRoomFilter: () => set({ roomFilterWords: [], roomFilterSelectedIndex: -1 }),
    resetNavigator: () => set({ ...initialState }),
}));

/**
 * The one NavigatorStore for the whole client. It lives as long as the app does, so there is nothing a
 * provider would add: components read it through their hooks, and code outside React - packet
 * handlers, commands - reads and writes it through `getState()`, which is always current.
 */
export const navigatorStore = createNavigatorStore();

export type { ISearchResultList };
