import { ColorTransitioner, GetRenderer, GetRoomStage, GetTicker, GetTickerTime } from '@nitrodevco/nitro-renderer';
import { Graphics } from 'pixi.js';

let colorizer: Graphics | undefined = undefined;
let transitioner: ColorTransitioner | undefined = undefined;
let roomColor: number = 0xFFFFFF;

const redraw = () => {
    if (!colorizer) return;

    const { width, height } = GetRenderer().screen;

    colorizer.clear();
    colorizer.rect(0, 0, width, height).fill(roomColor);
    // White multiplies to nothing; skip drawing a full-screen blend for it.
    colorizer.visible = (roomColor !== 0xFFFFFF);
};

/** `RoomDesktop.updateColor`, every frame: the fade moves on, and the colorizer stays above the room canvas. */
const update = () => {
    if (!colorizer || !transitioner) return;

    const stage = GetRoomStage();

    if (stage.children[stage.children.length - 1] !== colorizer) stage.addChild(colorizer);

    if (!transitioner.updateColor(GetTickerTime())) return;

    roomColor = transitioner.color;

    redraw();
};

/**
 * `RoomDesktop.setRoomViewColor`: the room view's colorizer - Flash's `colorizer_wrapper`, a
 * `multiply` sprite laid over the room canvas (`room_view_container`) - fades to a colour and
 * brightness over 1.5 s (`ColorTransitioner`). It tints everything in the room, planes, furni and
 * people alike, where a background-only colour tints the planes alone (`RoomLogic`). Nothing
 * exists until a colour is first set.
 */
export const SetRoomViewColor = (color: number, light: number) => {
    if (!colorizer) {
        colorizer = new Graphics({ label: 'room-view-colorizer', blendMode: 'multiply', eventMode: 'none' });
        transitioner = new ColorTransitioner();
        roomColor = 0xFFFFFF;

        GetRoomStage().addChild(colorizer);
        GetRenderer().on('resize', redraw);
        GetTicker().add(update);

        redraw();
    }

    transitioner?.startTransition(color, light, GetTickerTime());
};

/** `RoomDesktop.dispose`: the colorizer goes with the room; the next room starts white. */
export const DisposeRoomViewColor = () => {
    if (!colorizer) return;

    GetTicker().remove(update);
    GetRenderer().off('resize', redraw);
    colorizer.destroy();

    colorizer = undefined;
    transitioner = undefined;
    roomColor = 0xFFFFFF;
};
