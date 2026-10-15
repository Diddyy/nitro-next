# Refactoring backlog

Refactors worth doing in `nitro-react`, from a review of the package against
[Client code conventions](client-conventions.md), [Layout views](layout-views.md) and
[Porting gotchas](porting-gotchas.md) (October 2026). Paths are under `packages/nitro-react/src`
unless they name another package. Each item gives the evidence, the change and its size
(S, M, L); the order within a section is the suggested order.

Items marked **verified** were confirmed by reading the code; the rest come from the review's
file and line evidence and should be re-checked before work starts. Update an item's status when
it lands, and remove it once it is done and nothing points at it.

## Refactors that fix bugs

### 1. Handler refs updated in passive effects

`hooks/room/useRoomEventDispatcher.ts` keeps the caller's handler in a ref that a passive effect
(`useEffect`) updates. A room frame, ticker tick or Pixi event that arrives between a commit and
its passive effects calls the previous render's handler - a bubble placed over the previous
object, an overlay drawn with the previous alpha. **Verified.**

The same pattern is in `hooks/catalog/useCatalogWidgetEvent.ts`,
`hooks/room/chat/useChatInputContentRequest.ts`, `hooks/room/images/useRoomEngineTexture.ts`,
`hooks/room/useRoomFloorPlanDrawing.ts`, nitro-theme's `hooks/useLayoutEvent.ts`, and in about
fifteen components and views (`ChatFlowProvider`, `ChatHistoryTray`, `HintArrowView`,
`NotificationsView`, `TableView`, `QuestProgressBar`, `NavigatorRoomInfoPopup`,
`FurniturePresentOpenedWidget`, `CatalogItemGridWidgetView`, `CatalogRoomAdsWidgetView`,
`usePetNamePurchase`, `ToolbarSoundSettingsView`, `WiredRoomLogsView`, `RoomChatInputView`).

Change: one `useLatest(value)` hook in nitro-theme that writes its ref in a layout effect, used at
every site. M. **Done:** nitro-theme's `hooks/useLatest.ts`, used at every site above and at the
ones that had already moved to a layout effect by hand (`RoomCanvas`, `RoomEventHandler`,
`ScaledRoomOverlay`, `useRoomObjectBubblePlacement`, `useRoomPreviewer`, ...). Write a ref as
`useLatest(value)`, not `useRef` plus an effect.

### 2. One hook for placing things over room objects

`components/room/overlay/ScaledRoomOverlay.tsx` and `hooks/room/useRoomObjectBubblePlacement.ts`
each place a node on `RoomRenderedEvent`, place it again on the node's `layout` event, hide it
until placed and size it from its computed layout. Change: one `useRoomFramePlacement(nodeRef,
place)` both use. Do it after item 1. M. **Done:** `hooks/room/useRoomFramePlacement.ts` (with
`getLayoutSize`); the bubble keeps its sampling and smoothing, the overlay its scaling and drag.

### 3. Room object values read during render

`hooks/room/useRoomUserData.ts` reads the carried item, effect, posture and stand-up flag from
`roomObject.model` while rendering; `hooks/room/useRoomFurnitureData.ts` and
`hooks/room/useRoomObjectName.ts` do the same for furni. Nothing re-renders the component when the
model changes, and the React Compiler keeps the values cached across unrelated renders, so the
avatar menu can show a hand item that was dropped. **Verified.**

Change: read them from the store the packet handlers write, or subscribe with
`useSyncExternalStore` to the room's object updates as `useRoomIsInitialized` does. M.

### 4. One window pointer-drag hook

Eight drag loops add their own `window` listeners: `WiredSlider`, `ToolbarSoundSettingsView`,
`FurnitureStackHeightView`, `useFurnitureSlider`, `useFloorPlanSliderDrag`, `CameraPhotoLabView`,
`ChatHistoryTray` (two) and `ScaledRoomOverlay`. Only `useFurnitureSlider` handles
`pointercancel`, checks `pointerId` and converts to stage space. `ScaledRoomOverlay` and
`ChatHistoryTray` remove their listeners only on pointer up, so unmounting mid-drag leaks them
(**verified** for `ScaledRoomOverlay`). `CameraPhotoLabView`'s effect has no dependency list and
re-subscribes on every move.

Change: `useWindowPointerDrag({ onMove, onEnd })` owning listeners, cleanup, cancel and pointer id,
with optional local-space conversion; a slider-knob hook on top for the four sliders. M.

### 5. Group forum state kept twice

`commands/groupForumCommands.ts` holds fourteen module-level variables; `forumsList`, `forumData`
and `threadsList` duplicate `groupStore.forumView` and every handler writes both. A store reset
does not clear the module copy. `goToGroupForumMessage` sets `goToMessageIndex`, but its reader
`takeGroupForumGoTo` has no caller, so a `groupforum/<group>/<thread>/<index>` link opens the
page and never goes to the message. **Verified.**

Change: `forumView` as the only copy, the request bookkeeping in `GroupForumSlice`, and the go-to
read where the thread opens. M.

### 6. Chat bubble positions in a flipped room

`components/room/widgets/chat/ChatFlowProvider.tsx` (`getUserScreenLocation`) projects a room
location with `canvas.scale`; `Room.getRoomObjectScreenLocation` uses the negative scale when the
canvas is flipped, as does `VariableLeaderboardLocationProjector`. **Verified.** Change: one
shared projection, checked in a flipped room. S.

### 7. Wired source types resolved for conditions only

`wired/elements/condition/conditionShared.ts` (`resolveConditionMergedTypes`) moves a saved
target the picker does not offer onto the option it shows; only five condition definitions call
it. Fifteen other definitions with `hasCustomTypePicker` (`ChangeVariable`, `GiveVariable`,
`RemoveVariable`, `PlaceFurni`, `ProgressAchievement`, `ProgressRewardTrack`, `GiveFromChest`,
`InitiateTransaction`, `CustomContract`, `JumpStrength`, `Projectile`, `SelectorFilter`,
`VariableFilter`, `VariablePlaceholder`, `VariableLeaderboardAddon`) show the first option but save
the unresolved value. Change: check Flash's actions and addons, then resolve once in the
session's form creation for every `hasCustomTypePicker` definition. S-M.

### 8. Boolean configuration read five ways

`configReader().configBoolean` follows Flash's `getBoolean` ("1"/"true"); 17 sites compare
`config[key] === true` (`catalogCommands`, `dailyTasksCommands`, `raidProtectionCommands`,
`getWiredPermissions`, `bridgeOfferCenter`, `registerInventoryTradingHandlers`, ...), and
`groupCommands`, `avatarEditorCommands` and `catalogRecyclerCommands` have their own readers. A
value copied from the hotel's external variables as text reads false at every `=== true` site.
Change: `configBoolean(key)` and `configString(key)` over the system store, used everywhere. S-M.

## Convention drift

### 9. Moderation outside the store, action and command structure

`context/moderation` has no action hooks and there is no `commands/moderationCommands.ts`; the
moderation views call `getState()` 22 times and send 28 packets directly, and two import
`moderationIssueSends` from `handlers/moderation`. **Verified** (`getState` count). Change:
`useModerationActions`, `useModerationIssueActions` and a moderation commands file. The local
drift tool's exemption saying moderation is not ported is stale. M.

### 10. Packets sent from views

79 `send(new …Composer)` calls across 31 view files, against "send packets through commands";
outside moderation the largest are `AvatarEditor`, `NavigatorView` and
`InfoBubbleOwnAvatarView`. Move them as those views are touched. M, incremental.

### 11. Other store-access deviations

- `commands/cameraCommands.ts` defines `cameraStore` and `useCameraStore` outside `context/`. S.
- `getState()` in views: `CustomUserNotificationView`, `VariableLeaderboardWidget`,
  `VariableLeaderboardAddonView`, `RoomObjectMenuPet`; actions selected from a store in
  `ModActionView`, `ModRoomToolView`, `ModSendMessageView`, `VariableLeaderboardAddonView`,
  `CustomUserNotificationWidget`. S.
- `roomStore.getState().room` where `getRoom()` is the convention: `helpCommands`,
  `questCommands`, `raidProtectionCommands`, `roomThumbnailCameraCommands`, `roomUserCommands`,
  `registerHelpHandlers`, `registerAvatarEffectsHandlers`. S.
- `handlers/wired/registerWiredVariableLeaderboardHandlers.ts` keeps `send` in a module variable
  and exports user commands a widget imports from `#base/handlers`. S.

### 12. Navigator store and copies of the current room

`context/navigator/store/NavigatorStore.ts` (515 lines) covers about eight concerns without slices.
The current room's id and owner are also kept in `groupStore`, `moderationStore`, `roomStore` and a
closure in `registerRoomDirectoryHandlers`. Change: slices; derive the room's identity where the
copies' timing agrees with Flash's. M-L.

## Duplication and size

- **Room cameras.** `RoomThumbnailCameraWidget` and `StarterRoomCameraWidget` are near copies, and
  neither uses `collectRoomPhotoData` (`commands/cameraCommands.ts`). A `useRoomViewfinder` hook;
  the starter camera's UI moved to a view. S-M.
- **Second clocks.** Seven views run their own one-second `setInterval` clock (`QuestsView`,
  `DailyTasksView`, `useAvatarEditorEffects`, `ModIssueHandlerView`, `ModIssueBrowserView`,
  `RoomEffectsView`, `VariableLeaderboardWidget`) beside `hooks/useSecondsClock.ts`. An epoch
  variant of it. S.
- **Pet images.** The pet figure string is built in `usePetImageTexture`, `useCollectiblePetTexture`,
  `useChatPetFace` and nitro-renderer's `Room.getRoomObjectPetImageArgs` (and in Nitro Studio). One
  exported builder in nitro-renderer. Directions differ by unit (degrees, eighths), not by mistake. S.
- **Image caches.** `useChatAvatarHead` keeps its own avatar cache beside nitro-theme's
  `useAvatarImageTexture` and renders inside `getSnapshot`; `useChatPetFace` and
  `usePartThumbnail` repeat the same retained-texture structure. M.
- **Small helpers already in nitro-theme.** Hex colour (`OnboardingView`, `OnboardingWidgets`,
  `FurnitureDimmerWidget`, `CatalogGuildSelectorWidgetView`), clamp (`VariableFxState`,
  `VariableFxPreviewStatus`), two digits (`CountdownWidget`, `InfostandPetView`); three furni-name
  lookups with different fallbacks. S.
- **Large files.** `RoomChatInputView` (completion, NUX reminder, flood countdown, placement hooks),
  `CatalogProductViewWidgetView` (avatar pose, preview population, zoom easing - whose effect also
  misses `zoomProgress` in its dependencies), `AvatarEditor` (NFT handling, save flow),
  `commands/collectiblesCommands.ts` (split along its section banners; its slices only expose
  generic `patch*` actions). M each.
- **Wired boilerplate.** 34 definitions are only `{ holder, code, createForm: () => ({}) }`, and the
  variable-picker merged-section block repeats across definitions. A helper for each. S.
- **Template numbers in code.** `AvatarEditor` (`CONTENT_HEIGHT`, `SIDE_CONTAINER_X`) and
  `ToolbarView` (`BAR_HEIGHT`, `ITEMS_X`) copy values the loaded layout holds; read them with
  `findTemplateChild` as `RoomChatInputView` does. S.
- **TableView highlights.** Each `TextCell` runs its own 16 ms interval for its highlight; one shared
  ticker. S.
- **Chat definitions for Nitro Studio.** `chat/ChatStyleDefinitions.ts`, `chat/ChatConstants.ts` and
  the bubble layout depend only on nitro-api and are copied into Nitro Studio; moving them down a
  package retires those copies. M.
- **`type Send`** is redeclared in 67 files; export it once from `context/communication`. S.

## Decisions to make

- **Unused action hooks.** 26 `use*Actions` hooks have no importer; the conventions ask for one per
  slice and the dead-code check exempts them. Keep them for command-driven features, or relax the
  rule.
- **Packet callbacks in commands.** 30 command files export `on*` callbacks that handlers call;
  other features keep that logic in the handler. Document the pattern or apply one placement.

## Done

- Item 1, handler refs (`useLatest`).
- Item 2, one room-frame placement hook (`useRoomFramePlacement`).
