/** The device pixel ratio, or 1 where the browser gives none. */
const getDeviceRatio = () => ((Number.isFinite(window.devicePixelRatio) && (window.devicePixelRatio > 0)) ? window.devicePixelRatio : 1);

/**
 * The renderer's resolution, as Habbo's JS port sets it: the device pixel ratio when it is whole,
 * so pixel art stays on the pixel grid, and otherwise 1, the browser scaling the canvas up smoothly
 * (`GetCanvasImageRendering`). Rounding a fractional ratio instead drew 1.5 at 2 - 1.8 times the
 * pixels - only for the browser to drop every fourth row and column of them again, and drew 1.25
 * at 1 with every fourth one doubled.
 */
export const GetPixelRatio = () => {
    const ratio = getDeviceRatio();

    return Number.isInteger(ratio) ? ratio : 1;
};

/** How the browser scales the canvas to the screen: whole pixels at a whole ratio, smoothly otherwise. */
export const GetCanvasImageRendering = () => (Number.isInteger(getDeviceRatio()) ? 'pixelated' : 'auto');
