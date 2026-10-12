/**
 * `uibuilder/presets/sections/ValueOrVariableSection` - a number a box takes either as typed
 * (`variables.reference_value.set_value`, a number input) or from a variable
 * (`variables.reference_value.from_variable`, with the source type selector at the right end of
 * the option's row and the variable picker under it). Only variables with a value can be picked
 * (`valueOrVariableFilter`).
 *
 * Controlled: `state` is a `WiredValueOrVariableState` in the form (`createValueOrVariableState`
 * is Flash's `init`); `onChange` gets the next state - and, for a picker change, the variable, as
 * the picker's selection callback. What Flash's setters do in the dialog becomes the element's:
 *
 * - The selector's `sourceType` setter is `onSourceTypeSelect`. Flash hands it to
 *   `wiredCtrl.setMergedSourceType(mergedId, type)`, which switches the merged input source and
 *   calls the element's `setMergedType` - the view passes
 *   `type => setWiredMergedSourceType(mergedId, type)` and the definition's `setMergedType` does
 *   `picker: setPickerTarget(form.x.picker, type)`.
 * - Switching the radio calls `updateSourceContainer(MERGED_SOURCE, mergedId)` so the merged
 *   section greys out; here the definition's `isInputSourceDisabled` reads
 *   `isValueOrVariableSourcePickingDisabled(form.x)` and the dialog follows the form by itself.
 * - `readIntParams` sends `state.value`, `state.option`, `state.picker.target`;
 *   `readVariableIds` sends `finalizePickerSelection(ctx.roomVariables, state.picker)` (Flash's
 *   `finalizeSelection`).
 */
import { IWiredVariable } from '@nitrodevco/nitro-packets';

import { isValueOrVariableSameHolderEligible, VALUE_OR_VARIABLE_OPTION_VALUE, VALUE_OR_VARIABLE_OPTION_VARIABLE, valueOrVariableFilter, WiredValueOrVariableState } from '#base/wired';

import { WiredAlignRight } from './WiredAlignRight';
import { WiredCheckboxOption } from './WiredCheckboxOption';
import { WiredNumberInput } from './WiredNumberInput';
import { WiredRadioGroup } from './WiredRadioGroup';
import { WiredSection } from './WiredSection';
import { WiredSimpleList } from './WiredSimpleList';
import { WiredSourceTypeSelector } from './WiredSourceTypeSelector';
import { WiredVariablePicker } from './WiredVariablePicker';

/** `NumberInputParam(0, min, max, 45, 0, false, true)` - the value input also takes `0x` / `0b` numbers. */
const VALUE_INPUT_WIDTH = 45;

export interface WiredValueOrVariableSectionProps {
    /** The section title - a literal or `${key}`. */
    title: string;
    /** `mergedSourceOptions(mergedId)` - the source types the selector offers. */
    sourceTypeOptions: readonly number[];
    /** The number input's range. */
    min: number;
    max: number;
    state: WiredValueOrVariableState;
    onChange: (state: WiredValueOrVariableState, variable?: IWiredVariable | null) => void;
    /** The selector picked another source type - see the docblock. */
    onSourceTypeSelect: (sourceType: number) => void;
    /** `wiredContext.roomVariablesList.variables` (`getWiredRoomVariables`). */
    variables: readonly IWiredVariable[] | null | undefined;
    roomId: number;
    /**
     * `param9` with the box's own target (`primaryTarget`): shows the "same holder" checkbox
     * under the picker (WIN63-202610121624). Flash keeps it in the section's variable popup; the
     * unified input with its popup (`ValueOrVariableInputPreset` / `ValueOrVariablePopupPreset`)
     * is not ported yet, so it sits in this section's variable option.
     */
    sameHolderTarget?: number;
}

export const WiredValueOrVariableSection = ({ title, sourceTypeOptions, min, max, state, onChange, onSourceTypeSelect, variables, roomId, sameHolderTarget }: WiredValueOrVariableSectionProps) => {
    const picker = (
        <WiredVariablePicker
            variables={variables}
            state={state.picker}
            onChange={(next, variable) => onChange({ ...state, picker: next }, variable)}
            filter={valueOrVariableFilter}
            roomId={roomId}
        />
    );

    return (
        <WiredSection title={title}>
            <WiredRadioGroup
                selected={state.option}
                onSelect={option => onChange({ ...state, option })}
                options={[
                    {
                        id: VALUE_OR_VARIABLE_OPTION_VALUE,
                        label: '${wiredfurni.params.variables.reference_value.set_value}',
                        extra: (
                            <WiredNumberInput
                                value={state.value}
                                onChange={value => onChange({ ...state, value })}
                                min={min}
                                max={max}
                                width={VALUE_INPUT_WIDTH}
                                nonDecimalNotations={true}
                            />
                        ),
                    },
                    {
                        id: VALUE_OR_VARIABLE_OPTION_VARIABLE,
                        label: '${wiredfurni.params.variables.reference_value.from_variable}',
                        extra: (
                            <WiredAlignRight>
                                <WiredSourceTypeSelector
                                    options={sourceTypeOptions}
                                    selected={state.picker.target}
                                    onSelect={onSourceTypeSelect}
                                />
                            </WiredAlignRight>
                        ),
                        extraUnder: (sameHolderTarget === undefined)
                            ? picker
                            : (
                                    <WiredSimpleList>
                                        {picker}
                                        <WiredCheckboxOption
                                            label="${wiredfurni.params.variables.reference_value.same_holder}"
                                            selected={!!state.sameHolder}
                                            onToggle={sameHolder => onChange({ ...state, sameHolder })}
                                            disabled={!isValueOrVariableSameHolderEligible(state, sameHolderTarget)}
                                        />
                                    </WiredSimpleList>
                                ),
                    },
                ]}
            />
        </WiredSection>
    );
};
