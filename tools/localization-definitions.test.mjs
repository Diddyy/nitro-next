/**
 * `:lang <name>` - `HabboLocalizationManager.configureLocalizationLocations` and
 * `CoreLocalizationManager.activateLocalizationDefinition` / `loadLocalizationFromURL`
 * (`nitro-react/src/commands/localizationCommands.ts`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

const transpile = url => ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const localizationData = {};

runInNewContext(transpile(new URL('../packages/nitro-react/src/utils/localizationData.ts', import.meta.url)), { exports: localizationData });

const state = { config: {}, localizations: { a: 'old a', b: 'old b' } };

state.setLocalization = (localizations) => {
    state.localizations = { ...state.localizations, ...localizations };
};

const responses = new Map();
const requested = [];

const fetch = (url) => {
    requested.push(url);

    const body = responses.get(url);

    if (body === undefined) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });

    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });
};

const errors = [];
const commands = {};
const stubs = {
    '@nitrodevco/nitro-api': { NitroLogger: { error: (...args) => errors.push(args), log: () => {} } },
    '#base/context/system': { systemStore: { getState: () => state } },
    '#base/utils': localizationData,
};

runInNewContext(transpile(new URL('../packages/nitro-react/src/commands/localizationCommands.ts', import.meta.url)), {
    exports: commands,
    fetch,
    require: (name) => {
        assert.ok(stubs[name], `Unexpected dependency: ${name}`);

        return stubs[name];
    },
});

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const hashes = (textsUrl, hash) => JSON.stringify({ hashes: [
    { name: 'external_texts', url: textsUrl, hash },
    { name: 'external_variables', url: 'https://hotel/gamedata/external_variables', hash: 'v' },
    { name: 'furnidata', url: 'https://hotel/gamedata/furnidata_xml', hash: 'f' },
    { name: 'productdata', url: 'https://hotel/gamedata/productdata', hash: 'p' },
] });

state.config = {
    'localization.1': 'en',
    'localization.1.code': 'en_US.iso-8859-1',
    'localization.1.name': 'English (COM)',
    'localization.1.url': 'https://en/gamedata/hashes',
    'localization.2': 'de',
    'localization.2.code': 'de_DE.iso-8859-1',
    'localization.2.name': 'German',
    'localization.2.url': 'https://de/gamedata/hashes',
    'localization.3': 'de',
    'localization.3.code': 'de_CH.iso-8859-1',
    'localization.3.name': 'German (CH)',
    'localization.3.url': 'https://ch/gamedata/hashes',
    // A gap ends the list: localization.4 is missing.
    'localization.5': 'fi',
    'localization.5.code': 'fi_FI.iso-8859-1',
    'localization.5.name': 'Finnish',
    'localization.5.url': 'https://fi/gamedata/hashes',
};

await test('definitions are read from localization.<n> until one is missing; a repeated name keeps the first', () => {
    const definitions = commands.getLocalizationDefinitions();

    assert.deepEqual([ ...definitions.keys() ], [ 'en', 'de' ]);
    assert.deepEqual({ ...definitions.get('de') }, { languageCode: 'de', countryCode: 'DE', encoding: 'iso-8859-1', name: 'German', url: 'https://de/gamedata/hashes' });
});

await test('an unknown name is not activated and loads nothing', async () => {
    requested.length = 0;

    assert.equal(commands.activateLocalizationDefinition('fi'), false);
    assert.equal(commands.activateLocalizationDefinition('xx'), false);

    await settle();

    assert.deepEqual(requested, []);
});

await test('activating reads the hashes, loads <external_texts url>/<hash> and lays it over the texts', async () => {
    responses.set('https://de/gamedata/hashes', hashes('https://de/gamedata/external_texts', 'abc'));
    responses.set('https://de/gamedata/external_texts/abc', '# comment\na = neu a\nc=x=y\\nz\nb=\n');
    requested.length = 0;

    assert.equal(commands.activateLocalizationDefinition('de'), true);

    await settle();

    assert.deepEqual(requested, [ 'https://de/gamedata/hashes', 'https://de/gamedata/external_texts/abc' ]);
    // `b` is empty in the new file, which Flash does not store, so the old text stays.
    assert.deepEqual({ ...state.localizations }, { a: 'neu a', b: 'old b', c: 'x=y\nz' });
});

await test('hashes without all four resources load no texts', async () => {
    responses.set('https://en/gamedata/hashes', JSON.stringify({ hashes: [ { name: 'external_texts', url: 'https://en/texts', hash: 'h' } ] }));
    requested.length = 0;
    errors.length = 0;

    assert.equal(commands.activateLocalizationDefinition('en'), true);

    await settle();

    assert.deepEqual(requested, [ 'https://en/gamedata/hashes' ]);
    assert.equal(errors.length, 1);
    assert.equal(state.localizations.a, 'neu a');
});

await test('texts that fail are asked for once more; an HTML page is not taken as texts', async () => {
    responses.set('https://en/gamedata/hashes', hashes('https://en/gamedata/external_texts', 'h'));
    responses.set('https://en/gamedata/external_texts/h', '<!DOCTYPE html><html></html>');
    requested.length = 0;

    commands.activateLocalizationDefinition('en');

    await settle();

    assert.equal(state.localizations.a, 'neu a');

    responses.delete('https://en/gamedata/external_texts/h');
    requested.length = 0;

    commands.activateLocalizationDefinition('en');

    await settle();

    assert.deepEqual(requested, [ 'https://en/gamedata/hashes', 'https://en/gamedata/external_texts/h', 'https://en/gamedata/external_texts/h' ]);
});
