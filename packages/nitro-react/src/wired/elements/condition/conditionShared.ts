/**
 * What several condition elements share and Flash writes out in each of them: the comparison
 * radio (`comparison.0` to `.2`) and the source type a merged section opens on. The six operator
 * symbols of the variable and chest conditions are `WIRED_COMPARISON_OPERATORS`
 * (`wired/common/operatorRadios`), and the slider's clamping (`SliderWindowControllerNew.setValue`)
 * is `clampSliderValue` in `wired/common/WiredUtil`.
 */
import { resolveSourceTypeSelection } from '../../common/sourceTypeColors';
import type { WiredElementContext, WiredElementDefinition } from '../../WiredElement';
import { getMergedSourceOptions, getMergedType } from '../../WiredInputSources';

/** `RadioButtonParam(0, l("comparison.0"))` ... `(2, l("comparison.2"))` - less than, equal, greater than. */
export const CONDITION_COMPARISON_IDS = [ 0, 1, 2 ];

/** `mergedSourceOptions(id)` of a condition element and its form - what its own type picker offers. */
export const conditionMergedSourceOptions = <F>(definition: WiredElementDefinition<F>, form: F, id: number, ctx: WiredElementContext): number[] =>
    getMergedSourceOptions(definition, form, id, ctx);

/**
 * `onEditInitialized`'s `getSourceTypeSelector().select(target)` on a box whose element draws its
 * own type picker: a target the selector does not offer leaves it on the first option, which
 * `initialize` clicked, and that is what the box saves. Applied to every merged section of the
 * element, through its own `setMergedType`.
 */
export const resolveConditionMergedTypes = <F>(definition: WiredElementDefinition<F>, form: F, ctx: WiredElementContext): F => {
    let next = form;

    (definition.mergedSelections ?? []).forEach((_, id) => {
        const current = getMergedType(definition, next, id);
        const resolved = resolveSourceTypeSelection(conditionMergedSourceOptions(definition, next, id, ctx), current);

        if ((resolved !== current) && definition.setMergedType) next = definition.setMergedType(next, id, resolved);
    });

    return next;
};
