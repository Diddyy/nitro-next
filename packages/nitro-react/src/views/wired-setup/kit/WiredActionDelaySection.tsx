/**
 * `uibuilder/presets/sections/ActionDelaySection` (WIN63-202610121624) - an action's delay, in
 * one of two modes picked in the section header (`delay.mode.standard` / `delay.mode.precise`):
 * standard is 0 to 120 half-second pulses (60 s), precise 0 to 1200 steps of 0.05 s. The title is
 * `delay.seconds` with the number input on its left, which the slider and the input keep in step.
 *
 * Controlled: `value` is the saved delay as `encodedDelay` writes it - the pulses, or for a
 * precise delay minus its milliseconds (`-(steps * 50)`), so a negative value opens in precise
 * mode. The mode itself is local, as Flash's dropdown is: a precise delay of 0 is saved as 0 and
 * opens as standard again.
 *
 * Flash puts the mode in a `MiniIconDropdownPreset` (the `delay_standard` / `delay_precise` icon,
 * 90px dropdown); those two icons are not in the client's wired assets yet, so the dropdown itself
 * sits in the header.
 */
import { useState } from 'react';

import { SLIDER_CONVERTER_PRECISE_DELAY, SLIDER_CONVERTER_PULSES } from '#base/wired';

import { WiredDropdown } from './WiredDropdown';
import { WiredNumberInput } from './WiredNumberInput';
import { WiredSection } from './WiredSection';
import { WiredSlider } from './WiredSlider';
import { useWiredStyle } from './WiredStyleContext';

/** `MODE_STANDARD` / `MODE_PRECISE`. */
const MODE_STANDARD = 0;
const MODE_PRECISE = 1;

/** `STANDARD_MAX` / `PRECISE_MAX`. */
const STANDARD_MAX = 120;
const PRECISE_MAX = 1200;

/** The milliseconds of one precise step (`encodedDelay = -(steps * 50)`). */
const PRECISE_STEP_MS = 50;

/** `DELAY_INPUT_WIDTH` / `MODE_DROPDOWN_WIDTH`. */
const DELAY_INPUT_WIDTH = 40;
const MODE_DROPDOWN_WIDTH = 90;

export interface WiredActionDelaySectionProps {
    value: number;
    onChange: (value: number) => void;
}

export const WiredActionDelaySection = ({ value, onChange }: WiredActionDelaySectionProps) => {
    const style = useWiredStyle();
    const [ mode, setMode ] = useState(value < 0 ? MODE_PRECISE : MODE_STANDARD);
    const precise = mode === MODE_PRECISE;
    const converter = precise ? SLIDER_CONVERTER_PRECISE_DELAY : SLIDER_CONVERTER_PULSES;
    const max = precise ? PRECISE_MAX : STANDARD_MAX;
    // What the active slider holds; the other mode's slider starts at 0 (`encodedDelay` setter).
    const active = precise ? ((value < 0) ? Math.abs(value) / PRECISE_STEP_MS : 0) : Math.max(0, value);
    const encode = (next: number) => onChange(precise ? -(next * PRECISE_STEP_MS) : next);

    const selectMode = (next: number) => {
        if (next === mode) return;

        setMode(next);
        onChange(0);
    };

    return (
        <WiredSection
            title="${wiredfurni.params.delay.seconds}"
            titleYOffset={style.namedInputOffset}
            headerOptionLeft={(
                <WiredNumberInput
                    value={active}
                    onChange={encode}
                    min={0}
                    max={max}
                    width={DELAY_INPUT_WIDTH}
                    precision={converter.precision}
                    endsWithFive={converter.endsWithFive}
                />
            )}
            headerOptions={(
                <WiredDropdown
                    options={[
                        { id: MODE_STANDARD, label: '${wiredfurni.params.delay.mode.standard}' },
                        { id: MODE_PRECISE, label: '${wiredfurni.params.delay.mode.precise}' },
                    ]}
                    selected={mode}
                    onSelect={selectMode}
                    width={MODE_DROPDOWN_WIDTH}
                />
            )}
        >
            <WiredSlider
                min={0}
                max={max}
                step={1}
                value={active}
                onChange={encode}
            />
        </WiredSection>
    );
};
