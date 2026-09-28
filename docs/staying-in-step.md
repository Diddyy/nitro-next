# Staying in step with the client

A lot of this repo is the Flash client's own data carried over by hand or by generator, and the
client moves on with every revision (`production.version` in `nitro-config.json` names the one
being ported). Data that quietly falls behind does not fail - it renders wrong: the companion
pets stood still because the bundled animation table predated them. After a revision
bump, and before blaming code for something that "almost works", check the data:

```sh
cd scripts/drift && sh run-all.sh     # git-ignored, local; exits 1 and prints DRIFT lines, or "No drift."
```

The checks read the revision from `production.version`, so they follow a bump on their own (and
say so when that client has not been decompiled to the `<revision>/scripts-deob` folder `known.FLASH_ROOT` names yet). A
clean run prints one `ok` line per check. Every deliberate difference is an entry in
`scripts/drift/known.py` with its reason, so a `DRIFT` line is always new: fix it, or - when the
port differs on purpose - add the entry *and* say why in the code it concerns. Do not let findings
accumulate as "known noise"; that is how seventeen missing variable keys went unread.

| What | Source of truth | How it gets here |
|---|---|---|
| The avatar data the renderer starts from (`avatar-data.nitro`, `avatar.data.url`, nitro-api's `IAvatarRenderData`): geometry, part sets, placeholder figure, built-in animations, action offsets, actions and animations | the client release's `habbo-avatar-render-lib` (`HabboAvatarGeometry`, `HabboAvatarPartSets`, `HabboAvatarFigure`, `dance_sixseven_animation`, `action_offset_lay` / `_swim`, `HabboAvatarAnimation`) and the hotel's `HabboAvatarActions.xml` | Nitro Studio: Changes, From Habbo - Client data and Hotel data - into its workspace's gamedata, built into the bundle on import, edit and publish. The renderer carries none of it; `run-all.sh` diffs the studio's copies against the SWF |
| `HabboAvatarActionsDefault.ts` (the stand and the snowwar postures) | the XML literal in `AvatarRenderManager.as` - Flash code, not an asset | by hand; diffed (its offsets come with the avatar data) |
| `theme/font/flash-text/habboTextStyles.ts` | `styles_css` in the SWF | `nitro-react/scripts/generate-habbo-text-styles.ts` |
| `nitro-react/src/context/notifications/store/NotificationConfig.ts` | `habbo_notifications_config_xml` and the bitmaps of `HabboNotificationsCom.as` | by hand; `notifications_config.py` diffs styles, view timings and asset names |
| `IncomingHeader.ts` / `OutgoingHeader.ts` and the packet classes | the packet generator output directory | see Packets; `packets.py` checks names, ids and registration, `wire.py` what each packet reads and writes |
| Which incoming packets the client acts on (`handlers/**`, and the window hooks that use `useMessageListener`) | the Flash component that constructs the message id's `*MessageEvent` - `addHabboConnectionMessageEvent(new XMessageEvent(onX))` | by hand; `handlers.py` reports a registered packet nothing subscribes to (naming the Flash class that handles it, so the gap is read as a missing feature), a `known.HANDLERS_UNHANDLED` entry that has gone stale, and a listener on a packet Flash never acts on (`known.HANDLERS_PORT_ONLY`) |
| `nitro-api` enums, constant classes and event classes that mirror a Flash constant class (`RoomObjectVariableEnum`, `RoomWidgetEnum`, `RoomObjectWidgetRequestEvent`, `PetType`, ...), and same-named constant classes in nitro-renderer / nitro-react | the `.as` class - same name, or paired in `known.PAIRED` / `MERGED` (obfuscated or renamed), or by value overlap (`enums.py -v` lists the pairs) | by hand; the *values* must be Flash's strings, typos and case included (`furniture_expirty_timestamp`, `GAME_TOKEN`, `ROWRE__STICKIE`). A nitro-api class that pairs with nothing is drift until `known.ENUMS_UNPAIRED` says why; every `RoomObjectWidgetRequestEvent` member needs a widget or handler case, or a `known.WIDGET_REQUESTS_UNHANDLED` reason |
| `nitro-react/scripts/flash-js-resources/<component>/` (git-ignored; the input of `generate-layout-views.ts`, `extract-skin-assets.ts`, `generate-habbo-text-styles.ts` and of the hand-written views that cite a layout) | the component bundles `flash-js` loads, of the revision `production.version` names | by refreshing the folder from the client. `binary_data.py` holds each bundled asset against the decompiled client by published name and reports one whose bytes differ - the two references being different builds - unless `known.REFERENCE_BUILD_SKEW` says which side the port follows. Then regenerate what reads them and re-read the views whose layout changed |
| `nitro-react/scripts/layouts/**` (git-ignored) and `public/assets/<component>/*.png` - the client's `<layout>` assets converted to React, the reference every hand-written view is drawn from | the `*.xml` of each `nitro-react/scripts/flash-js-resources/<component>/` | `nitro-react/scripts/generate-layout-views.ts` (`yarn workspace @nitrodevco/nitro-react generate-layout-views`) - regenerate, never edit; `layouts.py` compares each registry entry's `xml` hash with its asset, and `layout_views.py` compares the client's controls with the hand-written views |
| Which reference file each shipped layout bitmap is, recorded in `public/assets/layout-images.json` | the bundle file carrying the published name, in the folder of the library that owns the layout | by the generator (see "Widget views from Flash layouts"); `layout_images.py` holds every shipped bitmap to its recorded bundle file byte for byte (a manifest crop to its region's size) and reports one shipped from a differently-named file where a bundle carries the exact name - another library's art under a shared embedded name. A name that settles neither way goes in `known.LAYOUT_IMAGES_AMBIGUOUS` with why the one shipped is kept |
| A port class's constants where the Flash class has them (`AvatarLogic`, `AvatarVisualization`, `AnimationFrame`, `LayerData`), and the tables lifted out of a Flash method (the post-it colours, the dimmer colours, ...) | the `.as` class | by hand, under Flash's names; `constants.py` compares every static const of the paired class (an obfuscated Flash name maps through its `rename`, one the port leaves out needs a `skip` reason) and, for `AvatarLogic`, the timeouts Flash writes as literals |
| `RoomObjectLogicFactory` / `RoomObjectVisualizationFactory` | `RoomObjectFactory.as` / `RoomObjectVisualizationFactory.as` | by hand; a type only Flash builds falls back to the basic class, so list it in the factory's comment or port it |
| The hand-written `views/**` built from a Flash layout - the controls each one draws | `<layout>_xml` of the revision, and the `.as` class that drives the window | by hand; `layout_views.py` records each layout's named controls beside its view in `known.LAYOUT_VIEWS` and reports one the client added, dropped or reordered. A view built from a layout with no row falls behind unnoticed, so add the row with the view; a control the port leaves out on purpose stays in the list and the view's docblock says why (`RoomInfoView` names all four of its own). `layout_fills.py` holds the same views to the layout's `background` flag: `WindowController` paints a `color` as a rectangle only where the element carries `background="true"`, so a view that fills one without it invents a panel the client has not got - the navigator's `border` at (-3, -3) painted 577x578 of `#eceae0` across the content area and read as content overflowing the frame. A tinted `Border` is not the same thing and is not counted: skin art draws with or without the flag, as `me_menu_other_settings`'s `settings_brdr` (the whole panel) shows. `layout_text_styles.py` holds each named text of the layout to the view's element of that name: the text style the layout resolves to (its `text_style`, else its window style's theme default) and the `font_face` it sets over it |
| `nitro-react/src/wired/elements/<holder>/<holder>Codes.ts` (the six `*Codes` classes, whole) and the `<holder>Elements.ts` registration order | `wired_setup/<holder>/<Holder>Codes.as` and `ActionTypes.as` / `TriggerConfs.as` / ... push order | by hand; `wired_tables.py` compares names and values, and the sequence of codes the registered elements answer to |
| Other wired constant tables: the variable FX editor enums, `WiredMenuSlice`'s error codes, `WiredEnvironmentSlice`'s click options, the wired enums of nitro-packets (`QuantifierType`, `WiredVariableTarget`, `TradeRequirementType`, ...) | the (mostly obfuscated) `.as` class named in each docblock | by hand; `wired_tables.py` compares values, and that every obfuscated Flash name is named in the port file |
| `nitro-react/src/wired/styles/*WiredStyle.ts` | `uibuilder/styles/<Name>WiredStyle.as` getters, and the `wired_style_<name>_xml` templates | by hand; `wired_tables.py` diffs the getters only - the templates are not checked (`known.WIRED_STYLE_TEMPLATES_UNCHECKED`) |
| The config flags the port reads, in `public/config/nitro-config.json` | the hotel's `external_variables` (Nitro Studio's `gamedata/ExternalVariables.json`) and the keys the `.as` files name | by hand; `config_keys.py` reports a key the hotel sets that the config lacks, and a key no Flash class names (Nitro's own go in `known.CONFIG_KEYS_PORT_ONLY`). A key read through a string constant (`useConfigValue(WARDROBE_SLOTS_KEY)`) is followed to its value, the file's own or one another file exports, and a read it cannot resolve is reported rather than skipped |
| The hotel view's run-time keys in `nitro-config.json` - `landing.view.dynamic.slot.<n>.*`, `landing.view.common.*`, `landing.view.background_<name>.*`, and `landing.view.<code>.widget/.conf/.layout` for every code a slot's schedule names | the hotel's `external_variables` | by hand; `config_keys.py` holds each one the hotel sets to the hotel's value. The keys are built at run time, where the literal-read check above cannot see them; a schedule the hotel moved on from shows old promotions, and a code with no keys leaves its slot empty |
| Class constants mirrored whole outside nitro-api (`AvatarVisualization`, `AnimationFrame`, `LayerData`, the Variable FX tables and paint colours) and module tables copied out of a Flash array or switch (post-it colours, pet/bot placing and friend list error texts, visitor steps, thumbnail `DRAW_ORDER`, `PRODUCT_IMAGES`, dimmer colours, trophy themes, mannequin clothing, ...) | the `.as` class or method named in each docblock | by hand; `constants.py` reads both sides and compares them. A file whose docblock names `drift/constants.py` is left out of `enums.py`; add a table to `constants.py` when you carry a new one |
| `public/assets/chat-styles/<assetId>/chat_definition.json` and its `*.png`; `ChatMarkup.ts` palettes, `ChatConstants.ts` bubble widths | `chatstyles_xml`, every `style_<assetId>_regpoints` and bitmap of `HabboFreeFlowChatCom.as` (read as `ChatStyleLibrary.as` reads them); `ChatMarkup.as`, `ChatBubbleWidth.as` | by hand, bitmaps copied from the SWF images; `chat_styles.py` diffs every style's flags, regpoints keys and pixels, a regpoints key the library starts reading, the palettes and the width mapping |
| The theme's skin tables: every `*_VARIANTS` table under `nitro-react/src/theme`, `theme/utils/windowLayouts.ts`, `theme/utils/iconSetFrames.ts` + `public/assets/images/icon-set.png`, and `TEXT_STYLES` in `theme/utils/textStyles.ts` | the `(type, style)` rows of `habbo_element_description_xml`, the window layouts they name (`HabboWindowManagerCom.as`), `habbo_skin_icon_set_xml` + `habbo_icons_png`, `styles_css` | by hand, art cut from the skin sheets (`scripts/extract-skin-assets.ts`, then `yarn build-asset-bundles`); `theme_skin.py` diffs the style ids per type, button layouts, frame minimum sizes, row tints, icon rects and pixels, and holds `TEXT_STYLES` to deriving its entries from `HABBO_TEXT_STYLES`, `TextStyleKey` to being `HabboTextStyleName`, and every `textStyle` prop in the tree to a style that table has. A style left out or added goes in `known.THEME_STYLES_NOT_PORTED` / `THEME_STYLES_PORT_ONLY` |
| `nitro-react/src/context/catalog/page/CatalogLayouts.ts` (which widgets each layout code creates, the layout widths and aliases), `CatalogWidgetEnum`, the `PageLocalization` tables, and the slots each registered layout view draws | `CatalogPage.createWidgets`'s walk over each `layout_*_xml`, the layouts' manifest refs, `CatalogWidgetEnum.as`, `PageLocalization.as` | by hand; `catalog_layouts.py` holds the tables to the layout XML and manifest, the enum to Flash's `createWidget` cases and each registered layout view's slots to its layout, and `constants.py` the localization tables |
| `nitro-react/src/theme/utils/dynamicStyles.ts` - the hover/press/disabled effects a layout names with `dynamic_style` (`lifted_hover`, `brightness_and_shadow_under`, `_gentle`, `reward_track_item`, `button`), and the generator's `DYNAMIC_STYLE_NAMES` | `DynamicStyleManager.fillStyleTable()` and `DynamicStyle`'s constructor defaults | by hand; `dynamic_styles.py` compares every style's effective rule for the host and each `#icon` / `#bg` child in every state, through the port's own `resolveDynamicStyleRule`. A name the port lacks draws nothing and fails nothing - that is how `button` went missing |
| The text keys the port asks for (`t('...')`, `'${...}'`, any key literal inside a `t(...)` call, and the key-shaped strings of a file that hands `t()` a variable) | the embedded `default_localizations` + the hotel's external texts (Nitro Studio's `gamedata/DefaultLocalizations_en.json`, `ExternalTexts.json`) and the keys Flash's classes and layouts name | `localization_keys.py` reports a key in neither file that no Flash class or layout names |
| `nitro-react/src/context/system/store/HotelViewSlice.ts` initial background table and `views/hotel-view/HotelView.tsx` | `landing_view_default_dynamic_layout_xml` and `WidgetContainerLayout.as` | `tools/references/hotel-view.json` pins sources; `tools/hotel-view.test.mjs` checks background names and initial URIs against the local SWF extraction and tests schedule transitions. See `tools/hotel-view-reference.md`; matching official screenshots are still required for visual parity. |
| The names Nitro Studio's hand item builder takes for granted: the `CarryItem` / `UseItem` actions (`cri` / `usei`, drawing `crr` / `drk` on `handRight`), the `ri` part, `hh_human_item` as a mandatory library, and its sprites' `<size>_<crr\|drk>_ri_<asset>_<direction>_<frame>` names (`studio-hand-items.ts`, `hand-item-store.ts`) | the renderer's `HabboAvatarActions` and `HabboAvatarPartSets`, `AvatarAssetDownloadManager`, and the workspace's `hh_human_item` | by hand; `hand_items.py` holds the builder's code and the served actions to them, and every `ri` sprite of the library to the pattern - a rename would leave the merge that keeps the workspace's own hand items through Habbo's updates finding nothing to put back. `served_gamedata.py` sets the builder's own `CarryItem` / `UseItem` params aside (the ids its record lists) before holding the served actions to the source |
| Nitro Studio's copies of other code's tables: `FURNITURE_CATEGORIES` (`shared/gamedata.ts`), the columns a new definition is inserted with and the ones a republish refreshes (`server/definitions.ts`), the config keys and url patterns `buildConfigUrls` writes into nitro-config.json (`shared/layout.ts`), the showroom's `room.sql` (`server/showroom-rooms.ts`), and the custom chat style bundle (`server/chat-styles.ts`, `CHAT_STYLE_FILES`) | turbo-cloud's `FurnitureCategory`, `FurnitureDefinitionEntity`, `FurnitureUsageType`, `RoomModelEntity`, `RoomEntity` and `FurnitureEntity`; the keys nitro-react and nitro-renderer read and the `%placeholders%` they fill; nitro-react's `chatStyleAssetName`, `ChatStyleDefinition`, `ChatStyleAssetFile`, `isStaticChatStyle` and what `ChatStyleLibrary` loads | by hand; `studio.py` compares the categories, holds every inserted column to its entity and every `required` property to the insert (definitions and all three `room.sql` tables), reports a key the config lacks or no client code reads, or a placeholder nothing fills - `catalog.asset.url` was read by the catalog and missing from the config, so every wallpaper, floor and landscape picture was a 404 - and holds the chat style bundle's asset names, catalogue entry and fields, bundle name, config key, bitmap files and id range to what the client reads: a bundle packed any other way loads and yields no style. It also holds the chat styles' default id and NFT range to nitro-react's, the room engine's library names (`ROOM_OBJECT_LIBRARIES`) to what `RoomContentLoader.getAssetUrls` asks for, the preview's expressions to `AvatarExpressionEnum` and its pet postures and faces to what the workspace's pets have, an effect override's key to `AvatarActionStateType` (an action name never matches, and the override never plays), and every config key the preview or the server reads outside `shared/layout.ts` to the config, or a `known.STUDIO_CONFIG_ABSENT` reason |

Rules that come out of that:

- An enum member without a class that builds it is half a port. When a type is added to
  `RoomObjectLogicType` / `RoomObjectVisualizationType`, add its factory case in the same change.
- A deliberate gap is written down where the fallback happens (the logic factory's `default:`),
  not left for the next reader to rediscover.
- Nitro's asset pipeline adds a few values Flash never had (`furniture_isometric_bb`). Those are
  extensions, not drift; leave them.
- Mirror the whole Flash class, not the members the feature at hand needs. A key with no reader
  yet costs nothing, and its absence makes the next port invent a string literal. Take the value
  from the `.as` file, never from memory or an older Nitro: `FurnitureTypeEnum.GameToken` was
  `'game_token'` where the wire says `'GAME_TOKEN'`, and nothing fails until that product arrives.
- Say in the enum's docblock which Flash classes it mirrors. `RoomObjectVariableEnum` folds
  `RoomVariableEnum.as` and a few string literals into one enum; undocumented, the second class
  was never checked and seven of its keys were missing. A new merge or an obfuscated source also
  goes into `MERGED` / `PAIRED` in `known.py`, or the check cannot see it.
- A member Flash does not have and nothing reads (`Swim = 'swm'`) is dead code; delete it.
  One the port does read (a Nitro-only request type such as `RoomObjectWidgetRequestEvent.YOUTUBE`)
  goes into `known.PORT_ONLY` with the reason, and the class docblock says it is Nitro's own.
- An event class's `type` strings are Flash's too, prefix included (`REPSE_`, not a prefix derived
  from the port's class name): nothing fails on a wrong one, but it is a value no Flash reference
  will ever match. When a port class keeps Nitro's name for a Flash event
  (`RoomWidgetUpdateRoomObjectEvent` for `RoomWidgetRoomObjectUpdateEvent`), pair it in `known.PAIRED`.
- A new hand-carried table gets a row above and a check in `scripts/drift` in the same change.
  Data with no check is data that will drift.
- Refresh Nitro Studio's gamedata after a revision bump - scan habbo.com, import Hotel data and
  Changed texts, and import the client release's categories (Client data, Chat styles, Renderer
  assets, Avatar tables): `config_keys.py` and `localization_keys.py` read
  its workspace's gamedata, and say so when it is missing.
- **The avatar data is loaded, not compiled in.** `useAvatarLoader` reads `avatar.data.url` with the
  renderer's `LoadAvatarData` and starts the avatar manager from it (`init(data)`) before the figure
  map, effect map and figure data; `init` applies the baked-in `HabboAvatarActionsDefault` first and
  the hotel's actions over it, which is Flash's `initActions` then `updateActions`. After a revision
  bump, import Client data and Hotel data in Nitro Studio and publish - the renderer does not change.
- Theme skin art is cut from the Flash skin bitmap along its skin XML's entities (`habbo_skin_*_xml`
  in `flash-js-resources/habbo-window-manager-com`), one image per entity that moves or stretches
  on its own - the
  `dropmenu` arrow was once baked into its frame, and stretched with it. Rebuild the bundles
  (`yarn build-asset-bundles` in nitro-react) after adding or replacing one.
- An entity marked `colorize="false"` is one `BitmapSkinRenderer.draw` copies *without* the
  window's colour, so it never goes into a sheet the theme tints. Where only some of a layout's
  entities carry the flag, `extract-skin-assets.ts`'s `plainOverlay` cuts them out - `'sheet'` for
  a same-size `-plain` sheet, `'pieces'` for one PNG per entity when the layout moves or centres
  it - and the variant draws them as an untinted `overlay` (`ThemeWithStatesVariant.overlays`), or
  as `plain` where it needs all three at once, as the ubuntu frames do: a tinted title bar, the
  pale body under it and a shine over both. A skin with no job at all loses those pieces entirely
  rather than mistinting them - `habbo_skin_frame_3` and `_7` had none, so every style 3, 4 and 7
  window shipped a title bar with no sides or bottom, and the drift suite's own check passed
  because the variant's shine already satisfied "has an untinted layer";
  `exclude` does the same for a *colorizing* entity a nine-slice cannot carry. Where **every**
  entity carries it the skin is simply never tinted: the variant says `colorize: false`
  (`ThemeBase`, honoured by `useThemeVariant`), and a `tintColor` a call site passes is dropped
  too - that is what stopped the wired dialog's `_frame.color = style.frameColor` from darkening
  the light frame Flash leaves alone. `theme_skin.py` holds every row with untintable entities to
  one of those two shapes and reads the pixels back to prove it.
- An entity's `<scale>` says how the client *re-places* it, not only how it resizes: only `strech`
  and `tiled` resize, while `move` follows the right/bottom edge and `center` sits in the middle of
  the **rendered** window. A sheet is one size, so a `center` entity cut at its layout rect is
  wrong everywhere - the segmented picker's side gradient landed on its rounded bottom corner and
  squared it off, in the face's own colour, so it looked right until the picker tinted the selected
  segment. The extractor now throws on that: either `exclude` it and let the theme centre the piece
  (`CompositePiece`'s `alignSelf`), or `centeredInSheet` to keep it in the sheet centred for the
  sheet's own size. Check a skin change against the client **with a tint applied** - an untinted
  screenshot hides every tint-dependent defect, which is how this one survived a screenshot that
  passed.
- "No drift." only covers what the checks look at. When asked to look for drift, run the suite
  and then ask what it cannot see - that is where the wire format findings came from, in a tree
  the suite had just passed. A blind spot that is found becomes a check, not a one-off fix.
