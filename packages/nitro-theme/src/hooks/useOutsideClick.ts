import { GetRenderer } from '@nitrodevco/nitro-renderer';
import { Container as PixiContainer } from 'pixi.js';
import { RefObject, useEffect, useRef } from 'react';

/**
 * Calls `callback` on any press outside `ref`'s container - what Flash tells a window as `WME_CLICK_AWAY`. Every
 * popup is drawn into the one shared canvas, so the test is geometric: a `window` `pointerdown`
 * listener converts the client position into the canvas's CSS-pixel space
 * (`GetRenderer().canvas.getBoundingClientRect()`) - the space `getBounds()` reports in, since the
 * renderer runs with `autoDensity` (see `PixiApplicationRoot`) - and checks it against the
 * container's `getBounds()`.
 */
export const useOutsideClick = <T extends PixiContainer>(ref: RefObject<T | null>, callback: () => void, enabled: boolean = true) => {
    // `callback` is almost always an inline arrow at the call site, so a ref keeps the listener
    // itself stable across re-renders instead of tearing down/re-adding the window listener (and
    // dropping it during any render that happens between pointerdown and its own effect re-run)
    // every time the caller re-renders.
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [ callback ]);

    useEffect(() => {
        if (!enabled) return;

        const onPointerDown = (event: PointerEvent) => {
            const container = ref.current;
            const canvas = GetRenderer().canvas;

            if (!container || !canvas) return;

            const rect = canvas.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;

            if (container.getBounds().containsPoint(localX, localY)) return;

            callbackRef.current();
        };

        window.addEventListener('pointerdown', onPointerDown);

        return () => window.removeEventListener('pointerdown', onPointerDown);
    }, [ ref, enabled ]);
};
