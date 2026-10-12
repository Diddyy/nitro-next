/**
 * Flash's obfuscated `_-xw.getColors` (WIN63-202610121624): the colours a recolorable furni
 * class may take, from two external variables - `recolorable_bc.palette_to_furni`
 * (`palette=class1,class2;...`, the palette `default` for a class it does not name) and
 * `recolorable_bc.palette.<name>` (`RRGGBB,...`). Read through `configReader`'s `configString`, as
 * Flash's `getProperty`. Empty when the palette is unset; an entry that is not six hex digits is
 * left out.
 */
export const getRecolorableColors = (configString: (key: string) => string, className: string): number[] => {
    let paletteName = 'default';

    for (const entry of configString('recolorable_bc.palette_to_furni').split(';')) {
        const pair = entry.split('=');

        if (pair.length !== 2) continue;

        if (pair[1].split(',').some(name => name.trim() === className)) paletteName = pair[0].trim();
    }

    return configString(`recolorable_bc.palette.${paletteName}`)
        .split(',')
        .map(color => color.trim())
        .filter(color => /^[0-9a-fA-F]{6}$/.test(color))
        .map(color => parseInt(color, 16));
};
