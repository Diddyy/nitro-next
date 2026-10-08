import { useMemo } from 'react';

import { useTranslation } from '#base/context/system';
import { Box, Button, ModalDialog, ScrollArea, TemplateFrameOptions, TemplateWindow, ThemeText } from '#base/theme';

export interface CraftingProduct {
    recipeCode: string;
    /** The furni the recipe makes, already named for reading. */
    name: string;
}

export interface CraftingIngredient {
    count: number;
    name: string;
}

export interface FurnitureCraftingViewProps {
    products: CraftingProduct[];
    selectedRecipeCode: string;
    /** What the selected recipe takes, once the server has said. */
    ingredients: CraftingIngredient[];
    /** Whether the table is the viewer's own - nobody else may craft on it. */
    isOwner: boolean;
    /** Whether what is in the mixer makes the selected recipe. */
    canCraft: boolean;
    /** What came out, once something has. */
    result: string;
    onSelectRecipe: (recipeCode: string) => void;
    onCraft: () => void;
    onClose: () => void;
}

/** `header_recipes` / `header_inventory`'s colour, which the ingredient lines take. */
const INGREDIENT_COLOR = '#cec7b6';

/**
 * A crafting table - `CraftingWidget.createMainWindow`, which builds `craftingwidget_xml` as a modal
 * dialog (`buildModalDialogFromXML`): the `craft_craft_bg` backdrop, the recipes under
 * `header_recipes` in `itemgrid_products`, the mixer in `itemgrid_mixer`, the info texts and
 * `btn_craft`. The button reads `${crafting.btn.craft}`, or `${crafting.btn.notowner}` (and stays
 * disabled) on someone else's table, as `CraftingInfoController.enableButton` captioned it; the header
 * close closes.
 *
 * What the port has is names, not items, so the grids hold text: each recipe is a row button drawn
 * in `itemgrid_products` in place of the 40x40 furni icon clones, the selected recipe's ingredients
 * are listed in `itemgrid_mixer` in the headers' colour, and the result is `info_text1`. The
 * inventory grid under `header_inventory`, the `furniture_icon` preview, `header_mixer`,
 * `info_text2`, the `progress_bar` and `CraftingInfoController`'s state texts need the inventory, the
 * room engine's icons and the controller's states, none of which the widget carries - and Flash let
 * ingredients be dragged in from the inventory, which the port has no dragging for - so the mixer is
 * filled by putting the furni on the table in the room, and those stay empty or hidden.
 */
export const FurnitureCraftingView = ({
    products, selectedRecipeCode, ingredients, isOwner, canCraft, result, onSelectRecipe, onCraft, onClose,
}: FurnitureCraftingViewProps) => {
    const t = useTranslation();
    const frame = useMemo<TemplateFrameOptions>(() => ({ id: 'furniture-crafting', modal: true, draggable: false, rememberPosition: false, onClose }), [ onClose ]);
    const craftEnabled = isOwner && canCraft;

    return (
        <ModalDialog>
            <TemplateWindow
                id="habbo-room-ui-com/craftingwidget_xml"
                frame={frame}
                bindings={{
                    header_mixer: { visible: false },
                    info_text1: { visible: !!result.length, caption: result },
                    info_text2: { visible: false },
                    btn_craft: {
                        caption: t(isOwner ? 'crafting.btn.craft' : 'crafting.btn.notowner'),
                        disabled: !craftEnabled,
                        onPointerTap: craftEnabled ? onCraft : undefined,
                    },
                    itemgrid_products: {
                        items: [],
                        children: (
                            <ScrollArea
                                orientation="vertical"
                                variant="3"
                                layout={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
                                contentLayout={{ position: 'relative', width: '100%', flexDirection: 'column', gap: 4 }}
                            >
                                {products.map(product => (
                                    <Button
                                        key={product.recipeCode}
                                        variant="0"
                                        selected={product.recipeCode === selectedRecipeCode}
                                        onPointerTap={() => onSelectRecipe(product.recipeCode)}
                                        layout={{ width: '100%', height: 24, flexShrink: 0 }}
                                    >
                                        {product.name}
                                    </Button>
                                ))}
                            </ScrollArea>
                        ),
                    },
                    itemgrid_mixer: {
                        children: (
                            <Box layout={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
                                {ingredients.map(ingredient => (
                                    <ThemeText
                                        key={ingredient.name}
                                        text={`${ingredient.count}x ${ingredient.name}`}
                                        textStyle="u_regular"
                                        textOptions={{ fill: INGREDIENT_COLOR }}
                                        verticalAlign="top"
                                        layout={{ flexShrink: 0 }}
                                    />
                                ))}
                            </Box>
                        ),
                    },
                }}
            />
        </ModalDialog>
    );
};
