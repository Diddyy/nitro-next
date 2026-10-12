import { useTranslation } from '#base/context/system';
import { LayoutImage } from '#base/theme';

import { FurnitureTemplatePanel } from './FurnitureTemplatePanel';

/**
 * `TrophyTheme`: gold, silver and bronze - the plaque's art (`BACKGROUND_ASSET_NAMES`) and the colour
 * of its title bar (`HEADER_COLORS`) both follow the theme, and anything outside 0-2 is gold
 * (`normalize`). The colours are whole `0xAARRGGBB` values: `title_bg` fills with
 * the colour it is given, alpha and all.
 */
const TROPHY_THEMES = [
    { background: 'habbo-room-ui-com/trophy_bg_gold.png', header: 0xffecc547 },
    { background: 'habbo-room-ui-com/trophy_bg_silver.png', header: 0xffc9bdcc },
    { background: 'habbo-room-ui-com/trophy_bg_bronze.png', header: 0xffb87834 },
];

export interface FurnitureTrophyViewProps {
    /**
     * The `TrophyTheme`: 0 gold, 1 silver, 2 bronze, anything else gold. A trophy's is its furni colour
     * less one (`TrophyFurniWidget`), the furni colours counting from 1.
     */
    color: number;
    /** The plaque's own title (`frameTitle`); a trophy says "Trophy", a badge display says what it is. */
    title?: string;
    ownerName: string;
    date: string;
    message: string;
    onClose: () => void;
}

/**
 * A trophy's engraving, on the plaque itself - `TrophyView.showInterface`, which builds the `trophy`
 * layout and centres it: `title_bg` coloured by the theme (`headerColor`), `title` the widget's
 * `frameTitle`, `greeting` the engraving (its literal `\r`s made line breaks), `date` and `name`, and
 * `trophy_bg` the theme's plaque art. The plaque drags by itself (`draggable_with_mouse`), and its
 * close button is part of the art: the layout only puts the invisible `close` region over it.
 * Read-only; a trophy is engraved when it is bought, never afterwards.
 *
 * The texts are set once the window is built: `name` (`on_accommodate_align_right`) keeps its right
 * edge and `title` its centre as they fit their texts.
 *
 * `trophy_bg.color` is `TrophyFurniWidget.color`, white: no tint.
 */
export const FurnitureTrophyView = ({ color, title, ownerName, date, message, onClose }: FurnitureTrophyViewProps) => {
    const theme = TROPHY_THEMES[color] ?? TROPHY_THEMES[0];
    const t = useTranslation();

    return (
        <FurnitureTemplatePanel
            id="habbo-room-ui-com/trophy"
            position="center"
            bindings={{
                close: { onPointerTap: onClose },
                title_bg: { color: theme.header },
                title: { caption: title ?? t('widget.furni.trophy.title', 'Trophy'), setCaptionAfterBuild: true },
                greeting: { caption: message.replace(/\\r/g, '\n') },
                date: { caption: date },
                name: { caption: ownerName, setCaptionAfterBuild: true },
                trophy_bg: { asset: LayoutImage(theme.background) },
            }}
        />
    );
};
