/** The catalogue's window templates: Flash's `habbo-catalog-com` library, and the page layouts in it. */
import { Template } from '@nitrodevco/nitro-theme';

import { resolveCatalogLayout } from '#base/context/catalog';

export const CATALOG_LIBRARY = 'habbo-catalog-com';

/** A `habbo-catalog-com` asset's template id. */
export const catalogTemplateId = (name: string) => `${CATALOG_LIBRARY}/${name}`;

/** `CatalogPage.createWindow`: the page's layout's id - `layout_<name>`, or the `old_` one the library has instead. */
export const resolveCatalogPageTemplate = (templates: Record<string, Template> | undefined, layoutCode: string): string | undefined => {
    const name = resolveCatalogLayout(layoutCode);

    if (!templates || !name) return undefined;

    return [ catalogTemplateId(`layout_${name}`), catalogTemplateId(`old_layout_${name}`) ].find(id => templates[id]);
};
