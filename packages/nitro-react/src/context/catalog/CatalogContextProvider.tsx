import { CatalogTypeEnum } from '@nitrodevco/nitro-api';
import { ReactNode } from 'react';

import { CatalogContext } from './CatalogContext';
import { getCatalogStore } from './catalogStores';

type ProviderProps = {
    catalogType: CatalogTypeEnum;
    children: ReactNode;
};

/** A catalogue window's store - its type's one store (`getCatalogStore`) - for the window inside it. */
export const CatalogContextProvider = ({ catalogType, children }: ProviderProps) => (
    <CatalogContext value={getCatalogStore(catalogType)}>
        {children}
    </CatalogContext>
);
