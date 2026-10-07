/**
 * A pet's picture in an inventory bitmap - `PetsView.getPetImage` copied into the bitmap's centre
 * (`PetsGridItem.setPetImage`, `updatePreview`): the figure's custom parts from the packet's flat
 * triples, the direction turned into degrees (`* 45`), and a monster plant in the growth posture its
 * level names.
 */
import { IPetCustomPart } from '@nitrodevco/nitro-api';

import { InventoryPet } from '#base/context/inventory';
import { usePetImageTexture } from '#base/views/catalog/usePetImageTexture';

/** The monster plant's pet type, whose look follows its level. */
const PET_TYPE_MONSTERPLANT = 16;
/** A monster plant at this level or above is fully grown (`std`); below it, `grw<level>`. */
const MONSTERPLANT_GROWN_LEVEL = 7;
/** `getPetImage`'s `new Vector3d(direction * 45)`. */
const DEGREES_PER_DIRECTION = 45;

/** A monster plant is drawn at the growth stage its level names. */
const getPetPosture = (pet: InventoryPet): string | undefined => {
    if (pet.figureData.typeId !== PET_TYPE_MONSTERPLANT) return undefined;

    return (pet.level >= MONSTERPLANT_GROWN_LEVEL) ? 'std' : `grw${pet.level}`;
};

/** `PetsView.getPetImage`'s figure: the flat triples the packet carries, as the image request wants them. */
const getPetImageRequest = (pet: InventoryPet, direction: number) => {
    const customParts: IPetCustomPart[] = [];

    for (let index = 0; index < pet.figureData.customParts.length; index += 3) {
        customParts.push({ layerId: pet.figureData.customParts[index], partId: pet.figureData.customParts[index + 1], paletteId: pet.figureData.customParts[index + 2] });
    }

    return {
        typeId: pet.figureData.typeId,
        paletteId: pet.figureData.paletteId,
        color: parseInt(pet.figureData.color, 16) || 0,
        direction: direction * DEGREES_PER_DIRECTION,
        customParts: customParts.length ? customParts : undefined,
        posture: getPetPosture(pet),
    };
};

export interface InventoryPetImageProps {
    pet: InventoryPet;
    direction: number;
    width: number;
    height: number;
}

/** `setPetImage` / `updatePreview`: the render copied into the bitmap's centre. */
export const InventoryPetImage = ({ pet, direction, width, height }: InventoryPetImageProps) => {
    const texture = usePetImageTexture(getPetImageRequest(pet, direction));

    if (!texture) return null;

    return (
        <pixiSprite
            texture={texture}
            anchor={0.5}
            x={Math.trunc(width / 2)}
            y={Math.trunc(height / 2)}
            layout={false}
        />
    );
};
