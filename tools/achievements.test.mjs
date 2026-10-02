/** AS3 achievement wire, cumulative presentation and session lifecycle regressions. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';
import { createStore } from 'zustand';

const load = (path, dependencies = {}, globals = {}) => {
    const source = readFileSync(new URL(`../packages/${path}.ts`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const exports = {};

    runInNewContext(outputText, { ...globals, exports, require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);

        return dependencies[name];
    } });

    return exports;
};
const model = load('nitro-react/src/context/achievements/store/achievementModel');
const { createAchievementsStore } = load('nitro-react/src/context/achievements/store/AchievementsStore', { zustand: { createStore }, './achievementModel': model });
const parser = load('nitro-packets/src/incoming/Data/AchievementParser');
const { AchievementsEventMessage } = load('nitro-packets/src/incoming/Inventory/Achievements/AchievementsEventMessage', { '../../Data/AchievementParser': parser });
const { AchievementEventMessage } = load('nitro-packets/src/incoming/Inventory/Achievements/AchievementEventMessage', { '../../Data/AchievementParser': parser });
const { AchievementsScoreEventMessage } = load('nitro-packets/src/incoming/Inventory/Achievements/AchievementsScoreEventMessage');
const { AchievementLevelUpDataParser } = load('nitro-packets/src/incoming/Notifications/Data/AchievementLevelUpDataParser');
const plain = value => JSON.parse(JSON.stringify(value));
const achievement = (overrides = {}) => ({ achievementId: 1001, level: 3, badgeId: 'ACH_Login3', scoreAtStartOfLevel: 2, field_V1O: 5, field_EX: 3, finalLevel: false, category: 'identity', subCategory: '', levelRewardPoints: 0, levelRewardPointType: 0, levelCount: 20, displayMethod: 0, state: 1, code: 'Login', ...overrides });
const fixture = JSON.parse(readFileSync(new URL('./fixtures/achievements.json', import.meta.url), 'utf8'));
const record = fixture.achievement;
const wrapper = (fields) => {
    let index = 0;
    const read = (type) => {
        assert.ok(index < fields.length, 'read past fixture');
        const [ expected, value ] = fields[index++];

        assert.equal(type, expected, `field ${index}`);

        return value;
    };

    return { readInt: () => read('Int'), readString: () => read('String'), readBoolean: () => read('Boolean'), readShort: () => read('Short'), complete: () => assert.equal(index, fields.length) };
};

await test('initialization requests authoritative badge limits and catalog once per session', () => {
    const store = createAchievementsStore();
    class GetAchievementsComposer {}
    class GetBadgePointLimitsComposer {}
    const { requestAchievements } = load('nitro-react/src/commands/achievementCommands', {
        '@nitrodevco/nitro-packets': { GetAchievementsComposer, GetBadgePointLimitsComposer },
        '#base/context/achievements': { achievementsStore: store },
        '#base/context/system': {}, '#base/context/wired': {},
    });
    const sent = [];
    const send = packet => sent.push(packet.constructor.name);

    requestAchievements(send);
    requestAchievements(send);
    assert.deepEqual(sent, [ 'GetBadgePointLimitsComposer', 'GetAchievementsComposer' ]);
    store.getState().reset();
    requestAchievements(send);
    assert.equal(sent.length, 4);
});

await test('list and update consume complete AS3 records including short state and category tail', () => {
    const list = wrapper([ [ 'Int', 2 ], ...record, ...record, [ 'String', 'identity' ] ]);
    const result = new AchievementsEventMessage().parse(list);

    assert.equal(result.achievements.length, 2);
    assert.equal(result.defaultCategory, 'identity');
    assert.deepEqual(plain(result.achievements[0]), achievement());
    list.complete();
    const update = wrapper(record);

    assert.deepEqual(plain(new AchievementEventMessage().parse(update).achievement), achievement());
    update.complete();
});

await test('score and all fourteen notification fields retain correct types and reward kind', () => {
    const score = wrapper([ [ 'Int', 900 ] ]);

    assert.equal(new AchievementsScoreEventMessage().parse(score).score, 900);
    score.complete();
    const fields = fixture.notification;
    const notification = wrapper(fields);
    const result = AchievementLevelUpDataParser(notification);

    assert.equal(result.levelRewardPointType, 5);
    assert.equal(result.showDialogToUser, false);
    assert.equal(result.badgeRarityId, 8);
    notification.complete();
});

await test('offsets describe in-level progress; final target counts as earned', () => {
    assert.deepEqual(plain(model.achievementProgress(achievement())), { current: 1, limit: 3, earned: 2 });
    assert.equal(model.achievementProgress(achievement({ finalLevel: true })).earned, 3);
    assert.equal(model.achievedBadgeCode(achievement()), 'ACH_Login2');
    assert.equal(model.achievedBadgeCode(achievement({ finalLevel: true })), 'ACH_Login3');
});

await test('a zero first threshold has finite empty progress before authoritative attainment', () => {
    const progress = model.achievementProgress(achievement({ level: 1, badgeId: 'ACH_VipHC1', scoreAtStartOfLevel: 0, field_V1O: 0, field_EX: 0, levelCount: 5 }));

    assert.deepEqual(plain(progress), { current: 0, limit: 1, earned: 0 });
    assert.ok(Number.isFinite(progress.current / progress.limit));
});

await test('higher edited thresholds clamp display progress while preserving earned levels', () => {
    const revised = achievement({ level: 4, badgeId: 'ACH_PetLevelUp4', scoreAtStartOfLevel: 20, field_V1O: 30, field_EX: 3 });

    assert.deepEqual(plain(model.achievementProgress(revised)), { current: 0, limit: 10, earned: 3 });
    assert.equal(model.achievedBadgeCode(revised), 'ACH_PetLevelUp3');
    const store = createAchievementsStore();

    store.getState().setScore(30);
    store.getState().setList([ revised ], 'pets');
    assert.equal(store.getState().score, 30);
    assert.equal(store.getState().achievements[0].level, 4);
});

await test('category order, archive, new configuration and room-controlled filtering', () => {
    const categories = model.achievementCategories([
        achievement({ category: 'misc' }), achievement({ category: 'social' }),
        achievement({ category: 'pets', state: 2 }), achievement({ category: 'identity', state: 0 }),
        achievement({ category: 'identity', state: 4 }), achievement({ category: 'wired_games', state: 4 }),
    ], [ 'Login' ]);

    assert.deepEqual(plain(categories.map(entry => entry.code)), [ 'social', 'misc', 'archive', 'wired_games', 'new' ]);
    assert.equal(categories.find(entry => entry.code === 'archive').achievements[0].category, 'pets');
});

await test('requests only once per session and cache reset allows another request', () => {
    const store = createAchievementsStore();

    assert.equal(store.getState().request(), true);
    assert.equal(store.getState().request(), false);
    store.getState().setList([ achievement() ], 'identity');
    assert.equal(store.getState().request(), false);
    store.getState().reset();
    assert.equal(store.getState().request(), true);
});

await test('selected crossed level fills its old bar and queues latest progress until transition', () => {
    const store = createAchievementsStore();

    store.getState().setList([ achievement() ], 'identity');
    assert.equal(store.getState().update(achievement({ level: 4, field_EX: 5 }), true, []), true);
    assert.equal(store.getState().achievements[0].field_EX, 5);
    assert.equal(store.getState().achievements[0].level, 3);
    assert.equal(store.getState().update(achievement({ level: 4, field_EX: 6 }), true, []), false);
    store.getState().finishTransition();
    assert.equal(store.getState().achievements[0].level, 4);
    assert.equal(store.getState().achievements[0].field_EX, 6);
    assert.equal(store.getState().pending, undefined);
});

await test('stale updates do not replace earned progress or queued progress', () => {
    const store = createAchievementsStore();

    store.getState().setList([ achievement() ], 'identity');
    store.getState().update(achievement({ level: 4, field_EX: 5 }), true, []);
    store.getState().update(achievement({ level: 2, field_EX: 2 }), true, []);
    store.getState().finishTransition();
    assert.equal(store.getState().achievements[0].level, 4);
});

await test('unseen IDs deduplicate, exclusions apply and close clears them', () => {
    const store = createAchievementsStore();

    store.getState().setList([ achievement() ], 'identity');
    store.getState().update(achievement({ field_EX: 4 }), false, []);
    store.getState().update(achievement({ field_EX: 4 }), false, []);
    assert.deepEqual(plain(store.getState().unseen), [ 1001 ]);
    store.getState().close();
    store.getState().update(achievement({ field_EX: 5 }), false, [ 'Login' ]);
    assert.equal(store.getState().unseen.length, 0);
});

await test('dialog flags and repeated notifications deduplicate independently of score', () => {
    const store = createAchievementsStore();
    const award = { achievementID: 1001, level: 1, showDialogToUser: false };

    assert.equal(store.getState().present(award), true);
    assert.equal(store.getState().present(award), false);
    assert.equal(store.getState().congratulations.length, 0);
    store.getState().present({ ...award, level: 2, showDialogToUser: true });
    assert.equal(store.getState().congratulations.length, 1);
    store.getState().setScore(20);
    assert.equal(store.getState().score, 20);
    store.getState().dismissCongratulations();
    assert.equal(store.getState().congratulations.length, 0);
    store.getState().reset();
    assert.equal(store.getState().present(award), true);
    assert.equal(store.getState().score, 0);
});

await test('account reset discards pending level transition, cache and unseen IDs', () => {
    const store = createAchievementsStore();

    store.getState().setList([ achievement() ], 'identity');
    store.getState().update(achievement({ level: 4, field_EX: 5 }), true, []);
    store.getState().reset();
    store.getState().finishTransition();
    assert.equal(store.getState().pending, undefined);
    assert.equal(store.getState().achievements.length, 0);
    assert.equal(store.getState().unseen.length, 0);
});

await test('shared final-level fixture retains cumulative boundaries and final target', () => {
    const input = wrapper(fixture.finalAchievement);
    const value = new AchievementEventMessage().parse(input).achievement;

    assert.equal(value.level, 20);
    assert.equal(value.finalLevel, true);
    assert.equal(model.achievementProgress(value).earned, 20);
    input.complete();
});

await test('wired achievements require the room-enabler binding', () => {
    assert.equal(model.achievementVisibleInRoom(achievement({ category: 'wired_games', code: 'WF_Custom' }), []), false);
    assert.equal(model.achievementVisibleInRoom(achievement({ category: 'wired_games', code: 'WF_Custom' }), [ 'Custom' ]), true);
    assert.equal(model.achievementVisibleInRoom(achievement(), []), true);
});

await test('handler list never opens a window, transition waits 2000ms and disconnect cancels work', () => {
    const store = createAchievementsStore();
    const packets = { AchievementEventMessage, AchievementsEventMessage, AchievementsScoreEventMessage, HabboAchievementNotificationMessage: class {}, UserObjectMessage: class {} };
    const listeners = new Map();
    const timers = new Map();
    const system = { config: {}, visibleWindows: {}, hideWindow: (name) => {
        delete system.visibleWindows[name];
    }, getLocalizationValue: key => key };
    const badges = [];
    const notifications = [];
    let nextTimer = 0;
    let requests = 0;
    const { registerAchievementHandlers } = load('nitro-react/src/handlers/achievements/registerAchievementHandlers', {
        '@nitrodevco/nitro-packets': packets,
        '#base/commands': { requestAchievements: () => { if (store.getState().request()) requests++; } },
        '#base/context/achievements': { achievementsStore: store },
        '#base/context/inventory': { inventoryStore: { getState: () => ({ updateBadge: badge => badges.push(badge), wornBadgeCodes: [] }) } },
        '#base/context/notifications': { notificationStore: { getState: () => ({ addNotification: (...args) => notifications.push(args) }) } },
        '#base/context/system': { systemStore: { getState: () => system } },
        '#base/context/wired': { wiredStore: { getState: () => ({ wiredAchievements: [] }) } },
        '#base/utils': { getBadgeName: (_t, code) => code },
        '../packetSubscriptions': { on: (packet, handler) => ({ packet, handler }), subscribeAll: (subscribe, subscriptions) => {
            const stops = subscriptions.map(({ packet, handler }) => subscribe(packet, handler));

            return () => stops.forEach(stop => stop());
        } },
    }, {
        setTimeout: (callback, delay) => {
            const id = ++nextTimer;

            timers.set(id, { callback, delay });

            return id;
        },
        clearTimeout: id => timers.delete(id),
    });
    const unsubscribe = registerAchievementHandlers({ send: () => {}, subscribe: (packet, handler) => {
        listeners.set(packet, handler);

        return () => listeners.delete(packet);
    } });
    listeners.get(packets.AchievementsScoreEventMessage)({ score: 120 });
    listeners.get(packets.UserObjectMessage)({ userInfo: { userId: 1 } });
    assert.equal(requests, 1);
    assert.equal(store.getState().score, 120);
    listeners.get(packets.UserObjectMessage)({ userInfo: { userId: 1 } });
    assert.equal(requests, 1);
    listeners.get(packets.AchievementsEventMessage)({ achievements: [ achievement() ], defaultCategory: 'identity' });
    assert.equal(system.visibleWindows.achievements, undefined);
    system.visibleWindows.achievements = {};
    listeners.get(packets.AchievementEventMessage)({ achievement: achievement({ level: 4, field_EX: 5 }) });
    assert.equal(timers.size, 1);
    const timer = Array.from(timers.values())[0];
    assert.equal(timer.delay, 2000);
    assert.equal(store.getState().achievements[0].level, 3);
    timer.callback();
    assert.equal(store.getState().achievements[0].level, 4);
    const award = { achievementID: 1001, level: 4, badgeCode: 'ACH_Login4', showDialogToUser: true };
    listeners.get(packets.HabboAchievementNotificationMessage)({ data: award });
    listeners.get(packets.HabboAchievementNotificationMessage)({ data: award });
    assert.equal(badges.length, 1);
    assert.equal(notifications.length, 1);
    assert.equal(store.getState().congratulations.length, 1);
    listeners.get(packets.UserObjectMessage)({ userInfo: { userId: 2 } });
    assert.equal(store.getState().score, 0);
    assert.equal(store.getState().congratulations.length, 0);
    assert.equal(requests, 2);
    unsubscribe();
    assert.equal(timers.size, 0);
    assert.equal(listeners.size, 0);
    assert.equal(store.getState().loaded, false);
    assert.equal(system.visibleWindows.achievements, undefined);
});
