# Feature gaps

What the port does not do yet, as of client revision `WIN63-202609091217-117204808`: whole
systems with no window, and gaps inside features that are otherwise ported. Use it to pick work,
and to tell a missing feature from a bug before debugging something that was never built.

This list comes from the code, not from a full audit against the Flash client, so a gap that
neither sends nor receives a packet and carries no "Not ported" note can be missing from it.
Update the list when a gap is closed or found.

## How the list is made

Three sources, each worth re-running after a revision bump or a feature port:

- **Packet coverage.** `node tools/packet-coverage.mjs` lists, by feature area, the incoming
  messages nothing in the client listens to and the outgoing composers nothing sends. At the time
  of writing that is 176 of 556 incoming and 201 of 553 outgoing. A packet counts as used when its
  class name appears in the client's source, so a registered listener that does nothing still counts.
- **The port's own notes.** Views, stores and handlers state what they leave out; search the
  client for `not ported` and `Not ported:`.
- **The drift checks.** `handlers.py` in the local drift tool (see [Staying in step](staying-in-step.md))
  names the Flash class that handles each unsubscribed packet, and `known.HANDLERS_UNHANDLED`
  gives the reason for every packet left unhandled on purpose.

Not every unused packet is a gap: see [Not gaps](#not-gaps).

## Whole features with no window

| Feature | What is missing | Packet areas |
|---|---|---|
| Messenger and friend bar | Conversations and their history, instant-message errors, mini mail, friend notifications, room invites. The friend list is ported; its "start conversation" buttons do nothing (`FriendListSearch`, `FriendListSearchItem`). The friend bar is ported (`views/friend-bar`); Turbo only sends its room event notifications, as it has no achievements, quests or games to send the others for. | `FriendList` |
| Moderation tool | Issues, chat logs, room and user info, room visits, sanctions. No window, no store, and nothing sends its requests. | `Moderation`, `Moderator` |
| Help, call for help and guides | Reporting a user or room, pending calls, guide sessions, chat review, the safety quiz. | `Help`, `Callforhelp` |
| Quests and talent track | Daily and seasonal quests, community goals and talent track levels. The achievement browser, score and standard award packets are implemented; see [achievement client](achievements.md). | `Quest`, `Talent` |
| Game centre | SnowWar (it needs the game engine), game directory, leaderboards, weekly rewards. `commands/gameTokensCommands.ts` has nothing that calls it. | `Game` |
| Group forums | Forum list, threads, posts, moderation, unread counts. Group info, management and profiles are ported (`GroupInfoView`'s `show_forum_link`). | `Groupforums` |
| Room camera | Taking, buying and publishing photos, thumbnails, photo competitions. The mannequin and plane code note the missing camera render (`FurnitureMannequinVisualization`, `RoomPlane`). | `Camera` |
| Campaign calendar | The advent calendar and its doors, and the seasonal daily offer that shares it. | `Campaign`, `Catalog` |
| New user experience | The gift offer, the initial room choice, the tutorial script. | `Nux` |
| Room competitions | Submitting, voting, forwarding to competition rooms. | `Competition`, `Navigator` |
| Room events | Creating, editing and cancelling events, and the in-room event promotion. `CatalogRoomAdSlice` notes that nothing opens the room ad page from here. | `Navigator` |
| NFT wardrobe | Saved NFT outfits and their selection, silver. | `Nft` |
| Name change | `AvatarEditorNameChangeView` and the in-room name change (`AvatarEditor`). | `Avatar` |

## Gaps inside ported features

| Area | Gap | Where |
|---|---|---|
| Server-sent links | `InClientLinkMessage` has no listener, so a link the server asks the client to open does nothing. | `handlers/` |
| Room | The room word filter window (`GetCustomRoomFilter`, `UpdateRoomFilter`) - `RoomInfoView` notes it. | `views/room-widgets/room-info` |
| Room | YouTube playback control from the server (`YoutubeControlVideoMessage`). | `FurnitureYoutubeView` |
| Room | Spectator mode (`YouAreSpectatorMessage`), special system chat, the object remove confirmation. | |
| Room | Post-its: placing one (`PlacePostItComposer`, `PostItPlacedEventMessage`) and the spam wall. | |
| Room | Habbicon bubbles over avatars and the habbicon selector in the chat input. | `AvatarLogic`, `AvatarVisualization`, `RoomChatInputView` |
| Pets | Infostand actions: supplements, composting a plant, passing a carried item, selecting a pet. | |
| Pets | The breeding dialogs, and placing a pet opened from a present (it stays in the inventory). | `InventoryPetsView`, `FurniturePresentOpenedWidget` |
| Navigator | No error for a room that does not exist (`NoSuchFlatMessage`); room event info; report room; the promoted-rooms strip; a block's back button (`goBack` over the search history); syncing the window preferences to the server. | `NavigatorView`, `NavigatorRoomInfoPopup` |
| Navigator | The room category enforcement dialog (`ShowEnforceRoomCategoryDialogMessage`). | |
| Marketplace | Redeeming the credits of sold offers (`RedeemMarketplaceOfferCreditsComposer`). | |
| Catalogue | The next-limited-rare countdown, the page with the earliest expiry, the gift check (`GetIsOfferGiftableComposer`), the HC extend offer, the targeted offer's HabboMall page. | `registerTargetedOfferHandlers` |
| Crafting | Secret recipes (`CraftSecretComposer`, `GetCraftingRecipesAvailableComposer`). | |
| Badges | Requesting a badge (`RequestABadgeComposer`). | |
| Inventory | The 200-item pages (the grids scroll instead), merged rentable furni, paging through an external image wall item. | `InventoryFurniView`, `InventoryBadgesView`, `InventoryCollectiblesView`, `InventoryFurniPreview` |
| Trading | The collectible (`nft_image`) layout of the item popup. | `InventoryTradingItemPopup` |
| Wired | The hover popup in the wired trade view, and the limited-edition plaque on chest item icons. | `WiredTradeView`, `WiredChestItemCell` |
| Notifications | The new-feature window, the moderation disclaimer, the notification feed. `ClubGiftSelectedEventMessage` and `PetReceivedMessage` have empty stub parsers. | `NotificationStore`, `registerAlertDialogHandlers` |
| Purse | What clicking the currency icons opens. | `PurseView` |
| Hotel view | Moving background objects, and the landing view widgets for expiring catalogue pages, the community goal vote and the next limited rare countdown. | `HotelView`, `HotelViewWidgets` |
| Chat | Flash's chat commands other than the wired ones; the chat input sends them as chat. | `wiredChatCommands` |
| Account | Email change and status. | `Users` |
| Hot looks, mystery box keys, user classification, element pointer | No listener or request. | |

## Quick wins

Each of these is one handler or one button on a window that already exists:

- `InClientLinkMessage`: pass the link to the client's link handling.
- `NoSuchFlatMessage`: show the navigator's error for a room that does not exist.
- `RedeemMarketplaceOfferCreditsComposer`: the marketplace's own-items page already lists sold offers.
- The pet infostand actions.

## Not gaps

About 40 unused packets are protocol the port does not need:

- **The old navigator.** Its search composers (`MyRoomsSearchComposer`, `PopularRoomsSearchComposer`,
  `RoomTextSearchComposer`, ...) and results (`GuestRoomSearchResultMessage`, `OfficialRoomsMessage`,
  `PopularRoomTagsResultMessage`, `CanCreateRoomMessage`). The client uses the new navigator.
- **The handshake and shell.** `InitDiffieHandshake`, `CompleteDiffieHandshake`, `VersionCheck`,
  `UniqueId`, `IdentityAccounts`, `RestoreClientMessage`: the port's socket speaks plaintext and
  the client is a page, not an AIR shell.
- **Tracking.** Latency pings, lag warnings and performance logs.
