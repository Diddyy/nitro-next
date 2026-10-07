/**
 * What the avatar editor does about the parts and colours the user may not wear - Flash
 * `HabboAvatarEditor.hasInvalidClubItems` / `hasInvalidSellableItems` / `stripClubItems` /
 * `stripInvalidSellableItems` over its category models (`CategoryBaseModel`, `CategoryData`), on
 * the editing figure in `avatarEditorStore`.
 *
 * The categories are the editor's: generic, head, torso and legs, and misc with
 * `clothing.misc.tab.enabled` - their set types are the ones checked.
 *
 * `CategoryData.stripClubItemsOverLevel` selects the grid's first item, and the one after it when
 * that is the remove item - with `avatareditor.show.clubitems.first` that can be another club item,
 * which leaves the figure as invalid as it was. The port takes the first item of the grid the user
 * may wear instead, and removes the part when there is none and the set type is not mandatory.
 */
import { AvatarFigurePartType } from '@nitrodevco/nitro-api';
import { GetAvatarRenderManager } from '@nitrodevco/nitro-renderer';

import { avatarEditorStore } from '#base/context/avatar-editor';
import { systemStore } from '#base/context/system';
import { firstSelectableColorId, getAvatarEditorPartSets } from '#base/utils';

/** The set types of the editor's part categories (`getCategoryValues`). */
const CATEGORY_SET_TYPES: readonly string[] = [
    AvatarFigurePartType.Head,
    AvatarFigurePartType.Hair, AvatarFigurePartType.HeadAccessory, AvatarFigurePartType.HeadAccessoryExtra, AvatarFigurePartType.EyeAccessory, AvatarFigurePartType.FaceAccessory,
    AvatarFigurePartType.Chest, AvatarFigurePartType.ChestPrint, AvatarFigurePartType.CoatChest, AvatarFigurePartType.ChestAccessory,
    AvatarFigurePartType.Legs, AvatarFigurePartType.Shoes, AvatarFigurePartType.WaistAccessory,
];
const MISC_SET_TYPES: readonly string[] = [ AvatarFigurePartType.Pet, AvatarFigurePartType.Misc ];

const configFlag = (key: string) => systemStore.getState().config[key] === true;

const editorSetTypes = () => (configFlag('clothing.misc.tab.enabled') ? [ ...CATEGORY_SET_TYPES, ...MISC_SET_TYPES ] : CATEGORY_SET_TYPES);

/** The editing figure's worn part set and colours for a set type, as the structure has them. */
const wornOf = (setType: string) => {
    const worn = avatarEditorStore.getState().parts[setType];
    const structure = GetAvatarRenderManager().structureData;
    const type = structure.getSetType(setType);
    const palette = type && structure.getPalette(type.paletteId);

    if (!worn || !type) return undefined;

    return { worn, type, partSet: type.getPartSet(worn.setId), colors: worn.colorIds.map(colorId => palette?.getColor(colorId)) };
};

/** `hasInvalidClubItems` (`CategoryData.hasClubSelectionsOverLevel`): a worn part or colour above the club level. */
export const hasAvatarEditorInvalidClubItems = (clubLevel: number): boolean => editorSetTypes().some((setType) => {
    const worn = wornOf(setType);

    if (!worn) return false;

    return ((worn.partSet?.clubLevel ?? 0) > clubLevel) || worn.colors.some(color => !!color && (color.clubLevel > clubLevel));
});

/** `hasInvalidSellableItems`: a worn sellable part the user does not own. */
export const hasAvatarEditorInvalidSellableItems = (): boolean => {
    const { figureSetIds } = avatarEditorStore.getState();

    return editorSetTypes().some((setType) => {
        const partSet = wornOf(setType)?.partSet;

        return !!partSet && partSet.isSellable && !figureSetIds.includes(partSet.id);
    });
};

/** A replacement for a worn part the user may not wear: the grid's first wearable part, or none. */
const replacePart = (setType: string, clubLevel: number, colorIds: number[]) => {
    const { gender, figureSetIds, setPart, removePart } = avatarEditorStore.getState();
    const type = GetAvatarRenderManager().structureData.getSetType(setType);
    const replacement = type && getAvatarEditorPartSets(type, {
        gender,
        clubLevel,
        figureSetIds,
        clubItemsFirst: configFlag('avatareditor.show.clubitems.first'),
        clubItemsDimmed: configFlag('avatareditor.show.clubitems.dimmed'),
    }).find(partSet => partSet.clubLevel <= clubLevel);
    const mandatory = GetAvatarRenderManager().getMandatoryAvatarPartSetIds(gender, clubLevel).includes(setType);

    if (replacement) setPart(setType, replacement.id, colorIds);
    else if (!mandatory) removePart(setType);
};

/**
 * `stripClubItems`: every worn part above the club level replaced (`stripClubItemsOverLevel`), and
 * every colour above it - or missing - the palette's first colour the user may select
 * (`stripClubColorsOverLevel`).
 */
export const stripAvatarEditorClubItems = (clubLevel: number): void => {
    for (const setType of editorSetTypes()) {
        const worn = wornOf(setType);

        if (!worn) continue;

        const defaultColor = firstSelectableColorId(setType, clubLevel);
        const colorsOver = (defaultColor !== -1) && worn.colors.some(color => !color || (color.clubLevel > clubLevel));
        const colorIds = colorsOver ? worn.colors.map(color => ((!color || (color.clubLevel > clubLevel)) ? defaultColor : color.id)) : worn.worn.colorIds;

        if ((worn.partSet?.clubLevel ?? 0) > clubLevel) replacePart(setType, clubLevel, colorIds);
        else if (colorsOver) avatarEditorStore.getState().setColors(setType, colorIds);
    }
};

/** `stripInvalidSellableItems`: every worn sellable part the user does not own replaced. */
export const stripAvatarEditorInvalidSellableItems = (clubLevel: number): void => {
    const { figureSetIds } = avatarEditorStore.getState();

    for (const setType of editorSetTypes()) {
        const worn = wornOf(setType);

        if (worn?.partSet?.isSellable && !figureSetIds.includes(worn.partSet.id)) replacePart(setType, clubLevel, worn.worn.colorIds);
    }
};
