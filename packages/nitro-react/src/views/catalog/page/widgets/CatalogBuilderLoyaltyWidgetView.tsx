import { Template, TemplateElement } from '@nitrodevco/nitro-theme';

import { showPurchaseConfirmation } from '#base/commands';
import { CatalogPage, useCatalogStoreApi } from '#base/context/catalog';
import { useConfigData, useSystemStore, useTranslation } from '#base/context/system';
import { findTemplateChild, useTemplateLibrary } from '#base/theme';

import { CatalogWidgetProps } from '../CatalogPageRegistry';
import { CATALOG_LIBRARY, resolveCatalogPageTemplate } from '../catalogTemplates';
import { useCatalogWidgetView } from '../catalogWidgetView';
import { priceDisplayItem } from './catalogPrice';

/**
 * `removeListItemAt(0)`: the row the page's layout holds as the first item of its list, the
 * prototype every offer's row is cloned from.
 */
const findListPrototype = (templates: Record<string, Template> | undefined, page: CatalogPage, list: string): TemplateElement | undefined => {
    const templateId = resolveCatalogPageTemplate(templates, page.layoutCode);
    const template = (templates && templateId) ? templates[templateId] : undefined;

    return template ? findTemplateChild(template.elements, list)?.children[0] : undefined;
};

/**
 * The Builders Club loyalty list - the `builderLoyaltyWidget` container of
 * `layout_builders_club_loyalty.xml`, Flash's `BuilderLoyaltyCatalogWidget`, which attaches no
 * view: it works on the layout's own children. `init` takes the first row out of `loyalty_list`
 * and adds a clone of it for every offer of the page: `item_header` the offer's name, its price in
 * `item_cost_box` (`HabboCatalogUtils.showPriceInContainer`), and `item_buy` opening the purchase
 * confirmation for the offer (`windowProcedure`). Unlike the add-ons, nothing here depends on the
 * membership.
 */
export const CatalogBuilderLoyaltyWidgetView = ({ page }: CatalogWidgetProps) => {
    const store = useCatalogStoreApi();
    const productData = useSystemStore(x => x.productData);
    const config = useConfigData();
    const t = useTranslation();
    const templates = useTemplateLibrary(CATALOG_LIBRARY);
    const prototype = findListPrototype(templates, page, 'loyalty_list');

    useCatalogWidgetView((templates && prototype) && {
        bindings: {
            loyalty_list: {
                items: page.offers.map(offer => ({
                    key: String(offer.offerId),
                    from: prototype,
                    bindings: {
                        item_header: { caption: productData[offer.localizationId]?.name ?? t(offer.localizationId) },
                        item_cost_box: { items: [ priceDisplayItem(templates, offer, { config }) ] },
                        item_buy: { onPointerTap: () => showPurchaseConfirmation(store, offer, page.pageId) },
                    },
                })),
            },
        },
    });

    return null;
};
