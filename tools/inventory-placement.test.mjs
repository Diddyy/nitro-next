/**
 * `FurniModel.requestSelectedFurniPlacement` / `onObjectPlaced` / `attemptPlaceNextFurni`: placing a
 * furni from the inventory goes on with the next one of the stack, and the window only comes back
 * when the stack is used up, the drop placed nothing, or the next one cannot be placed.
 *
 * Runs the real command and group modules with the room, the window layer and the packets stubbed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

const load = (path, dependencies = {}) => {
    const source = readFileSync(new URL(`../packages/${path}.ts`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const exports = {};

    runInNewContext(outputText, { exports, require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);

        return dependencies[name];
    }, Math, Array, Object, Number, parseInt });

    return exports;
};

class MapDataType {}

const group = load('nitro-react/src/context/inventory/store/InventoryFurniGroup', {
    '@nitrodevco/nitro-api': { MapDataType },
    '@nitrodevco/nitro-packets': { TradeRequirementNodeType: {}, TradeRequirementType: {} },
});

const POST_IT = 5;
const FLOOR = 1;
const WALLPAPER = 2;

const stuff = (legacy = '') => ({ getLegacyString: () => legacy });
const item = (id, extra = {}) => ({ id, ref: id, typeId: 7, category: 0, isWallItem: false, stuffData: stuff(), extra: 0, groupable: true, tradeable: true, recyclable: false, sellable: false, isRented: false, flatId: -1, locked: false, ...extra });

/** A room, a window layer and an inventory store, enough for the commands to run against. */
const world = (groups, selectedId) => {
    const log = { started: [], cancelled: 0, shown: 0, hidden: 0, sent: [] };
    const state = {
        furniGroups: groups,
        furniSelectedGroupId: selectedId,
        inventoryMoverRequested: false,
        inventoryMoverItemId: -1,
        setInventoryMoverRequested: (value) => { state.inventoryMoverRequested = value; },
        setInventoryMoverItemId: (value) => { state.inventoryMoverItemId = value; },
    };
    const commands = load('nitro-react/src/commands/inventoryCommands', {
        '@nitrodevco/nitro-api': { RoomObjectCategoryEnum: { Floor: 10, Wall: 20 }, RoomObjectPlacementSource: { INVENTORY: 'inventory' }, RoomEngineObjectPlacedEvent: class {} },
        '@nitrodevco/nitro-packets': {
            RequestFurniInventoryComposer: class {},
            RequestFurniInventoryWhenNotInRoomComposer: class {},
            RequestRoomPropertySetComposer: class { constructor(data) { this.data = data; } },
        },
        '#base/context/communication': {},
        '#base/context/inventory': { ...group, inventoryStore: { getState: () => state } },
        '#base/context/room': { getRoom: () => ({}) },
        '#base/context/system': { systemStore: { getState: () => ({ hideWindow: (name) => { assert.equal(name, 'inventory'); log.hidden++; }, showWindow: (name) => { assert.equal(name, 'inventory'); log.shown++; } }) } },
        '#base/context/wired-trading': { wiredTradingStore: { getState: () => ({}) } },
        './catalogPlacementCommands': {
            initializeRoomObjectInsert: (source, id, category) => { log.started.push({ source, id, category }); return true; },
            cancelRoomObjectInsert: () => { log.cancelled++; },
        },
        './inventoryTradingCommands': {},
        './wiredTradingCommands': {},
    });
    const placed = (objectId, flags = {}) => commands.onInventoryObjectPlaced({ objectId, placedInRoom: true, placedOnFloor: true, placedOnWall: false, ...flags });

    return { commands, state, log, placed, send: (message) => log.sent.push(message) };
};

const stack = (...items) => ({ id: 1, typeId: 7, category: 0, stuffData: stuff(), extra: 0, items, hasUnseenItems: false });
const startedIds = (w) => w.log.started.map(x => x.id);

await test('the next furni of a stack is chosen below the one just placed, skipping locked ones', () => {
    const g = stack(item(1), item(2, { locked: true }), item(3));

    assert.equal(group.findNextInventoryFurniToPlace(g, 3)?.id, 1);
    assert.equal(group.findNextInventoryFurniToPlace(g, 1), undefined);
    assert.equal(group.findNextInventoryFurniToPlace(g, 99), undefined);
    assert.equal(group.findNextInventoryFurniToPlace(stack(item(1), item(2)), 2)?.id, 1);
});

await test('a stack is placed one after the other, and the window comes back after the last', () => {
    const w = world([stack(item(1), item(2), item(3))], 1);

    assert.equal(w.commands.requestSelectedFurniPlacement(w.send), true);
    assert.deepEqual(startedIds(w), [3], 'the last item first, as GroupItem.peek');
    assert.equal(w.log.hidden, 1);

    w.placed(3);
    assert.deepEqual(startedIds(w), [3, 2], 'the next one is in the mover at once');
    assert.equal(w.log.shown, 0, 'the window stays away between placements');

    // The server removes what was placed; the next drop finds the group shorter.
    w.state.furniGroups = [stack(item(1), item(2))];
    w.placed(2);
    assert.deepEqual(startedIds(w), [3, 2, 1]);
    assert.equal(w.log.shown, 0);

    w.state.furniGroups = [stack(item(1))];
    w.placed(1);
    assert.deepEqual(startedIds(w), [3, 2, 1], 'nothing left to place');
    assert.equal(w.log.shown, 1, 'the window comes back once the stack is used up');
    assert.equal(w.log.cancelled, 1);
    assert.equal(w.state.inventoryMoverRequested, false);
    assert.equal(w.state.inventoryMoverItemId, -1);
});

await test('a single furni is placed once and the window comes back', () => {
    const w = world([stack(item(5))], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(5);

    assert.deepEqual(startedIds(w), [5]);
    assert.equal(w.log.shown, 1);
});

await test('items locked in a trade are not placed, and a stack that is only locked cannot be started', () => {
    const w = world([stack(item(1), item(2, { locked: true }), item(3))], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(3);

    assert.deepEqual(startedIds(w), [3, 1], 'the locked item is stepped over');

    const locked = world([stack(item(1, { locked: true }))], 1);

    assert.equal(locked.commands.requestSelectedFurniPlacement(locked.send), false);
    assert.deepEqual(startedIds(locked), []);
});

await test('a drop that placed nothing brings the window back and cancels the ghost', () => {
    const w = world([stack(item(1), item(2))], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(2, { placedInRoom: false });

    assert.deepEqual(startedIds(w), [2], 'no next furni is started');
    assert.equal(w.log.shown, 1);
    assert.equal(w.log.cancelled, 1);
    assert.equal(w.state.inventoryMoverRequested, false);
});

await test('a furni placed on a wall continues the stack the same way', () => {
    const w = world([stack(item(1, { isWallItem: true }), item(2, { isWallItem: true }))], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(-2, { placedOnFloor: false, placedOnWall: true });

    assert.deepEqual(startedIds(w), [2, 1]);
    assert.equal(w.log.started[0].category, 20, 'wall items are placed on the wall');
});

await test('something other than the item the page started with is left alone, as in Flash', () => {
    const w = world([stack(item(1), item(2))], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(999);

    assert.deepEqual(startedIds(w), [2]);
    assert.equal(w.log.shown, 0);
    assert.equal(w.state.inventoryMoverRequested, false, 'the flag is spent either way');
});

await test('a rented furni already standing in a room is not continued into', () => {
    const w = world([stack(item(1, { isRented: true, flatId: 12 }), item(2))], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(2);

    assert.deepEqual(startedIds(w), [2]);
    assert.equal(w.log.shown, 1);
});

await test('a pet or a bot placement only brings the window back', () => {
    const w = world([], -1);

    w.commands.hideInventoryForPlacement();
    assert.equal(w.state.inventoryMoverItemId, -1);

    w.placed(42);

    assert.deepEqual(startedIds(w), []);
    assert.equal(w.log.shown, 1);
    assert.equal(w.state.inventoryMoverRequested, false);
});

await test('nothing happens when the inventory did not start the placement', () => {
    const w = world([stack(item(1), item(2))], 1);

    w.placed(2);

    assert.deepEqual(startedIds(w), []);
    assert.equal(w.log.shown, 0);
    assert.equal(w.log.cancelled, 0);
});

await test('a post-it group places its first sheet again while more than one is left', () => {
    const sheets = (n) => ({ ...stack(item(1, { category: POST_IT, stuffData: stuff(String(n)) })), category: POST_IT });
    const w = world([sheets(3)], 1);

    w.commands.requestSelectedFurniPlacement(w.send);
    w.placed(1);

    assert.deepEqual(startedIds(w), [1, 1]);

    const last = world([sheets(1)], 1);

    last.commands.requestSelectedFurniPlacement(last.send);
    last.placed(1);

    assert.deepEqual(startedIds(last), [1]);
    assert.equal(last.log.shown, 1);
});

await test('a room paper is applied, not placed, and a double click does not apply it', () => {
    const paper = stack(item(9, { category: WALLPAPER }));
    const w = world([paper], 1);

    assert.equal(w.commands.requestSelectedFurniPlacement(w.send, true), false);
    assert.equal(w.commands.requestSelectedFurniPlacement(w.send, false), true);
    assert.equal(w.log.sent.length, 1);
    assert.deepEqual(startedIds(w), []);
    assert.equal(FLOOR, 1);
});
