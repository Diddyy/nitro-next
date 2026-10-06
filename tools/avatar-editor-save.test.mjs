/**
 * The avatar editor's "Save changes": `AvatarEditorView.windowEventProc` saves the look with
 * `saveCurrentSelection()` and then closes the editor (`manager.close`). The editor is a React
 * component, so this reads its source to check the order.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../packages/nitro-react/src/views/avatar-editor/AvatarEditor.tsx', import.meta.url), 'utf8');

await test('saving your own look sends it and then closes the editor', () => {
    const save = source.slice(source.indexOf('const saveFigure'));
    const own = save.slice(0, save.indexOf('return;'));
    const send = own.indexOf('new UpdateFigureDataComposer');
    const hide = own.indexOf('hide()');

    assert.ok(send > -1, 'the look is sent');
    assert.ok(hide > send, 'the editor closes after the look is sent');
});
