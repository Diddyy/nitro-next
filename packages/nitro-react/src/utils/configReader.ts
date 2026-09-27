/**
 * Flash's `getProperty` / `getBoolean` over the client config, which stands in for the hotel's
 * `external_variables`:
 *
 * - `configString`: the value with every `${key}` placeholder filled from the other values
 *   (`${image.library.url}reception/...`), `''` when the key is unset - `getProperty`.
 * - `configBoolean`: only `true`, `"true"` and `"1"` count; anything else, an unset key included,
 *   is Flash's `false` default - `getBoolean`.
 * - `resolve`: the placeholders of any string filled the same way - a layout's own `asset_uri`,
 *   which Flash expands against the same variables.
 *
 * The methods keep those names so `scripts/drift/config_keys.py` sees every literal key read
 * through them: destructure the reader and call `configString('landing.view.bgtiming')`.
 */
export const configReader = (config: Record<string, unknown>) => {
    const resolve = (value: string): string => value.replace(/\$\{([^}]*)\}/g, (match, name: string) => {
        const replacement = config[name];

        return ((typeof replacement === 'string') || (typeof replacement === 'number')) ? String(replacement) : match;
    });

    const configString = (key: string): string => {
        const value = config[key];

        if ((typeof value !== 'string') && (typeof value !== 'number')) return '';

        return resolve(String(value));
    };

    const configBoolean = (key: string): boolean => {
        const value = config[key];

        return (value === true) || (value === 'true') || (value === '1');
    };

    return { configString, configBoolean, resolve };
};
