/**
 * A furni widget's window that is no frame - a card, a plaque, a note - drawn from its Flash template
 * on the desktop: where the widget's code puts it (`window.center()`, or the `Rectangle` of the
 * container it builds the layout into), and dragged the way its layout says.
 *
 * The template engine does not act on a window's drag params, so they are carried here: a root with
 * `draggable_with_mouse` (33025: `mouse_dragging_target` and `_trigger`) drags by any press on it
 * that nothing inside claims (`dragByRoot`); a root that is only the target (32768) drags by the
 * one window carrying the trigger (`dragTriggerName`, the stickie's `bg`).
 */
import { FederatedPointerEvent } from 'pixi.js';

import { useViewportSize } from '#base/hooks';
import { Region, TemplateBindings, TemplateWindow, TemplateWindowProps, useDragTrigger, useTemplate } from '#base/theme';

export interface FurnitureTemplatePanelProps extends Omit<TemplateWindowProps, 'frame' | 'part'> {
    /** `center()` on the desktop, or the desktop point the code builds the window at. */
    position: 'center' | { x: number; y: number };
    /** The root's `draggable_with_mouse`: a press anywhere on it that nothing inside claims drags it. */
    dragByRoot?: boolean;
    /** The element with `mouse_dragging_trigger` that drags the root (the root then only its target). */
    dragTriggerName?: string;
    /**
     * The window's size once its code has sized it in `arrange` (`drawImage`), for placing and
     * holding it; the layout's otherwise. The template itself is built at its layout size.
     */
    size?: { width: number; height: number };
}

/** The template, with the drag trigger's press bound on its element - inside the drag target. */
const PanelTemplate = ({ dragTriggerName, bindings, ...props }: Omit<FurnitureTemplatePanelProps, 'position' | 'dragByRoot' | 'size'>) => {
    const startDrag = useDragTrigger(!!dragTriggerName);

    const withTrigger: TemplateBindings | undefined = (dragTriggerName && startDrag)
        ? {
                ...bindings,
                [dragTriggerName]: {
                    ...bindings?.[dragTriggerName],
                    onPointerDown: (event: FederatedPointerEvent) => {
                        bindings?.[dragTriggerName]?.onPointerDown?.(event);
                        startDrag(event);
                    },
                },
            }
        : bindings;

    return (
        <TemplateWindow
            {...props}
            bindings={withTrigger}
        />
    );
};

export const FurnitureTemplatePanel = ({ position, dragByRoot = false, dragTriggerName, size, ...props }: FurnitureTemplatePanelProps) => {
    const template = useTemplate(props.id);
    const viewport = useViewportSize();

    if (!template) return null;

    const width = size?.width ?? props.width ?? template.width;
    const height = size?.height ?? props.height ?? template.height;
    // `WindowController.center`: the middle of the desktop, never off its top left.
    const left = (position === 'center') ? Math.max(0, Math.floor((viewport.width - width) / 2)) : position.x;
    const top = (position === 'center') ? Math.max(0, Math.floor((viewport.height - height) / 2)) : position.y;

    return (
        <Region
            dragTarget
            dragTrigger={dragByRoot}
            layout={{ position: 'absolute', left, top, width, height }}
        >
            <PanelTemplate
                {...props}
                dragTriggerName={dragTriggerName}
            />
        </Region>
    );
};
