/**
 * A Flash window template drawn in the client: loaded through `useTemplate` and drawn with the
 * client's texts and bitmaps. What the window's code does with its named elements comes in as
 * `bindings`.
 */
import { TemplateBindings, TemplateView, TemplateViewProps } from '@nitrodevco/nitro-theme';
import { useCallback } from 'react';

import { useSystemStore, useTranslation } from '#base/context/system';

import { useTemplate } from './useTemplate';

export interface TemplateWindowProps {
    id: string;
    bindings?: TemplateBindings;
    /** What the window's code does once the layout is built (`TemplateView`'s `arrange`). */
    arrange?: TemplateViewProps['arrange'];
    /** How the root frame opens, when the template is a window of its own (`TemplateView`'s `frame`). */
    frame?: TemplateViewProps['frame'];
    /** The window's size as its code sets it (`TemplateView`'s `width` / `height`). */
    width?: number;
    height?: number;
}

/** Draws nothing until the template is loaded, as a Flash window opens once its library is in. */
export const TemplateWindow = ({ id, bindings, arrange, frame, width, height }: TemplateWindowProps) => {
    const template = useTemplate(id);
    const t = useTranslation();
    // The texts' identity: a new table (texts loaded, or another language) is a new `resolveText`,
    // which redraws every text of the template. Between those it stays the same function.
    const localizations = useSystemStore(x => x.localizations);
    const resolveText = useCallback((key: string) => (localizations[key] !== undefined ? t(key) : undefined), [ t, localizations ]);
    // A bitmap the template names is a bundled asset already: `ThemeImage` reads the name as it is.
    // A `${key}` in it is a hotel variable (`${image.library.questing.url}ach_category_pets.png`).
    const config = useSystemStore(x => x.config);
    const imageUrl = useCallback((asset: string) => asset.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
        const value = config[key];

        return (typeof value === 'string' || typeof value === 'number') ? String(value) : '';
    }), [ config ]);

    if (!template) return null;

    return (
        <TemplateView
            template={template}
            bindings={bindings}
            arrange={arrange}
            frame={frame}
            width={width}
            height={height}
            resolveText={resolveText}
            imageUrl={imageUrl}
        />
    );
};
