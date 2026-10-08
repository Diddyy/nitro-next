import { Container as PixiContainer, FederatedPointerEvent } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

import { LayoutImage, TemplateBindings, TemplateWindows } from '#base/theme';

/** `slider_movement_area`'s width less `slider_button`'s: `_referenceWidth` (206 - 12). */
const REFERENCE_WIDTH = 194;

export interface FurnitureSliderOptions {
    /** The window holding `slider_base` and `slider_movement_area`: `brightness_container`, `hue_container`... */
    container: string;
    value: number;
    min: number;
    max: number;
    /**
     * `DimmerViewAlphaSlider.buttonProcedure` reports only on `WME_UP` / `WME_UP_OUTSIDE`, and the
     * dimmer then puts the button back where the value says (`setValue`), so it snaps.
     * `BackgroundColorWidgetSlider.buttonProcedure` reports on every event the button sees - over,
     * down, each relocate of the drag, up - and never moves the button back.
     */
    reportOnEveryEvent: boolean;
    onChange: (value: number) => void;
}

export interface FurnitureSlider {
    /** `slider_base` and `slider_button` of the container, by path. */
    bindings: TemplateBindings;
    /** Puts the button where the value (or the drag) says, through the window model. */
    arrange: (windows: TemplateWindows) => void;
}

/**
 * The brightness slider of the dimmer and each channel slider of the background toner -
 * `DimmerViewAlphaSlider` and `BackgroundColorWidgetSlider`, which are the same class twice, on the
 * layout's `slider_base` bitmap (given `dimmer_slider_base`) and `slider_button` bitmap (given
 * `dimmer_slider_button`) inside `slider_movement_area`. The button is its own drag target with
 * `bound_to_parent_rect`.
 *
 * The button's x is `int(_referenceWidth * (value - min) / (max - min))` (`setValue`) and a dropped
 * x reads back as `int(x / _referenceWidth * (max - min)) + min` (`getValue`). The layout puts the
 * button at y 7, which the 17-high movement area clips to its top 10 pixels; the first time
 * anything moves it (`set x` to a new x, or a drag), `setRectangle`'s `bound_to_parent_rect` branch
 * pulls it up by its overhang to y 0, where it stays.
 */
export const useFurnitureSlider = ({ container, value, min, max, reportOnEveryEvent, onChange }: FurnitureSliderOptions): FurnitureSlider => {
    const stopRef = useRef<(() => void) | null>(null);
    const [ dragX, setDragX ] = useState<number | null>(null);
    /** The background toner's button stays where it was dropped, while the value is still the one read from there. */
    const [ dropped, setDropped ] = useState<{ x: number; value: number } | null>(null);
    const [ moved, setMoved ] = useState(false);

    useEffect(() => () => stopRef.current?.(), []);

    const getSliderPosition = (next: number) => Math.trunc(REFERENCE_WIDTH * ((next - min) / (max - min)));
    const getValue = (x: number) => Math.trunc((x / REFERENCE_WIDTH) * (max - min)) + min;

    const restingX = (dropped && (dropped.value === value)) ? dropped.x : getSliderPosition(value);
    const x = dragX ?? restingX;

    // `set x` goes through `setRectangle` only when the x changes, and that is what drops it to y 0.
    if (!moved && (x !== 0)) setMoved(true);

    const report = (buttonX: number) => {
        const next = getValue(buttonX);

        if (!reportOnEveryEvent) setDropped(null);
        else setDropped({ x: buttonX, value: next });

        onChange(next);
    };

    const onPointerDown = (event: FederatedPointerEvent) => {
        const target = event.currentTarget as PixiContainer | null;

        if (!target) return;

        stopRef.current?.();

        // `WindowMouseDragger`: the grab offset is kept, so the pressed pixel stays under the pointer.
        const pointerId = event.pointerId;
        const startClient = { x: event.clientX, y: event.clientY };
        const startGlobal = { x: event.global.x, y: event.global.y };
        // The button's space as the press found it: what draws it may move with it, so the pointer
        // is read against where it was, not where the drag has taken it.
        const space = target.worldTransform.clone();
        const grabX = space.applyInverse(startGlobal).x;
        const startX = x;
        let current = startX;

        if (reportOnEveryEvent) report(current);

        const move = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;

            // Any move of the drag goes through `setRectangle`, which bounds y to the area.
            setMoved(true);

            const pointerX = space.applyInverse({ x: startGlobal.x + (moveEvent.clientX - startClient.x), y: startGlobal.y + (moveEvent.clientY - startClient.y) }).x;
            const next = Math.min(REFERENCE_WIDTH, Math.max(0, startX + Math.trunc(pointerX - grabX)));

            if (next === current) return;

            current = next;

            setDragX(next);

            if (reportOnEveryEvent) report(next);
        };

        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);

            stopRef.current = null;
        };

        // `WME_UP` / `WME_UP_OUTSIDE`: a release anywhere ends the drag.
        const up = (upEvent: PointerEvent) => {
            if (upEvent.pointerId !== pointerId) return;

            stop();
            setDragX(null);
            report(current);
        };

        stopRef.current = stop;

        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
    };

    return {
        bindings: {
            [`${container}/slider_base`]: { asset: LayoutImage('habbo-room-ui-com/dimmer_slider_base.png') },
            [`${container}/slider_button`]: {
                asset: LayoutImage('habbo-room-ui-com/dimmer_slider_button.png'),
                onPointerOver: reportOnEveryEvent ? () => report(x) : undefined,
                onPointerDown,
            },
        },
        arrange: ({ find }) => {
            const button = find(`${container}/slider_button`);

            if (!button) return;

            if (moved) button.setY(0);

            button.setX(x);
        },
    };
};
