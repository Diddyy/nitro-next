# Server gaps

What the client implements that the Turbo development server does not answer yet: packets the
client sends that Turbo neither parses nor handles, and messages the client listens for that
Turbo never sends. On Turbo these features do nothing, or can only be checked by injecting the
server's messages into the client. Use this list to pick server work, and to tell a missing
server answer from a client bug.

This is the opposite of [Feature gaps](feature-gaps.md), which lists what the client has not
ported. A feature can be in both lists: the server's half here, the client's there.

As of client revision `WIN63-202609091217-117204808` and Turbo revision `Revision20260909`:
37 packets sent and 109 listened to. Update the list when a gap is closed on either side.

## How the list is made

`node tools/server-gaps.mjs <turbo-cloud checkout>` (or `TURBO_ROOT=<checkout>`) prints it; add
`--json` for the raw data. It matches the two sides by header id, so names that differ between
the client and Turbo do not matter.

- **Sent by the client.** Every composer whose class name appears in nitro-react. A gap is a
  header Turbo has no parser registered for (`no parser`), or a parser whose message has no
  handler (`no handler`).
- **Listened to by the client.** Every incoming message whose class name appears in nitro-react.
  A gap is a header Turbo has no serializer registered for (`no serializer`), or a composer
  nothing in Turbo refers to outside the revision's registration, the message primitives and the
  tests (`never sent`).

Both checks are by name, not by behaviour. A packet missing from this list is wired up on both
sides, but its handler can still do less than the client expects. A composer counts as sent as
soon as anything refers to it, even a method nothing calls. The behaviour gaps the tool cannot
see are under [Known behaviour gaps](#known-behaviour-gaps).

## Sent by the client, not handled by Turbo

Every one of these has a header in Turbo but no parser registered for it.

| Area | Packets | Client |
|---|---|---|
| Habbicons | `GetHabbiconShopData`, `GetHabbiconInfo`, `BuyHabbicon`, `BuyHabbiconCollection`, `ClaimHabbicon`, `FavoriteHabbicon`, `UnfavoriteHabbicon`, `TriggerHabbicon` | `commands/habbiconCommands.ts` |
| Account word filter | `GetCustomFilter`, `AddToCustomFilter`, `RemoveFromCustomFilter` | `commands/wordFilterCommands.ts` |
| Marketplace | `CancelAllMarketplaceOffers`, `ClearMarketplaceOwnHistory` | `commands/catalogMarketplaceCommands.ts` |
| Recycler | `GetRecyclerStatus`, `GetRecyclerPrizes`, `RecycleItems` | `commands/catalogRecyclerCommands.ts` |
| Special items | `ClaimProduct`, `HasClaimedProduct` | `commands/specialItemsCommands.ts` |
| Game tokens | `GetSnowWarGameTokensOffer`, `PurchaseSnowWarGameTokensOffer` | `commands/gameTokensCommands.ts` |
| NFT collectibles | `GetNftClaims`, `ClaimNftClaims`, `GetNftStoreOffers`, `NftStorePurchase`, `RedeemNftLootBox`, `ProgressTreasureHunt` | `commands/collectiblesCommands.ts`, `useRoomFurnitureActionHandler` |
| NFT trading | `GetNftTradeInventory`, `AddNftToTrade`, `RemoveNftFromTrade` | `commands/inventoryTradingCommands.ts` |
| Wired | `WiredClickUser`, `WiredGetRoomLogs`, `WiredUpdateRoom`, `WiredGetVariableOwnersPage`, `WiredGetUserPermanentVariables`, `WiredSetUserPermanentVariable`, `WiredGenerateWebApiKey` | `commands/wiredCommands.ts`, `wiredRoomLogsCommands.ts`, `wiredMenuCommands.ts`, `wiredVariableManagementCommands.ts`, `wiredWebApiKeyCommands.ts` |
| Wired trading | `SelfDonateItem` | `commands/wiredTradingCommands.ts` |

`RedeemNftLootBox` is `UnknownOutgoing_41H` in Turbo's headers: Turbo knows the id but not the
packet.

## Listened to by the client, never sent by Turbo

`no serializer` means Turbo cannot write the message at all; `never sent` means it can, but
nothing sends it.

| Area | Messages | Turbo |
|---|---|---|
| Room: spectators | `YouAreSpectator`, `YouAreNotSpectator` | never sent |
| Room: chat | `SpecialSystemChat` | no serializer |
| Room: furniture | `ObjectRemoveConfirm` (its primitive and serializer are empty), `UseObject`, `SpecialRoomEffect`, `GamePlayerValue` | never sent |
| Room: configuration items | `ConfigurationItemStates` | no serializer |
| Room: polls and quizzes | `PollOffer`, `PollContents`, `PollError`, `Question`, `QuestionAnswered`, `QuestionFinished` | never sent |
| Room: mystery boxes | `ShowMysteryBoxWait`, `CancelMysteryBoxWait`, `GotMysteryBoxPrize` | never sent |
| Room: crafting | `CraftableProducts`, `CraftingRecipe`, `CraftingRecipesAvailable`, `CraftingResult` | never sent |
| Room: bots | `BotSkillListUpdate` | never sent |
| Room: queue | `RoomQueueStatus` | never sent |
| Room: sound | `PlayListSongAdded` | never sent |
| Navigator | `ShowEnforceRoomCategoryDialog`, `RoomAdError` | never sent |
| Habbicons | `UserHabbicons`, `UserHabbiconStatusChanged`, `HabbiconShopData`, `HabbiconInfo`, `RoomUseHabbicon` | no serializer |
| Inventory | `FurniListAddOrUpdate`, `PostItPlaced` | never sent |
| Marketplace | `MarketplaceConfiguration`, `MarketPlaceOffers`, `MarketPlaceOwnOffers`, `MarketplaceItemStats`, `MarketplaceCanMakeOfferResult`, `MarketplaceMakeOfferResult`, `MarketplaceBuyOfferResult`, `MarketplaceCancelOfferResult` | never sent |
| Marketplace | `MarketplaceCancelAllOffersResult`, `MarketplaceClearOwnHistoryResult` | no serializer |
| Catalogue | `BundleDiscountRuleset`, `LimitedEditionSoldOut`, `FurniRentOrBuyoutOffer`, `TargetedOffer`, `TargetedOfferNotFound`, `VoucherRedeemOk`, `VoucherRedeemError`, `ScrSendKickbackInfo` | never sent |
| Recycler | `RecyclerStatus`, `RecyclerPrizes`, `RecyclerFinished` | no serializer |
| Special items | `ClaimProductResult`, `HasClaimedProductResponse` | no serializer |
| Offer centre | `OfferRewardDelivered` | never sent |
| Earnings | `IncomeRewardClaimResponse` (never sent), `IncomeRewardNotification` (no serializer) | |
| Game tokens | `SnowWarGameTokens` | never sent |
| User and account | `InClientLink` (its primitive has no link field), `UserNameChanged`, `ChangeUserNameResult`, `EmailStatusResult`, `AccountSafetyLockStatusChange`, `AvatarEffectSelected`, `ExtendedProfileChanged`, `BlockList` | never sent |
| Chat styles | `UserNftChatStyles` (never sent), `UserPurchasableChatStyles`, `UserPurchasableChatStyleChanged` (no serializer) | |
| Account word filter | `GetCustomFilterResult`, `ModifyCustomFilterResult` | no serializer |
| Messenger | `MiniMailNew`, `MiniMailUnreadCount` | never sent |
| Notifications | `RoomMessageNotification` | never sent |
| Hotel status | `InfoHotelClosed`, `LoginFailedHotelClosed` | never sent |
| NFT collectibles | `CollectibleMintingEnabled`, `CollectibleWalletAddresses`, `CollectableMintableItemTypes`, `CollectibleMintTokenCount`, `CollectibleMintTokenOffers`, `CollectibleMintableItemResult`, `NftCollections`, `NftCollectionsScore`, `NftBonusItemClaimResult`, `NftRewardItemClaimResult`, `NftTransferFee`, `NftTransferAssetsResult` | never sent |
| NFT collectibles | `NftClaims`, `NftClaimResult`, `NftStoreOffers`, `NftStorePurchase`, `RedeemNftLootBoxState`, `RedeemNftLootBoxResult` | no serializer |
| Trading | `TradeSilverSet`, `TradeSilverFee` (never sent), `TradeNftAssets`, `TradeNftAssetInventory` (no serializer) | |
| Wired | `WiredMenuError` (never sent); `WiredEnvironment`, `WiredClickUserResponse`, `WiredRoomLogs`, `WiredUserVariablesList`, `WiredUserPermanentVariables`, `WiredSetUserPermanentVariableResult`, `WiredWebApiKeyResult` (no serializer) | |
| Wired trading | `SelfDonationResult` | no serializer |

## Known behaviour gaps

Packets that both sides handle, where Turbo does less than the Flash client expects. The tool
cannot find these; add them as they are found.

- **Post-it stacks.** `PlacePostIt` places the whole inventory item rather than one sheet of its
  stack, and Turbo never answers with `PostItPlaced`, so the stack's count in the inventory does
  not go down.
- **Spam wall.** Turbo sends `RequestSpamWallPostIt` with the wall's room object id. Flash looks
  that id up in the inventory to take a themed post-it's type, so with Turbo the note always opens
  as a plain `post_it`.

## Checking a client feature without the server

For a message Turbo never sends, inject it into the client's socket and look at the result.
Build the frame with nitro-api's `BinaryWriter` (`int length, short header, body`) and hand it to
the game socket's `onmessage`. Read the client's own store modules from the page with
`await import('/src/context/...')`, and run the probe against a freshly started dev server: an HMR
reload splits the modules, and the page then holds two copies of each store. A composer the
client sends can be checked by wrapping the socket's `send` and reading the header at byte 4.
