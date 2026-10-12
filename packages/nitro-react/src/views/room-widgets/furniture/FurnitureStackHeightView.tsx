import { Container as PixiContainer, FederatedPointerEvent } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

import { useTranslation } from '#base/context/system';
import { TemplateWindow } from '#base/theme';

/** `CustomStackHeightWidget.SLIDER_RANGE`: the slider spans 0 to 10 tiles. */
const SLIDER_RANGE = 10;
/** `slider` is 206 wide and its button `SLIDER_BUTTON_WIDTH` 20, so the button travels 186px. */
const SLIDER_WIDTH = 206;
const SLIDER_BUTTON_WIDTH = 20;
const SLIDER_TRAVEL = SLIDER_WIDTH - SLIDER_BUTTON_WIDTH;
/** `SLIDER_LIVE_UPDATE_INTERVAL_MS`: while the button is dragged the height goes out at most this often. */
const SLIDER_LIVE_UPDATE_INTERVAL_MS = 30;
/** The nudge the move buttons make here - see the docblock. */
const STEP = 0.1;
/** The frame's `height_max` (a walk tile, with `walktile_container`) and `height_min` (any other furni). */
const WALK_HEIGHT = 210;
const STACK_HEIGHT = 185;

export interface FurnitureStackHeightViewProps {
    height: number;
    multiWalkMode: boolean;
    /** A walk-magic tile: Flash's walk variant, with the multi walk toggle and the `widget.custom.walk.*` texts. */
    isWalkTile: boolean;
    onApply: (height: number, multiWalkMode: boolean) => void;
    /** Hands the tile back to normal stacking, the layout's "place on top". */
    onAboveStack: () => void;
    onClose: () => void;
}

/** `currentHeightValue`: the input's number, or 0 when it is not one. */
const parseHeight = (value: string) => {
    const height = parseFloat(value);

    return Number.isNaN(height) ? 0 : height;
};

const clampSliderX = (x: number) => Math.max(0, Math.min(SLIDER_TRAVEL, x));

/** `updateHeightSelection`: the button's place along the slider, in hundredths of a tile. */
const heightAtSliderX = (x: number) => Math.trunc((clampSliderX(x) / SLIDER_TRAVEL) * SLIDER_RANGE * 100) / 100;

/** `updateSlider`: where the button sits for a height, capped at the slider's end. */
const sliderXForHeight = (height: number) => Math.trunc(SLIDER_TRAVEL * Math.min(height / SLIDER_RANGE, 1));

/**
 * The stacking helper, on the `custom_stack_height` layout (320x210) that
 * `CustomStackHeightWidget.createWindow` builds and centres. `open` makes it the walk or the
 * stack variant: a walk tile keeps `walktile_container` and the frame's `height_max`, anything
 * else hides it and drops to `height_min`, and the frame's caption and `height_text` are
 * `widget.custom.walk|stack.height.title|text`. Heights go out in hundredths of a tile, so 1.5
 * tiles is 150 on the wire.
 *
 * The slider is `windowProcedure`'s: pressing the `slider` track puts `slider_button` at the
 * pointer and sends that height; dragging the button (`WE_RELOCATED`) writes the height into
 * `input_height` and sends it live, at most every 30ms, and once more on release. Enter in the
 * input sends what is typed; leaving it with an unsent edit puts the furni's height back
 * (`onInputHeightUnfocus`). `button_floor_level` sends 0, `button_above_stack` hands the tile back
 * to normal stacking, and `multiwalk_checkbox` sends the height with the flag.
 *
 * `button_move_up` / `button_move_down` send `SetAdjacentCustomStackingHeightComposer` in Flash,
 * letting the server pick the next stacking height; that composer is not in the port's packets,
 * so here they nudge the height by 0.1 and send it. The button's double click (whole tiles) is
 * not ported.
 */
export const FurnitureStackHeightView = ({ height, multiWalkMode, isWalkTile, onApply, onAboveStack, onClose }: FurnitureStackHeightViewProps) => {
    const [ draft, setDraft ] = useState<string>(height.toString());
    const [ edited, setEdited ] = useState<boolean>(false);
    const [ lastHeight, setLastHeight ] = useState<number>(height);
    const [ multiWalk, setMultiWalk ] = useState<boolean>(multiWalkMode);
    const [ dragX, setDragX ] = useState<number | null>(null);
    const t = useTranslation();
    const stopDragRef = useRef<(() => void) | null>(null);

    useEffect(() => () => stopDragRef.current?.(), []);

    // The server's own height wins whenever it changes under us, unless the height is being dragged or typed (`canApplyLiveHeight`).
    if ((height !== lastHeight) && (dragX === null) && !edited) {
        setLastHeight(height);
        setDraft(height.toString());
    }

    const send = (value: number) => onApply(value, multiWalk);

    const setAltitude = (value: number) => {
        setEdited(false);
        setDraft(value.toString());
        send(value);
    };

    // `slider`'s `WME_CLICK`, at the pointer's `localX` - a press that started on the button is the button's.
    const onTrackTap = (event: FederatedPointerEvent) => {
        const track = event.currentTarget as PixiContainer | null;

        if (!track || (dragX !== null)) return;

        const value = heightAtSliderX(event.getLocalPosition(track).x);

        setEdited(false);
        setDraft(value.toString());
        send(value);
    };

    const onButtonDown = (event: FederatedPointerEvent) => {
        if (event.button !== 0) return;

        stopDragRef.current?.();

        const startX = sliderXForHeight(parseHeight(draft));
        const startClientX = event.clientX;
        let lastSent = -SLIDER_LIVE_UPDATE_INTERVAL_MS;
        let latest = parseHeight(draft);

        setEdited(false);
        setDragX(startX);

        const move = (moveEvent: PointerEvent) => {
            const x = clampSliderX(startX + (moveEvent.clientX - startClientX));

            latest = heightAtSliderX(x);
            setDragX(x);
            setDraft(latest.toString());

            if ((moveEvent.timeStamp - lastSent) >= SLIDER_LIVE_UPDATE_INTERVAL_MS) {
                lastSent = moveEvent.timeStamp;
                send(latest);
            }
        };

        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            stopDragRef.current = null;
        };

        const up = () => {
            stop();
            setDragX(null);
            send(latest);
        };

        stopDragRef.current = stop;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const sliderX = dragX ?? sliderXForHeight(parseHeight(draft));
    const variant = isWalkTile ? 'walk' : 'stack';

    return (
        <TemplateWindow
            id="habbo-room-ui-com/custom_stack_height_xml"
            frame={{ id: 'custom_stack_height', centered: true, rememberPosition: false, onClose }}
            height={isWalkTile ? WALK_HEIGHT : STACK_HEIGHT}
            bindings={{
                '': { caption: t(`widget.custom.${variant}.height.title`) },
                height_text: { caption: t(`widget.custom.${variant}.height.text`) },
                walktile_container: { visible: isWalkTile },
                multiwalk_checkbox: {
                    selected: multiWalk,
                    onPointerTap: () => {
                        setMultiWalk(!multiWalk);
                        onApply(parseHeight(draft), !multiWalk);
                    },
                },
                slider: { onPointerTap: onTrackTap },
                slider_button: {
                    onPointerDown: onButtonDown,
                    // The button's own click is not the track's.
                    onPointerTap: event => event.stopPropagation(),
                },
                input_height: {
                    caption: draft,
                    onChange: (value) => {
                        setEdited(true);
                        setDraft(value);
                    },
                    onEnter: () => setAltitude(parseHeight(draft)),
                    onBlur: () => {
                        if (!edited) return;

                        setEdited(false);
                        setDraft(height.toString());
                    },
                },
                button_above_stack: { onPointerTap: onAboveStack },
                button_floor_level: { onPointerTap: () => setAltitude(0) },
                button_move_down: { onPointerTap: () => setAltitude(Math.max(0, Math.round((parseHeight(draft) - STEP) * 100) / 100)) },
                button_move_up: { onPointerTap: () => setAltitude(Math.round((parseHeight(draft) + STEP) * 100) / 100) },
            }}
            arrange={({ find }) => find('slider_button')?.setX(sliderX)}
        />
    );
};
