/** The renderer's resolution: the device pixel ratio rounded to a whole number, so pixel art stays on the pixel grid. */
export const GetPixelRatio = () => Math.round(window.devicePixelRatio ?? 1);
