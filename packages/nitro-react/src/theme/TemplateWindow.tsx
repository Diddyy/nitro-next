/**
 * A Flash window template drawn in the client: loaded through `useTemplate` and drawn with the
 * client's texts and bitmaps. What the window's code does with its named elements comes in as
 * `bindings`.
 */
import { findTemplateChild, Template, TemplateBindings, TemplateView, TemplateViewProps } from '@nitrodevco/nitro-theme';
import { useCallback, useMemo } from 'react';

import { useSystemStore, useTranslation } from '#base/context/system';

import { useTemplate } from './useTemplate';

export interface TemplateWindowProps {
    id: string;
    /**
     * One window of the template, by name, drawn on its own: what the code takes out of the layout
     * it built and moves onto the desktop (`_window.desktop.addChild(_window.findChildByName("lock_info_bubble"))`).
     * Its bindings then find in it, `''` being that window.
     */
    part?: string;
    bindings?: TemplateBindings;
    /** What the window's code does once the layout is built (`TemplateView`'s `arrange`). */
    arrange?: TemplateViewProps['arrange'];
    /** How the root frame opens, when the template is a window of its own (`TemplateView`'s `frame`). */
    frame?: TemplateViewProps['frame'];
    /** The window's size as its code sets it (`TemplateView`'s `width` / `height`). */
    width?: number;
    height?: number;
    /**
     * The parameters the window's code registers for its texts before it builds the window
     * (`Localization.registerParameter`), by key: a caption's `${key}` is read filled with them.
     */
    parameters?: Readonly<Record<string, Record<string, string>>>;
}

/** The template cut down to its window `part`, as its own template. */
const templatePart = (template: Template, part: string): Template | undefined => {
    const element = findTemplateChild(template.elements, part);

    return element && { ...template, name: `${template.name}/${part}`, width: element.width, height: element.height, elements: [ element ] };
};

/** Draws nothing until the template is loaded, as a Flash window opens once its library is in. */
export const TemplateWindow = ({ id, part, bindings, arrange, frame, width, height, parameters }: TemplateWindowProps) => {
    const loaded = useTemplate(id);
    const template = useMemo(() => (loaded && part !== undefined ? templatePart(loaded, part) : loaded), [ loaded, part ]);
    const t = useTranslation();
    // The texts' identity: a new table (texts loaded, or another language) or new parameters is a new
    // `resolveText`, which redraws every text of the template. Between those it stays the same function.
    const localizations = useSystemStore(x => x.localizations);
    const parametersKey = parameters ? JSON.stringify(parameters) : '';
    const registered = useMemo(() => (parametersKey ? JSON.parse(parametersKey) as Record<string, Record<string, string>> : undefined), [ parametersKey ]);
    const resolveText = useCallback((key: string) => (localizations[key] !== undefined ? t(key, '', registered?.[key]) : undefined), [ t, localizations, registered ]);
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
