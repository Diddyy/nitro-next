/**
 * What the client's one renderer does when the GPU is taken from it - a GPU process crash, a driver
 * reset, the GPU removed or the browser reclaiming it: a lost WebGPU device (its `lost` promise) or
 * a lost WebGL context (`webglcontextlost`).
 *
 * Pixi restores either itself (`GpuDeviceSystem` asks for a new adapter and device, `GlContextSystem`
 * prevents the event's default so the browser gives the context back) and emits `contextChange`,
 * which re-creates every buffer, texture and pipeline. It cannot give back what was only ever drawn
 * on the GPU: every render texture comes back empty - the room's planes and avatars, the generated
 * text and icons - and the client never draws them again, so a restored client shows a black room.
 * And under WebGPU, until a new device is there every frame still draws with the lost one: the first
 * new buffer one makes (a sprite batch, a window) is created `mappedAtCreation`, gets no mapping and
 * throws (Chrome: "createBuffer failed, size (n) is too large for the implementation when
 * mappedAtCreation == true"). The throw escapes the ticker's frame, and `Ticker._tick` only asks for
 * the next frame after `update` returned, so it stops the shared ticker - the room and the UI with
 * it - for good. When no adapter is returned any more (after repeated GPU crashes the browser stops
 * offering WebGPU to the page) Pixi only warns, and that is every frame from then on.
 *
 * So from the moment the WebGPU device is lost until `contextChange` brings a new one, the renderer
 * draws nothing (`render` returns at once, for the stage and for render-to-texture alike) and the
 * ticker keeps running; and each loss calls `onLost`, for the app to start again. A lost
 * WebGL context's calls do nothing rather than throw, so it needs only the latter.
 */
import { Renderer, RendererType, WebGLRenderer, WebGPURenderer } from 'pixi.js';

/** Installs the guard on `renderer`. */
export const guardGpuLoss = (renderer: Renderer, onLost?: () => void): void => {
    const report = () => onLost?.();

    if (Number(renderer.type) === Number(RendererType.WEBGL)) {
        const glRenderer = renderer as WebGLRenderer;
        const canvas = glRenderer.canvas;
        const handleContextLost = () => {
            // `GlContextSystem.forceContextLoss`: a loss asked for, which Pixi restores at once.
            if ((glRenderer.context as unknown as { _contextLossForced?: boolean })._contextLossForced) return;

            report();
        };

        canvas.addEventListener('webglcontextlost', handleContextLost);
        // Pixi's own destroy loses the context too.
        glRenderer.runners.destroy.add({ destroy: () => canvas.removeEventListener('webglcontextlost', handleContextLost) });

        return;
    }

    if (Number(renderer.type) !== Number(RendererType.WEBGPU)) return;

    const gpuRenderer = renderer as WebGPURenderer;
    let lost = false;

    const watch = (device: GPUDevice) => {
        void device.lost.then(() => {
            // The renderer destroyed its own device (`GpuDeviceSystem.destroy` clears `gpu`).
            if (!(gpuRenderer.device as unknown as { gpu?: unknown }).gpu) return;
            // A device lost after Pixi had already moved on to a new one.
            if (gpuRenderer.gpu?.device !== device) return;

            lost = true;
            report();
        });
    };

    watch(gpuRenderer.gpu.device);

    // After Pixi's own systems: they took the new device first.
    gpuRenderer.runners.contextChange.add({
        contextChange: (gpu: { device: GPUDevice }) => {
            lost = false;
            watch(gpu.device);
        },
    });

    const render = gpuRenderer.render.bind(gpuRenderer);

    gpuRenderer.render = ((...args: Parameters<WebGPURenderer['render']>) => {
        if (lost) return;

        return render(...args);
    }) as WebGPURenderer['render'];
};
