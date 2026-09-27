# Wired (`src/wired`, `views/wired-*`)

The port of `com/sulake/habbo/roomevents/**`. A Flash element is a stateful widget tree; here it
is two files:

- `src/wired/elements/<holder>/<Name>.ts` - the **definition** (`WiredElementDefinition<Form>`,
  contract in `src/wired/WiredElement.ts`): `createForm` is `onEditStart`, `readIntParams` /
  `readStringParam` / `readVariableIds` are `read*FromForm`, pure functions of the form. Keep
  Flash's param order, magic numbers and `'n'` (`WIRED_VARIABLE_ID_NONE`) where Flash names it.
- `src/views/wired-setup/elements/<holder>/<Name>View.tsx` - `buildInputs`, drawn with the wired
  kit (`views/wired-setup/kit`, styled by `src/wired/styles`). None for `INPUTS_TYPE_NONE`.
- Register the pair in `<holder>Elements.ts` in Flash's push order. `src/wired` is pure `.ts`
  (barrel `#base/wired`); the `*Elements.ts` files import views and stay out of the barrel.

What a definition cannot compute from the triggerable comes through `WiredElementContext`
(`ctx`): config, localization, permissions, the user's groups, the room's achievements, and
`elementMemory` - the element fields Flash keeps between edits (a grown option list, a captured
figure, the last time zone), written through the definition's `rememberOnEdit` /
`rememberOnRead` into `WiredElementMemorySlice`. Never keep that state in a module variable.

Stores: `context/wired` (`wiredStore`: the setup session, clipboard, variables synchronizer,
environment, preferences, element memory, and the wired menu's slices) and
`context/wired-trading` (chests, contracts, the wired trade, transactions, rewards). Both are
singletons; `resetRoom` clears only what Flash drops with the room. The dialog's controller is
`commands/wiredCommands.ts` (`UserDefinedRoomEventsCtrl`), the menu's `wiredMenuCommands.ts`.
