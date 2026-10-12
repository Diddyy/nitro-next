/**
 * The `comparison_selection` section several conditions build the same way in their
 * `buildInputs` (`TeamHasScore`, `ClockTimeMatches`, `FurniHasAltitude`, `LevelMatches`,
 * `§_-je§`): a radio of `comparison.<id>` - less than, equal, greater than - one per row.
 * `§_-mb§` offers only two of the three, through `ids`.
 */
import { CONDITION_COMPARISON_IDS } from '#base/wired';

import { WiredRadioGroup } from '../../../kit/WiredRadioGroup';
import { WiredSection } from '../../../kit/WiredSection';

export interface ConditionComparisonSectionProps {
    selected: number;
    onSelect: (comparison: number) => void;
    /** The radio's ids, `comparison.<id>` each. Default 0, 1 and 2. */
    ids?: readonly number[];
    /** The radio's column count (`createRadioGroup(..., null, columns)`). Default 1. */
    columns?: number;
}

export const ConditionComparisonSection = ({ selected, onSelect, ids = CONDITION_COMPARISON_IDS, columns = 1 }: ConditionComparisonSectionProps) => (
    <WiredSection title="${wiredfurni.params.comparison_selection}">
        <WiredRadioGroup
            options={ids.map(id => ({ id, label: `\${wiredfurni.params.comparison.${id}}` }))}
            selected={selected}
            onSelect={onSelect}
            columns={columns}
        />
    </WiredSection>
);
