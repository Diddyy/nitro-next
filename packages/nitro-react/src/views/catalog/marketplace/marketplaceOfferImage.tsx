import { TemplateBindings } from '@nitrodevco/nitro-theme';

import { isMarketplaceUniqueLimitedItem, MarketplaceOfferData } from '#base/utils';

import { CatalogLimitedItemGridOverlayView } from '../page/widgets/CatalogLimitedItemGridOverlayView';
import { CatalogRarityItemGridOverlayView } from '../page/widgets/CatalogRarityItemGridOverlayView';
import { CatalogMarketplaceOfferImageView } from './CatalogMarketplaceOfferImageView';

/**
 * The 40x40 `image_container` every marketplace offer row and the purchase confirmation carry, as
 * `MarketPlaceCatalogWidget.addListItem`, `MarketPlaceOwnItemsCatalogWidget.updateList` and
 * `MarketplaceConfirmationDialog.showConfirmation` set it: the icon in `item_image`; for a limited
 * item `unique_item_background_bitmap` and the `unique_item_overlay_widget`
 * (`limited_item_overlay_grid`, animated, with the stuff data's serial number) shown; for an item
 * whose stuff data has a rarity level (`rarityLevel >= 0`) the `rarity_item_overlay_widget`
 * (`rarity_item_overlay_grid`) shown. The overlays are window-manager widgets, injected.
 */
export const marketplaceOfferImageBindings = (offer: MarketplaceOfferData, withExtraData: boolean): TemplateBindings => {
    const isLimited = isMarketplaceUniqueLimitedItem(offer) && !!offer.stuffData;
    const rarityLevel = offer.stuffData?.rarityLevel ?? -1;

    return {
        'image_container/item_image': {
            children: (
                <CatalogMarketplaceOfferImageView
                    offer={offer}
                    withExtraData={withExtraData}
                    width={40}
                    height={40}
                />
            ),
        },
        'image_container/unique_item_background_bitmap': { visible: isLimited },
        'image_container/unique_item_overlay_widget': isLimited
            ? { visible: true, children: <CatalogLimitedItemGridOverlayView serialNumber={offer.stuffData?.uniqueNumber ?? 0} /> }
            : { visible: false },
        'image_container/rarity_item_overlay_widget': (rarityLevel >= 0)
            ? { visible: true, children: <CatalogRarityItemGridOverlayView rarityLevel={rarityLevel} /> }
            : { visible: false },
    };
};
