/**
 * The preview host's design window (`window: 'design'`, `previewHost`): one of the game's windows - a
 * template by id, one window of it (`part`), or a frame Nitro draws itself by its frame id - drawn
 * with an appearance editor's draft before it is saved: its patch files, style values, variables and
 * texts in place of the hotel's, or Habbo's own (`base`). Not a Flash feature.
 *
 * What the window's patches did is said back (`report`: per owner the ops given and applied, those
 * that match nothing, those that change nothing drawn, conflicts, styles with no value); a press on
 * the window names the element under it (`select`: its key, as a patch names it, what it is drawn
 * with and where), and a `highlight` key outlines that element, saying where it is drawn (`rect`)
 * each time it moves, so a panel's handles can sit on it. The draft never leaves this page: nothing is saved and nothing is sent.
 */
import { ClientPointToStage, GetStagePixelScale, inspectAt, inspectFind, inspectPart, inspectTemplates, setTemplateInspecting, TemplateBindings } from '@nitrodevco/nitro-theme';
import { useApplication } from '@pixi/react';
import { Container, Graphics } from 'pixi.js';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { Frame, TemplateWindow } from '#base/theme';

import { DesignCatalogView } from './DesignCatalogView';
import { DesignBox, designHighlight, designShown, sayDesign, setDesignPicker, setDesignTemplatesReader, subscribeDesign } from './designPreview';
import type { DesignMessage } from './previewMessages';

/** A frame Nitro draws itself is drawn this size, with nothing in it. */
const FRAME_SIZE = { width: 320, height: 200 };

const HIGHLIGHT_COLOR = 0x1e90ff;

/** Where the containers drawing the element `key` names are, in the page's CSS pixels. */
const drawnBoxes = (stage: Container, canvas: HTMLCanvasElement, template: string, key: string): DesignBox[] => {
    const page = canvas.getBoundingClientRect();
    const scale = GetStagePixelScale();

    return inspectFind(stage, template, key).map((container) => {
        const bounds = container.getBounds();
        const from = stage.toLocal({ x: bounds.x, y: bounds.y });
        const to = stage.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });

        return { x: page.left + (from.x / scale), y: page.top + (from.y / scale), width: (to.x - from.x) / scale, height: (to.y - from.y) / scale };
    });
};

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

        const canvas = app.canvas;

        const pick = (clientX: number, clientY: number) => {
            const hit = inspectAt(app.stage, ClientPointToStage(canvas, clientX, clientY));

            if (!hit) {
                // A frame of Nitro's own has no template: what a patch reaches of it is its root.
                if (isFrame) sayDesign({ event: 'select', window: design.template, part: null, path: [ { template: design.template, key: '', tag: 'frame', name: null } ], template: design.template, key: '', tag: 'frame', name: null, style: null, caption: null });

                return;
            }

            // Inside a part built from another template (a grid item) the element is named in that template; a clone
            // the window's code made has no key of its own: the nearest element that has one is named.
            let node: typeof hit.node | undefined = hit.node;
            let named = inspectPart(node, hit.window);

            while ((named.key === undefined) && node?.parent) {
                node = node.parent;
                named = inspectPart(node, hit.window);
            }

            const { key } = named;
            const element = (node ?? hit.node).element;
            // The part the element belongs to: a template built inside the window, or a template window drawn in it (a catalogue page).
            const part = named.part ? named.template : (hit.window.id !== design.template) ? hit.window.id : null;
            const { path } = inspectPart(hit.node, hit.window);

            sayDesign({
                event: 'select',
                window: design.template,
                part,
                // A template window drawn inside (a catalogue page) starts its own chain: the window shown heads the path.
                path: (path[0]?.template === design.template) ? path : [ { template: design.template, key: '', tag: 'frame', name: null }, ...path ],
                template: named.template,
                key: key ?? null,
                tag: element.tag,
                name: element.name ?? null,
                style: (element.style !== undefined) ? String(element.style) : null,
                caption: element.caption ?? null,
                element: { x: element.x, y: element.y, width: element.width, height: element.height, color: element.color ?? null, hidden: !!element.hidden, vars: { ...element.vars }, params: { ...element.params } },
                rects: (key === undefined) ? [] : drawnBoxes(app.stage, canvas, named.template, key),
            });
        };

        const onPointerDown = (event: PointerEvent) => {
            if (event.target !== canvas) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            pick(event.clientX, event.clientY);
        };

        setDesignPicker(pick);
        setDesignTemplatesReader(() => inspectTemplates(app.stage));
        window.addEventListener('pointerdown', onPointerDown, true);

        return () => {
            setDesignPicker(undefined);
            setDesignTemplatesReader(undefined);
            window.removeEventListener('pointerdown', onPointerDown, true);
        };
    }, [ design, app, isFrame ]);

    // The outline: over everything, redrawn each frame as the window lays itself out.
    useEffect(() => {
        if (!design || (highlight === null) || !app?.stage) return;

        const outline = new Graphics();

        outline.eventMode = 'none';
        outline.zIndex = Number.MAX_SAFE_INTEGER;
        app.stage.addChild(outline);

        let said = '';

        const draw = () => {
            outline.clear();

            for (const container of inspectFind(app.stage, design.template, highlight)) {
                const bounds = container.getBounds();
                const from = app.stage.toLocal({ x: bounds.x, y: bounds.y });
                const to = app.stage.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });

                outline.rect(from.x, from.y, to.x - from.x, to.y - from.y).fill({ color: HIGHLIGHT_COLOR, alpha: 0.15 }).stroke({ width: 2, color: HIGHLIGHT_COLOR });
            }

            // Said when it moves, not each frame: a panel's handles follow the element as a patch moves it.
            const rects = drawnBoxes(app.stage, app.canvas, design.template, highlight);
            const now = JSON.stringify(rects);

            if (now !== said) {
                said = now;
                sayDesign({ event: 'rect', template: design.template, key: highlight, rects, scale: GetStagePixelScale() });
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

    // A window with named states is drawn by the game's own view, with sample content in it.
    if (design.state) return (
        <DesignCatalogView
            key={design.art}
            state={design.state}
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
