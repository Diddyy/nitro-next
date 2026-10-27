/**
 * The windows the preview host's design window draws with the game's own view and sample content, by
 * window (the window map's id), each in named states: the catalogue on a page of each layout with its
 * parts in it (the badge display page's `badgeGridItem` per badge), where the bare template would be
 * an empty frame. Said in the host's `ready` (`states`); a `design` message picks one by `state`. Not a
 * Flash feature.
 */

/** One state: its id, the name a panel shows, and what the view is fed. */
export interface DesignState {
    id: string;
    name: string;
    /** The catalogue page's layout code (`CatalogPage.layoutCode`). */
    layout?: string;
}

/** The catalogue's states: a page per layout the hotel's front, furni and badge pages use. */
const CATALOG_STATES: DesignState[] = [
    { id: 'page:frontpage4', name: 'Front page', layout: 'frontpage4' },
    { id: 'page:default_3x3', name: 'Furni page', layout: 'default_3x3' },
    { id: 'page:badge_display', name: 'Badge display page', layout: 'badge_display' },
];

/** The states of each window drawn with its own view. */
export const DESIGN_STATES: Readonly<Record<string, readonly DesignState[]>> = {
    'habbo-catalog-com/catalog_ubuntu_with_tabs': CATALOG_STATES,
};

/** The state `id` of `window`, its first when `id` names none it has; `undefined` for a window drawn as its bare template. */
export const designState = (window: string, id: string | undefined): DesignState | undefined => {
    const states = DESIGN_STATES[window];

    return states?.find(state => state.id === id) ?? states?.[0];
};

/** The states as the host says them (`ready`): by window, each state's id and name. */
export const designStateList = () => Object.fromEntries(Object.entries(DESIGN_STATES).map(([ window, states ]) => [ window, states.map(({ id, name }) => ({ id, name })) ]));
