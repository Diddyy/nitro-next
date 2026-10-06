/**
 * Window template layout (`nitro-theme/src/template/templateLayout.ts`) against the AS3 it ports:
 * `WindowController` (`setRectangle`, `update`, `_Str_10618`, `_Str_14067`, `_Str_9294`),
 * `TextLabelController.refresh`, `TextController.refreshTextImage`, `ItemListController` and
 * `WindowParser.parseSingleWindowEntity` (2020 dump, `com/sulake/core/window`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { LayoutWindow, buildTemplateWindows, layoutTemplate, linkTemplateScrollbars } = await import('../packages/nitro-theme/src/template/templateLayout.ts');

const element = (tag, rect, extra = {}) => ({ tag, x: rect[0], y: rect[1], width: rect[2], height: rect[3], vars: {}, children: [], ...extra });
const rectOf = window => ({ x: window.x, y: window.y, width: window.width, height: window.height });

/** A layout whose every text measures `size`. */
const input = (size, caption = 'text') => ({ captionOf: () => caption, measure: () => size });

// WindowParam bits, for windows made directly.
const ALIGN_CENTER = 786432;
const ALIGN_RIGHT = 262144;
const ALIGN_BOTTOM = 1048576;
const BOUND = 32;

await test('a resize with no move keeps the left edge by default', () => {
    const window = new LayoutWindow(undefined, { x: 10, y: 5, width: 40, height: 20 }, 0);

    window.setRectangle(10, 5, 60, 30);
    assert.deepEqual(rectOf(window), { x: 10, y: 5, width: 60, height: 30 });
});

await test('on_resize_align_center moves by half the change, truncated as the int argument is', () => {
    const shrink = new LayoutWindow(undefined, { x: 0, y: 1, width: 71, height: 17 }, ALIGN_CENTER);
    const grow = new LayoutWindow(undefined, { x: 10, y: 1, width: 10, height: 17 }, ALIGN_CENTER);

    shrink.setRectangle(0, 1, 24, 17); // 0 - (24 - 71) / 2 = 23.5 -> 23
    grow.setRectangle(10, 1, 15, 17); // 10 - (15 - 10) / 2 = 7.5 -> 7
    assert.equal(shrink.x, 23);
    assert.equal(grow.x, 7);
});

await test('on_resize_align_right and bottom keep that edge; a move skips the alignment', () => {
    const aligned = new LayoutWindow(undefined, { x: 25, y: 2, width: 10, height: 17 }, ALIGN_RIGHT | ALIGN_BOTTOM);
    const moved = new LayoutWindow(undefined, { x: 25, y: 2, width: 10, height: 17 }, ALIGN_RIGHT);

    aligned.setRectangle(25, 2, 22, 20);
    moved.setRectangle(30, 2, 22, 17);
    assert.deepEqual(rectOf(aligned), { x: 13, y: -1, width: 22, height: 20 });
    assert.deepEqual(rectOf(moved), { x: 30, y: 2, width: 22, height: 17 });
});

await test('the limits clamp the size before it is compared', () => {
    const window = new LayoutWindow(undefined, { x: 0, y: 0, width: 50, height: 19 }, 0);

    window.minWidth = 50;
    window.maxWidth = 50;
    window.setRectangle(0, 0, 71, 19);
    assert.deepEqual(rectOf(window), { x: 0, y: 0, width: 50, height: 19 });
});

await test('bound_to_parent_rect keeps a moved window inside and shrinks a resized one', () => {
    const parent = new LayoutWindow(undefined, { x: 0, y: 0, width: 100, height: 50 }, 0);
    const movedChild = new LayoutWindow(undefined, { x: 90, y: 10, width: 20, height: 10 }, BOUND, parent);
    const resizedChild = new LayoutWindow(undefined, { x: 90, y: 10, width: 20, height: 10 }, BOUND, parent);

    movedChild.setRectangle(95, 10, 20, 10);
    resizedChild.setRectangle(90, 10, 30, 10);
    assert.deepEqual(rectOf(movedChild), { x: 80, y: 10, width: 20, height: 10 });
    assert.deepEqual(rectOf(resizedChild), { x: 90, y: 10, width: 10, height: 10 });
});

// params 1838288: relative_scale_center, on_resize_align_center + bottom, use_parent_graphic_context.
const helpParams = { parentGraphics: true, scale: [ 'center', 'center' ], align: [ 'center', 'bottom' ] };

await test('the purse Help label: auto-sized, then centred when pushed onto its container_button', () => {
    const help = element('label', [ 0, 1, 71, 17 ], { params: helpParams });
    const button = element('container_button', [ 0, 0, 50, 19 ], { children: [ help ] });

    // floor(50 / 2) - floor(26 / 2) = 12; floor(19 / 2) - floor(17 / 2) = 1
    assert.deepEqual(layoutTemplate([ button ], input({ width: 26.4, height: 17 })).get(help), { x: 12, y: 1, width: 26, height: 17 });
});

await test('under a window with no iterator the child is made with its parent: no centring on add', () => {
    // `button` has no iterator, so the label never hears PARENT_ADDED - only its own resize's alignment moves it.
    const help = element('label', [ 0, 1, 71, 17 ], { params: { ...helpParams, scale: [ 'fixed', 'fixed' ] } });
    const button = element('button', [ 0, 0, 50, 19 ], { children: [ help ] });

    assert.deepEqual(layoutTemplate([ button ], input({ width: 26, height: 17 })).get(help), { x: 22, y: 1, width: 26, height: 17 });
});

await test('a centre-scaled window re-centres when its own size changes, even under a window with no iterator', () => {
    const help = element('label', [ 0, 1, 71, 17 ], { params: helpParams });
    const button = element('button', [ 0, 0, 50, 19 ], { children: [ help ] });

    // The label's resize fires RESIZED, and a centre-scaled window re-runs its relative scale then.
    assert.equal(layoutTemplate([ button ], input({ width: 26, height: 17 })).get(help).x, 12);
});

await test('a centred window wider than a parent it draws into sits at 0, else it is still centred', () => {
    const into = element('container', [ 5, 0, 80, 10 ], { params: { parentGraphics: true, scale: [ 'center', 'fixed' ] } });
    const own = element('container', [ 5, 0, 80, 10 ], { params: { scale: [ 'center', 'fixed' ] } });
    const rects = layoutTemplate([ element('container', [ 0, 0, 50, 10 ], { children: [ into, own ] }) ], input(undefined));

    assert.equal(rects.get(into).x, 0);
    assert.equal(rects.get(own).x, -15);
});

await test('a left auto-sized text takes the field width, growing leftwards when right-aligned', () => {
    const count = element('text', [ 25, 2, 10, 17 ], { vars: { auto_size: 'left' }, params: { align: [ 'right', 'top' ] } });

    assert.deepEqual(layoutTemplate([ count ], input({ width: 31, height: 17 })).get(count), { x: 4, y: 2, width: 31, height: 17 });
});

await test('a centre auto-sized text keeps its width and takes the field height; no auto size keeps its rect', () => {
    const centred = element('text', [ 0, 0, 80, 30 ], { vars: { auto_size: 'center' } });
    const fixed = element('text', [ 0, 0, 80, 30 ]);
    const rects = layoutTemplate([ centred, fixed ], input({ width: 20, height: 17 }));

    assert.deepEqual(rects.get(centred), { x: 0, y: 0, width: 80, height: 17 });
    assert.deepEqual(rects.get(fixed), { x: 0, y: 0, width: 80, height: 30 });
});

await test('a wrapping text is measured at its field width, inside its margins', () => {
    const text = element('text', [ 0, 0, 80, 30 ], { vars: { auto_size: 'left', word_wrap: true, margins: { left: 3, right: 5, top: 1, bottom: 1 } } });
    let wrapWidth;
    const rects = layoutTemplate([ text ], { captionOf: () => 'text', measure: (_, __, width) => {
        wrapWidth = width;

        return { width: 72, height: 40 };
    } });

    assert.equal(wrapWidth, 72);
    assert.deepEqual(rects.get(text), { x: 0, y: 0, width: 80, height: 42 });
});

await test('an auto-sized text resized from outside takes its field size again', () => {
    const text = element('text', [ 0, 0, 10, 17 ], { vars: { auto_size: 'left' } });
    const window = buildTemplateWindows([ text ], input({ width: 31, height: 17 })).get(text);

    window.setRectangle(0, 0, 100, 40);
    assert.deepEqual(rectOf(window), { x: 0, y: 0, width: 31, height: 17 });
});

await test('children follow their parent\'s resize: moved, stretched, centred, fixed', () => {
    const moved = element('container', [ 80, 0, 10, 10 ], { params: { scale: [ 'move', 'fixed' ] } });
    const stretched = element('container', [ 10, 0, 80, 10 ], { params: { scale: [ 'stretch', 'fixed' ] } });
    const centred = element('container', [ 45, 0, 10, 10 ], { params: { scale: [ 'center', 'fixed' ] } });
    const fixed = element('container', [ 5, 0, 10, 10 ]);
    const root = element('container', [ 0, 0, 100, 50 ], { children: [ moved, stretched, centred, fixed ] });
    const windows = buildTemplateWindows([ root ], input(undefined));

    windows.get(root).setRectangle(0, 0, 160, 50);
    assert.equal(windows.get(moved).x, 140);
    assert.equal(windows.get(stretched).width, 140);
    assert.equal(windows.get(centred).x, 75);
    assert.equal(windows.get(fixed).x, 5);
});

await test('resize_to_accommodate_children takes the children\'s extent, shrinking too', () => {
    const child = element('container', [ 4, 6, 20, 10 ]);
    const parent = element('container', [ 0, 0, 100, 100 ], { params: { accommodate: 'resize' }, children: [ child ] });

    assert.deepEqual(layoutTemplate([ parent ], input(undefined)).get(parent), { x: 0, y: 0, width: 24, height: 16 });
});

await test('expand_to_accommodate_children only grows', () => {
    const inside = element('container', [ 4, 6, 20, 10 ]);
    const outside = element('container', [ 90, 6, 30, 10 ]);
    const small = element('container', [ 0, 0, 100, 100 ], { params: { accommodate: 'expand' }, children: [ inside ] });
    const large = element('container', [ 0, 0, 100, 100 ], { params: { accommodate: 'expand' }, children: [ outside ] });
    const rects = layoutTemplate([ small, large ], input(undefined));

    assert.deepEqual(rects.get(small), { x: 0, y: 0, width: 100, height: 100 });
    assert.deepEqual(rects.get(large), { x: 0, y: 0, width: 120, height: 100 });
});

await test('an item list stacks its items with spacing, whatever their own y', () => {
    const a = element('container', [ 0, 40, 50, 19 ]);
    const b = element('container', [ 3, 0, 50, 17 ]);
    const list = element('itemlist_vertical', [ 0, 0, 60, 62 ], { vars: { spacing: 2 }, children: [ a, b ] });
    const rects = layoutTemplate([ list ], input(undefined));

    assert.deepEqual(rects.get(a), { x: 0, y: 0, width: 50, height: 19 });
    assert.deepEqual(rects.get(b), { x: 3, y: 21, width: 50, height: 17 });
});

await test('a horizontal item list places its items along x', () => {
    const a = element('container', [ 0, 0, 20, 10 ]);
    const b = element('container', [ 0, 0, 30, 10 ]);
    const list = element('itemlist_horizontal', [ 0, 0, 100, 10 ], { vars: { spacing: 4 }, children: [ a, b ] });
    const rects = layoutTemplate([ list ], input(undefined));

    assert.equal(rects.get(a).x, 0);
    assert.equal(rects.get(b).x, 24);
});

await test('hiding an item re-arranges the list, and resize_on_item_update shrinks it', () => {
    const a = element('container', [ 0, 0, 50, 19 ], { name: 'a' });
    const b = element('container', [ 0, 0, 50, 19 ], { name: 'b' });
    const c = element('container', [ 0, 0, 50, 17 ], { name: 'c' });
    const list = element('itemlist_vertical', [ 0, 0, 60, 55 ], { vars: { resize_on_item_update: true }, children: [ a, b, c ] });
    const rects = layoutTemplate([ list ], { ...input(undefined), visibleOf: e => e !== b });

    assert.equal(rects.get(c).y, 19);
    assert.equal(rects.get(list).height, 36);
});

await test('a list item centre-scaled is centred across the list when it is added', () => {
    const item = element('container', [ 0, 0, 20, 10 ], { params: { scale: [ 'center', 'fixed' ] } });
    const list = element('itemlist_vertical', [ 0, 0, 60, 60 ], { children: [ item ] });

    assert.equal(layoutTemplate([ list ], input(undefined)).get(item).x, 20);
});

await test('a frame places its children in its content area, which stretches with it', () => {
    const child = element('container', [ 0, 0, 20, 10 ], { params: { scale: [ 'center', 'fixed' ] } });
    const frame = element('frame', [ 0, 0, 120, 100 ], { margins: [ 10, 30, 10, 10 ], children: [ child ] });
    const windows = buildTemplateWindows([ frame ], input(undefined));

    // Content 100 wide: floor(50) - floor(10) = 40, in content coordinates.
    assert.equal(windows.get(child).x, 40);

    windows.get(frame).setRectangle(0, 0, 220, 100);
    assert.equal(windows.get(child).x, 90);
});

await test('an item grid fills its first row with columns while the next item fits, then wraps to the first column', () => {
    const items = [ 0, 1, 2, 3, 4 ].map(index => element('container', [ 0, 0, 40, 30 ], { name: `item${index}` }));
    const grid = element('itemgrid_vertical', [ 0, 0, 130, 100 ], { vars: { spacing: 5 }, children: items });
    const rects = layoutTemplate([ grid ], input(undefined));

    // Columns at 0, 45, 90: a fourth would end at 90 + 40 + 40 = 170, past 130.
    assert.deepEqual([ 0, 1, 2 ].map(index => [ rects.get(items[index]).x, rects.get(items[index]).y ]), [ [ 0, 0 ], [ 45, 0 ], [ 90, 0 ] ]);
    // The second row, 30 + 5 down.
    assert.deepEqual([ 3, 4 ].map(index => [ rects.get(items[index]).x, rects.get(items[index]).y ]), [ [ 0, 35 ], [ 45, 35 ] ]);
});

await test('the grid\'s new-column test leaves out the spacing, as the client\'s does', () => {
    const items = [ 0, 1, 2 ].map(index => element('container', [ 0, 0, 40, 30 ], { name: `item${index}` }));
    const grid = element('itemgrid_vertical', [ 0, 0, 125, 100 ], { vars: { spacing: 5 }, children: items });
    const rects = layoutTemplate([ grid ], input(undefined));

    // 45 + 40 + 40 = 125 fits, though the third column then ends at 130.
    assert.equal(rects.get(items[2]).x, 90);
    assert.equal(rects.get(items[2]).y, 0);
});

await test('a grid with resize_on_item_update takes its rows\' height', () => {
    const items = [ 0, 1, 2 ].map(index => element('container', [ 0, 0, 40, 30 ], { name: `item${index}` }));
    const grid = element('itemgrid_vertical', [ 0, 0, 90, 10 ], { vars: { spacing: 5, resize_on_item_update: true }, children: items });

    // Two columns (0, 45); the third item a second row: 30 + 5 + 30.
    assert.equal(layoutTemplate([ grid ], input(undefined)).get(grid).height, 65);
});

const { layoutToTemplate } = await import('../packages/nitro-theme/src/template/layoutToTemplate.ts');
const { readFileSync } = await import('node:fs');

/** The client's own window layout of a scrollable list, style 0: a 23 wide `_ITEMLIST` and a 17 wide `_SCROLLBAR` in 40 x 40. */
const listSkin = layoutToTemplate(readFileSync(new URL('../packages/nitro-react/scripts/flash-js-resources/habbo-window-manager-com/habbo_window_layout_scrollable_itemlist_vertical.xml', import.meta.url), 'utf8'));
const skinned = { ...input(undefined), skinOf: e => (e.tag === 'scrollable_itemlist_vertical' ? listSkin : undefined) };

await test('a scrollable list whose items fit hides its scrollbar and gives the list the whole width', () => {
    const items = [ 0, 1 ].map(index => element('container', [ 0, 0, 180, 30 ], { name: `row${index}`, params: { scale: [ 'stretch', 'fixed' ] } }));
    const list = element('scrollable_itemlist_vertical', [ 0, 0, 200, 100 ], { children: items });
    const windows = buildTemplateWindows([ list ], skinned);
    const scrollable = windows.get(list);

    assert.equal(scrollable.scrollbar.visible, false);
    assert.equal(scrollable.list.width, 200);
    assert.equal(windows.get(items[1]).y, 30);
});

await test('a scrollable list whose items overflow shows its scrollbar at its right edge and narrows the list, stretched items with it', () => {
    const items = [ 0, 1, 2, 3, 4 ].map(index => element('container', [ 0, 0, 180, 30 ], { name: `row${index}`, params: { scale: [ 'stretch', 'fixed' ] } }));
    const list = element('scrollable_itemlist_vertical', [ 0, 0, 200, 100 ], { children: items });
    const windows = buildTemplateWindows([ list ], skinned);
    const scrollable = windows.get(list);

    // The skin at 200 wide: the list 23 + 160, the scrollbar moved to 23 + 160.
    assert.equal(scrollable.scrollbar.visible, true);
    assert.equal(scrollable.list.width, 183);
    assert.equal(scrollable.scrollbar.x, 183);
    assert.equal(scrollable.scrollbar.width, 17);
    // Stretched with the list's container: 180 - 17 - the items already in it when the scrollbar came.
    assert.equal(windows.get(items[0]).width, 163);
    // The scrollbar enables the moment the list's content grows past it (`ScrollBarController` re-checks
    // on the list's RESIZED, which the list sends as its container grows): items added after keep their width.
    assert.deepEqual(layoutTemplate([ list ], skinned).get(items[4]), { x: 0, y: 120, width: 180, height: 30 });
});

await test('a scrollable list reports its viewport, its scrollbar and its content, and its items in the content', () => {
    const items = [ 0, 1, 2, 3, 4 ].map(index => element('container', [ 0, 0, 180, 30 ], { name: `row${index}` }));
    const list = element('scrollable_itemlist_vertical', [ 10, 20, 200, 100 ], { children: items });
    const rects = layoutTemplate([ list ], skinned);

    assert.deepEqual(rects.get(list).scroll, {
        viewport: { x: 0, y: 0, width: 183, height: 100 },
        scrollbar: { x: 183, y: 0, width: 17, height: 100, style: undefined },
        content: { width: 183, height: 150 },
    });
    assert.deepEqual(rects.get(items[3]), { x: 0, y: 90, width: 180, height: 30 });
});

/** The client's tab context layout, style 3: a `_SELECTOR` inset 8 at either end, a `_CONTENT` under it. */
const tabSkin = layoutToTemplate(readFileSync(new URL('../packages/nitro-react/scripts/flash-js-resources/habbo-window-manager-com/habbo_window_layout_tab_context_3.xml', import.meta.url), 'utf8'));

await test('a tab context puts its buttons in its selector, packed from the selector\'s inset whatever the layout placed them at', () => {
    const tabs = [ [ 0, 70 ], [ 75, 74 ], [ 144, 82 ] ].map(([ x, width ], index) => element('tab_button', [ x, 0, width, 32 ], { name: `tab${index}` }));
    const context = element('tab_context', [ 0, 2, 500, 30 ], { style: '3', children: tabs });
    const rects = layoutTemplate([ context ], { ...input(undefined), skinOf: e => (e.tag === 'tab_context' ? tabSkin : undefined) });

    assert.deepEqual(tabs.map(tab => rects.get(tab).x), [ 8, 78, 152 ]);
});

await test('hiding items so the rest fit hides the scrollbar again', () => {
    const items = [ 0, 1, 2, 3, 4 ].map(index => element('container', [ 0, 0, 180, 30 ], { name: `row${index}` }));
    const list = element('scrollable_itemlist_vertical', [ 0, 0, 200, 100 ], { children: items });
    const windows = buildTemplateWindows([ list ], { ...skinned, visibleOf: e => e === list || e === items[0] || e === items[1] });

    assert.equal(windows.get(list).scrollbar.visible, false);
    assert.equal(windows.get(list).list.width, 200);
});

await test('an item the layout hides takes no room while the list is built (ItemListIterator adds with addListItemAt, which re-arranges)', () => {
    // The avatar menu in small: the list reflects its height to the border; `minimize`, built after it, moves with the border's bottom.
    const rows = [ 0, 1, 2 ].map(index => element('container', [ 0, 0, 100, 26 ], { name: `row${index}`, hidden: index === 1 }));
    const list = element('itemlist_vertical', [ 0, 10, 100, 53 ], { vars: { spacing: 1, resize_on_item_update: true }, params: { reflectToParent: [ false, true ] }, children: rows });
    const minimize = element('region', [ 0, 70, 100, 18 ], { name: 'minimize', params: { scale: [ 'fixed', 'move' ] } });
    const border = element('container', [ 0, 0, 100, 90 ], { children: [ list, minimize ] });
    const rects = layoutTemplate([ border ], { ...input(undefined), visibleOf: e => e !== rows[0] && !e.hidden });

    // Built: the list 53 (two visible rows) and the border 90 as the layout has them, `minimize` at 70.
    // Then row 0 hidden: the list 26, the border 63, `minimize` 27 up.
    assert.equal(rects.get(list).height, 26);
    assert.equal(rects.get(border).height, 63);
    assert.equal(rects.get(minimize).y, 43);
});

await test('arrange runs once the layout is built: it reads a text\'s width and moves windows through setRectangle', () => {
    const label = element('text', [ 3, 9, 137, 16 ], { name: 'label', vars: { auto_size: 'center' } });
    const icon = element('icon', [ 128, 12, 5, 10 ], { name: 'icon', tags: [ 'arrow_right' ] });
    const button = element('container', [ 0, 0, 143, 35 ], { name: 'button', params: { accommodate: 'expand' }, children: [ label, icon ] });
    let textWidth;
    const rects = layoutTemplate([ button ], { captionOf: e => (e === label ? 'Moderate' : ''), measure: () => ({ width: 52, height: 16, textWidth: 48 }) }, undefined, (windowOf) => {
        const labelWindow = windowOf(label);
        const iconWindow = windowOf(icon);

        textWidth = labelWindow.textWidth;
        // ButtonMenuView: 3 + (137 + 48) / 2 + 8 = 103.5 -> 103.
        iconWindow.setX(labelWindow.x + ((labelWindow.width + labelWindow.textWidth) / 2) + 8);
        // Past the button's right edge: the button, expanding to its children, follows.
        iconWindow.setX(150);
    });

    assert.equal(textWidth, 48);
    assert.equal(rects.get(icon).x, 150);
    assert.equal(rects.get(button).width, 155);
});

await test('a standalone scrollbar scrolls the window its scrollable var names, found under its parent', () => {
    const list = element('itemlist_vertical', [ 0, 0, 367, 10 ], { name: 'achievements_scrollarea' });
    const bar = element('scrollbar_vertical', [ 350, 0, 18, 50 ], { name: 'achievements_scrollbar', vars: { scrollable: 'achievements_scrollarea' } });
    const other = element('itemlist_vertical', [ 0, 0, 10, 10 ], { name: 'first' });
    const root = element('container', [ 0, 0, 367, 100 ], { children: [ other, list, bar ] });

    assert.equal(linkTemplateScrollbars([ root ]).get(bar), list);
});

await test('without a name it scrolls its parent when that scrolls, else the parent\'s first scrollable child', () => {
    const inner = element('scrollbar_vertical', [ 0, 0, 18, 50 ]);
    const parentList = element('itemlist', [ 0, 0, 100, 100 ], { children: [ inner ] });
    const sibling = element('scrollbar_vertical', [ 0, 0, 18, 50 ]);
    const firstList = element('itemgrid_vertical', [ 0, 0, 100, 100 ]);
    const root = element('container', [ 0, 0, 200, 200 ], { children: [ parentList, sibling, firstList ] });
    const links = linkTemplateScrollbars([ root ]);

    assert.equal(links.get(inner), parentList);
    // The parent's first scrollable child is `parentList`, before `firstList`.
    assert.equal(links.get(sibling), parentList);
});

await test('a scrollbar whose target is a text is linked to nothing (a text is not scrolled yet)', () => {
    const text = element('input', [ 0, 0, 100, 100 ], { name: 'data' });
    const bar = element('scrollbar_vertical', [ 100, 0, 18, 100 ], { vars: { scrollable: 'data' } });
    const list = element('itemlist', [ 0, 0, 100, 100 ]);

    assert.equal(linkTemplateScrollbars([ element('container', [ 0, 0, 200, 100 ], { children: [ text, bar, list ] }) ]).size, 0);
});

await test('a scrolled list keeps its own rect and carries its items\' extent', () => {
    const items = element('container', [ 0, 0, 367, 10 ], { name: 'achievements_cont' });
    const list = element('itemlist_vertical', [ 0, 0, 367, 10 ], { name: 'achievements_scrollarea', limits: [ null, null, null, 245 ], children: [ items ] });
    const bar = element('scrollbar_vertical', [ 350, 0, 18, 50 ], { vars: { scrollable: 'achievements_scrollarea' } });
    const root = element('container', [ 0, 0, 367, 100 ], { children: [ list, bar ] });
    const rects = layoutTemplate([ root ], { ...input(undefined), scrollTargets: new Set([ list ]) }, undefined, (windowOf) => {
        // `refreshAchievementList`: five rows of slots, the list as tall as they are, to its limit.
        windowOf(items).setHeight(303);
        windowOf(list).setHeight(304);
    });

    assert.deepEqual(rects.get(list).scrollContent, { width: 367, height: 303 });
    assert.equal(rects.get(list).height, 245);
    assert.equal(rects.get(list).clip, undefined);
    assert.equal(rects.get(bar).scrollContent, undefined);
});

await test('a clone is set up before its own clones are added, so an accommodating window grows round them', () => {
    // `getOpenCategoryElement`: `container.height = 16 + rows`, then the rooms added to `roomList`.
    const row = element('container', [ 0, 0, 100, 40 ], { itemKey: 'r' });
    const list = element('itemlist', [ 0, 30, 100, 10 ], { name: 'content', vars: { resize_on_item_update: true }, params: { accommodate: 'resize' }, children: [ { ...row, itemKey: 'a' }, { ...row, itemKey: 'b' } ] });
    const block = element('container', [ 0, 0, 100, 200 ], { name: 'block', params: { accommodate: 'resize' }, itemKey: 'block', children: [ list ] });
    const results = element('itemlist', [ 0, 0, 100, 500 ], { name: 'results', children: [ block ] });
    let contentAtSetup;
    const rects = layoutTemplate([ results ], {
        ...input(undefined),
        setupOf: element => (element === block
            ? (windowOf) => {
                    contentAtSetup = windowOf(list).height;
                    windowOf(block).setHeight(56);
                }
            : undefined),
    });

    assert.equal(contentAtSetup, 10, 'the rows are not in the list yet when the block is set up');
    assert.equal(rects.get(list).height, 80);
    assert.equal(rects.get(block).height, 110, 'the block grows round its rows after being set to 56');
});

await test('a list\'s spacing as the code sets it goes over the layout\'s', () => {
    const items = [ 0, 1, 2 ].map(index => element('container', [ 0, 0, 50, 20 ], { itemKey: String(index) }));
    const list = element('itemlist', [ 0, 0, 50, 100 ], { vars: { spacing: 5 }, children: items });

    assert.deepEqual(items.map(item => layoutTemplate([ list ], input(undefined)).get(item).y), [ 0, 25, 50 ]);
    assert.deepEqual(items.map(item => layoutTemplate([ list ], { ...input(undefined), spacingOf: () => 0 }).get(item).y), [ 0, 20, 40 ]);
});
