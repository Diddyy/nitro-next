/**
 * The preview host's design window (`window: 'design'`, `previewHost`): one of the game's windows - a
 * template by id, one window of it (`part`), or a frame Nitro draws itself by its frame id - drawn
 * with an appearance editor's draft before it is saved: its patch files, style values, variables and
 * texts in place of the hotel's, or Habbo's own (`base`). Not a Flash feature.
 *
 * What the window's patches did is said back (`report`: per owner the ops given and applied, those
 * that match nothing, those that change nothing drawn, conflicts, styles with no value); a press on
 * the window names the element under it (`select`: its key, as a patch names it), and a `highlight`
 * key outlines that element. The draft never leaves this page: nothing is saved and nothing is sent.
 */
import { ClientPointToStage, inspectAt, inspectFind, inspectTemplateKey, setTemplateInspecting, TemplateBindings } from '@nitrodevco/nitro-theme';
import { useApplication } from '@pixi/react';
import { Graphics } from 'pixi.js';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { Frame, TemplateWindow } from '#base/theme';

import { designHighlight, designShown, sayDesign, subscribeDesign } from './designPreview';
import type { DesignMessage } from './previewMessages';

/** A frame Nitro draws itself is drawn this size, with nothing in it. */
const FRAME_SIZE = { width: 320, height: 200 };

const HIGHLIGHT_COLOR = 0x1e90ff;

/** A list's sample rows as the bindings its code would give it. */
const sampleBindings = (items: DesignMessage['items']): TemplateBindings => Object.fromEntries(Object.entries(items).map(([ name, rows ]) => [ name, {
    items: rows.map((row, index) => ({
        key: `${index}`,
        from: row.from,
        context: row.context,
        ...((row.caption !== undefined) ? { bindings: { '': { caption: row.caption } } } : {}),
    })),
} ]));

export const DesignPreviewView = () => {
    const design = useSyncExternalStore(subscribeDesign, designShown);
    const highlight = useSyncExternalStore(subscribeDesign, designHighlight);
    const { app } = useApplication();
    const isFrame = !!design && !design.template.includes('/');
    const bindings = useMemo(() => (design ? sampleBindings(design.items) : undefined), [ design ]);
    // The frame id its code gives it, so the hotel's `frame.overrides` entry for it applies as in the game.
    const frameId = design?.frame;
    const frame = useMemo(() => (frameId ? { id: frameId } : undefined), [ frameId ]);

    // Every element notes what it draws, so a press finds it and a key outlines it.
    useEffect(() => {
        setTemplateInspecting(!!design);
    }, [ design ]);

    useEffect(() => () => setTemplateInspecting(false), []);

    // A press selects rather than presses: the preview has no connection for a button to talk to.
    useEffect(() => {
        if (!design || !app?.canvas) return;

        const onPointerDown = (event: PointerEvent) => {
            if (event.target !== app.canvas) return;

            const hit = inspectAt(app.stage, ClientPointToStage(app.canvas, event.clientX, event.clientY));

            event.preventDefault();
            event.stopImmediatePropagation();

            if (!hit) {
                // A frame of Nitro's own has no template: what a patch reaches of it is its root.
                if (isFrame) sayDesign({ event: 'select', template: design.template, key: '', tag: 'frame', name: null, style: null, caption: null });

                return;
            }

            // A clone the window's code made has no key of its own: the nearest element that has one is named.
            let node: typeof hit.node | undefined = hit.node;
            let key = inspectTemplateKey(node, hit.window);

            while ((key === undefined) && node?.parent) {
                node = node.parent;
                key = inspectTemplateKey(node, hit.window);
            }

            const element = (node ?? hit.node).element;

            sayDesign({ event: 'select', template: hit.window.id, key: key ?? null, tag: element.tag, name: element.name ?? null, style: (element.style !== undefined) ? String(element.style) : null, caption: element.caption ?? null });
        };

        window.addEventListener('pointerdown', onPointerDown, true);

        return () => window.removeEventListener('pointerdown', onPointerDown, true);
    }, [ design, app, isFrame ]);

    // The outline: over everything, redrawn each frame as the window lays itself out.
    useEffect(() => {
        if (!design || (highlight === null) || !app?.stage) return;

        const outline = new Graphics();

        outline.eventMode = 'none';
        outline.zIndex = Number.MAX_SAFE_INTEGER;
        app.stage.addChild(outline);

        const draw = () => {
            outline.clear();

            for (const container of inspectFind(app.stage, design.template, highlight)) {
                const bounds = container.getBounds();
                const from = app.stage.toLocal({ x: bounds.x, y: bounds.y });
                const to = app.stage.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });

                outline.rect(from.x, from.y, to.x - from.x, to.y - from.y).fill({ color: HIGHLIGHT_COLOR, alpha: 0.15 }).stroke({ width: 2, color: HIGHLIGHT_COLOR });
            }
        };

        app.ticker.add(draw);

        return () => {
            app.ticker.remove(draw);
            outline.destroy();
        };
    }, [ design, highlight, app ]);

    if (!design) return null;

    if (isFrame) return (
        <Frame
            key={design.art}
            id={design.template}
            caption={design.template}
            centered
            layout={{ width: FRAME_SIZE.width, height: FRAME_SIZE.height }}
        />
    );

    return (
        <TemplateWindow
            key={design.art}
            id={design.template}
            part={design.part}
            frame={frame}
            bindings={bindings}
            context={design.context}
        />
    );
};
