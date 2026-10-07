import { GetAssetManager } from '@nitrodevco/nitro-renderer';
import { Template, TemplateItem } from '@nitrodevco/nitro-theme';
import { useState } from 'react';

import { CatalogWidgetEventEnum } from '#base/context/catalog';
import { useCatalogWidgetEvent } from '#base/hooks';
import { LayoutImage, ThemeImage, useTemplateLibrary } from '#base/theme';

import { CatalogWidgetProps } from '../CatalogPageRegistry';
import { CATALOG_LIBRARY, catalogTemplateId } from '../catalogTemplates';
import { fitWidgetView, useCatalogWidgetView } from '../catalogWidgetView';

/** The swatches on show and the art they are drawn with - what `onAvailableColours` / `onAvailableMultiColours` keep. */
interface ColourGridState {
    /** One entry per swatch: one colour, or two for a two-tone swatch. */
    colours: readonly (readonly number[])[];
    backgroundAssetName: string;
    colourAssetName: string;
    chosenColourAssetName: string;
}

/** The catalogue art a colour event names (`ctlg_clr_27x22_*`, `ctlg_clr_40x32_*`), as its bundled asset. */
const catalogAsset = (name: string) => LayoutImage(`habbo-catalog-com/${name}.png`);

/** The same, as a template's asset name. */
const catalogAssetName = (name: string) => `habbo-catalog-com-${name}`;

/** A swatch's tint: `createColorContainer`'s multiply, none for a negative colour (its 255s). */
const toTint = (colour: number) => ((colour < 0) ? undefined : (colour & 0xFFFFFF));

/**
 * One swatch - `color_chooser_cell` built by `createColorContainer`: white-filled and the size of
 * the background art, the background (`BG_BORDER`), the colour art multiplied by the colour
 * (`COLOR_IMAGE`) - its right half by the second colour of a two-tone swatch, which keeps the first
 * colour when the second is negative - and the chosen art (`COLOR_CHOSEN`) on the selected one.
 */
const colourCellItem = (from: Template, colours: readonly number[], index: number, state: ColourGridState, width: number, height: number, chosen: boolean, onPress: () => void): TemplateItem => {
    const half = Math.floor(width / 2);
    const first = colours[0];
    const second = (colours.length > 1) ? ((colours[1] >= 0) ? colours[1] : first) : undefined;
    const secondTint = (second === undefined) ? undefined : toTint(second);

    return {
        key: String(index),
        from,
        bindings: {
            '': { background: true, color: 0xFFFFFFFF, onPointerTap: onPress },
            '#BG_BORDER': { asset: catalogAssetName(state.backgroundAssetName) },
            '#COLOR_IMAGE': {
                asset: catalogAssetName(state.colourAssetName),
                color: toTint(first),
                children: (second !== undefined) && (
                    <ThemeImage
                        src={catalogAsset(state.colourAssetName)}
                        frame={{ x: half, y: 0, width: width - half, height }}
                        tint={(secondTint === undefined) ? undefined : `#${secondTint.toString(16).padStart(6, '0')}`}
                        layout={{ position: 'absolute', left: half, top: 0 }}
                    />
                ),
            },
            '#COLOR_CHOSEN': { visible: chosen, asset: catalogAssetName(state.chosenColourAssetName) },
        },
        arrange: ({ root }) => root()?.setRectangle(0, 0, width, height),
    };
};

/**
 * The colour picker of a page, `colourGridWidget.xml` - Flash's `ColourGridCatalogWidget`: the
 * view takes the container's size unless it is tagged `FIXED`, and its `colourGrid` holds the
 * swatches.
 *
 * The swatches come with the events: `COLOUR_ARRAY` (one colour each, from the item grid, the
 * trophies and the old pets; the given index is selected) and `MULTI_COLOUR_ARRAY` (two-tone, from
 * the new pets; the first is selected). A click selects the swatch and sends its index
 * (`CatalogWidgetColourIndexEvent`). Each cell is as big as the event's background art.
 */
export const CatalogColourGridWidgetView = ({ page, tags }: CatalogWidgetProps) => {
    const [ state, setState ] = useState<ColourGridState | undefined>(undefined);
    const [ chosenIndex, setChosenIndex ] = useState(-1);
    const templates = useTemplateLibrary(CATALOG_LIBRARY);

    useCatalogWidgetEvent(page, CatalogWidgetEventEnum.COLOUR_ARRAY, (event) => {
        setState({ colours: event.colours.map(colour => [ colour ]), backgroundAssetName: event.backgroundAssetName, colourAssetName: event.colourAssetName, chosenColourAssetName: event.chosenColourAssetName });
        setChosenIndex(event.index);
    });

    useCatalogWidgetEvent(page, CatalogWidgetEventEnum.MULTI_COLOUR_ARRAY, (event) => {
        setState({ colours: event.colours.map(colour => colour.slice()), backgroundAssetName: event.backgroundAssetName, colourAssetName: event.colourAssetName, chosenColourAssetName: event.chosenColourAssetName });
        setChosenIndex(0);
    });

    const isFixed = tags.includes('FIXED');
    const background = state ? GetAssetManager().getTexture(catalogAsset(state.backgroundAssetName)) : undefined;
    const cellWidth = background?.width ?? 0;
    const cellHeight = background?.height ?? 0;
    // `populateColourGrid` skips an empty entry, and the index a click sends is the cell's place in the grid.
    const cells = state ? state.colours.filter(colours => (colours.length > 0)).map((colours, index) => ({ colours, index })) : [];

    const select = (index: number) => {
        setChosenIndex(index);
        page.events.dispatchEvent({ type: CatalogWidgetEventEnum.COLOUR_INDEX, index });
    };

    useCatalogWidgetView(templates && {
        template: 'colourGridWidget',
        bindings: {
            colourGrid: {
                items: (state && (cellWidth > 0))
                    ? cells.map(cell => colourCellItem(templates[catalogTemplateId('color_chooser_cell')], cell.colours, cell.index, state, cellWidth, cellHeight, cell.index === chosenIndex, () => select(cell.index)))
                    : [],
            },
        },
        arrange: isFixed ? undefined : fitWidgetView,
    });

    return null;
};
