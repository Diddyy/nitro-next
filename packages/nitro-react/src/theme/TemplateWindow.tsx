/**
 * A Flash window template drawn in the client: loaded through `useTemplate` and drawn with the
 * client's texts and bitmaps. What the window's code does with its named elements comes in as
 * `bindings`.
 */
import { TemplateBindings, TemplateView, TemplateViewProps } from '@nitrodevco/nitro-theme';
import { useCallback } from 'react';

import { useSystemStore, useTranslation } from '#base/context/system';

import { useTemplate } from './useTemplate';

/** A bitmap the template names is a bundled asset already: `ThemeImage` reads the name as it is. */
const imageUrl = (asset: string) => asset;

export interface TemplateWindowProps {
    id: string;
    bindings?: TemplateBindings;
    /** What the window's code does once the layout is built (`TemplateView`'s `arrange`). */
    arrange?: TemplateViewProps['arrange'];
}

/** Draws nothing until the template is loaded, as a Flash window opens once its library is in. */
export const TemplateWindow = ({ id, bindings, arrange }: TemplateWindowProps) => {
    const template = useTemplate(id);
    const t = useTranslation();
    // The texts' identity: a new table (texts loaded, or another language) is a new `resolveText`,
    // which redraws every text of the template. Between those it stays the same function.
    const localizations = useSystemStore(x => x.localizations);
    const resolveText = useCallback((key: string) => (localizations[key] !== undefined ? t(key) : undefined), [ t, localizations ]);

    if (!template) return null;

    return (
        <TemplateView
            template={template}
            bindings={bindings}
            arrange={arrange}
            resolveText={resolveText}
            imageUrl={imageUrl}
        />
    );
};
