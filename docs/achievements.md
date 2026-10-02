# Achievement client

The server owns progression, awards, balances and badge entitlements. The client requests
the ordered catalog once per authenticated session and receives changes through the standard
achievement packets. It sends no progress or reward claims.

The progression toolbar menu opens the Pixi browser. Client links use
`questengine/achievements` or `questengine/achievements/<category>`. Receiving a catalog
without an open request does not open a window. The browser shows server categories in their
received order, with miscellaneous entries last, then archive. The configured new and
room-controlled categories are available through category links. Disabled entries are hidden. Room-controlled entries require
their `WF_` code to be enabled by the current room's Wired environment.

The packet contracts follow AS3 `AchievementData`, `AchievementsMessageParser`,
`AchievementMessageParser` and `AchievementLevelUpData`. Limits and current points on the wire
are cumulative; the presentation subtracts `scoreAtStartOfLevel`. The reported level is the
current target until `finalLevel` is true. Earned levels and achievement score are separate.
The selected achievement fills its completed bar when the next level arrives and switches to
the latest queued update after two seconds. Closing the window clears unseen IDs. Disconnects
and account changes clear the cache, presentation receipts and pending transitions.

Hotel settings:

| Setting or asset | Purpose |
| --- | --- |
| `achievements.new` | Comma-separated badge base codes included in the new category |
| `toolbar.unseen_notification.skipped_badge_ids` | Badge substrings excluded from the unseen indicator |
| `badge.asset.url` | Badge URL template containing `%badgename%` |
| `quests.<category>.name` | Category label |
| `badge_name_<badge>` and `badge_desc_<badge>` | Badge label and description; base-code fallback is supported |
| `BadgePointLimitsEventMessage` | Description `%limit%` values for the hotel catalog |
| `currencyiconstyle.<size>.<type>` | Hotel-specific activity reward icons |

Custom achievements need their hotel badge images and texts. Standard questing assets provide
tile backgrounds. Congratulations are queued only when the server's dialog flag is set;
corner notifications remain available for awards with that flag unset. Repeated achievement
ID/level notifications are presented once per session. Activity rewards use their actual type
for the currency icon. Wallet balances continue to arrive through the wallet handlers.

`registerAchievementHandlers` coordinates achievement badge additions and notifications.
After a badge entitlement changes, the server must publish the authoritative badge directory
and worn badges. The award packet alone cannot determine whether the replaced badge still has
an independent manual entitlement, so the client does not infer its removal.

Run `node --test tools/achievements.test.mjs` for typed packet fixtures, cumulative offsets,
final levels, categories, unseen exclusions, replay, session reset and transition scheduling.
`tools/fixtures/achievements.json` contains portable `[type, value]` packet fixtures for backend
and client checks. UI fixture checks do not establish pixel parity or prove a live Turbo
exchange; those require a running Turbo instance and a fresh dedicated-account SSO ticket.
