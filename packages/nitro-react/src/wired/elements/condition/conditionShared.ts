/**
 * What several condition elements share and Flash writes out in each of them: the comparison
 * radio (`comparison.0` to `.2`) and the source types a merged section's own picker offers. The six operator
 * symbols of the variable and chest conditions are `WIRED_COMPARISON_OPERATORS`
 * (`wired/common/operatorRadios`), and the slider's clamping (`SliderWindowControllerNew.setValue`)
 * is `clampSliderValue` in `wired/common/WiredUtil`.
 */
import type { WiredElementContext, WiredElementDefinition } from '../../WiredElement';
import { getMergedSourceOptions } from '../../WiredInputSources';

/** `RadioButtonParam(0, l("comparison.0"))` ... `(2, l("comparison.2"))` - less than, equal, greater than. */
export const CONDITION_COMPARISON_IDS = [ 0, 1, 2 ];

/** `mergedSourceOptions(id)` of a condition element and its form - what its own type picker offers. */
export const conditionMergedSourceOptions = <F>(definition: WiredElementDefinition<F>, form: F, id: number, ctx: WiredElementContext): number[] =>
    getMergedSourceOptions(definition, form, id, ctx);
