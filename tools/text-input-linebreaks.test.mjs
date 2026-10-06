/**
 * A multiline `TextInput` keeps its value in a hidden `<textarea>`, which holds line breaks as `\n`,
 * and measures its caret and selection with the Flash text layout, which breaks lines on `\n` only
 * (`layoutFlashTextBlock`). The floor plan editor's map text uses Flash's `\r`; unnormalised it never
 * equalled the native value and was measured as one long line, so the caret and the selection
 * landed away from the glyphs Pixi drew on separate lines.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../packages/${path}`, import.meta.url), 'utf8');

await test('the flash text layout breaks lines on \\n only', () => {
    assert.match(read('nitro-theme/src/font/flash-text/flashTextBlock.ts'), /text\.indexOf\('\\n', paragraphStart\)/);
});

await test('a multiline text input turns \\r and \\r\\n into \\n before it uses the value', () => {
    const source = read('nitro-theme/src/TextInput.tsx');
    const normalise = source.match(/const value = multiline \? rawValue\.replace\((\/.+?\/g), '\\n'\) : rawValue;/);

    assert.ok(normalise, 'the value is normalised for a multiline field');

    const pattern = new RegExp(normalise[1].slice(1, -2), 'g');

    assert.equal('xx\rxx\r'.replace(pattern, '\n'), 'xx\nxx\n');
    assert.equal('a\r\nb\rc\nd'.replace(pattern, '\n'), 'a\nb\nc\nd');
    assert.ok(source.indexOf('const value =') < source.indexOf('useState(false)'), 'before anything reads it');
});
