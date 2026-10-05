import { useState } from 'react';

import { useTranslation } from '#base/context/system';
import { LayoutImage, TemplateBindings, TemplateWindow, TemplateWindows } from '#base/theme';

import { InfoBubbleAvatarViewProps } from './InfoBubbleAvatarView';
import { RELATIONSHIPS, useAvatarMenu } from './useAvatarMenu';

/** `ContextInfoView`'s colours for an enabled button: the label, and its arrow icon. */
const ENABLED_TEXT_COLOR = 0xffffff;
const ENABLED_ICON_COLOR = 0xd4d0cd;

/** `ButtonMenuView`'s gap between a label's text and its arrow. */
const ARROW_GAP = 8;

/** The rows whose button carries an arrow `icon` - a sub-page's, and `actions` back. */
const ARROW_ROWS = new Set([ 'relationship', 'mute', 'ban_with_duration', 'moderate', 'ambassador', 'actions' ]);

/** The relationship grid's cells as the layout names them, in `RELATIONSHIPS`' order. */
const RELATIONSHIP_CELLS = [ 'relationship_heart', 'relationship_smile', 'relationship_bobba' ];

/**
 * The menu over another user drawn from its Flash template (`habbo-room-ui-com/avatar_menu_widget`)
 * rather than `InfoBubbleAvatarView`'s hand-placed frame - the window templates spike. What it shows
 * and does is `useAvatarMenu`'s, as the hand-placed view's is; everything drawn - the bubble, the
 * rows, their arrows, the sizes - comes from the layout, the list and bubble shrinking to the rows
 * shown by the layout's own resize params. `ui.templates.avatarMenu` picks it.
 *
 * `AvatarMenuView.updateButtons` is the `buttons` list's `show`: each mode's rows its conditions pass,
 * the relationship grid in the relationship mode. A row's click is on its `button` (`getListItemByName(
 * key).getChildByName("button")`). Minimized, the menu is `minimized_menu`.
 */
export const AvatarMenuTemplateView = ({ objectData, onClose }: InfoBubbleAvatarViewProps) => {
    const menu = useAvatarMenu(objectData, onClose);
    const [ collapsed, setCollapsed ] = useState(false);
    const t = useTranslation();

    if (!menu) return null;

    const toggle = () => setCollapsed(!collapsed);

    if (collapsed) {
        return (
            <TemplateWindow
                id="habbo-room-ui-com/minimized_menu"
                bindings={{ minimize: { onPointerTap: toggle } }}
            />
        );
    }

    const { info, buttons, visibleButtons, showsRelationshipGrid, relationshipIcon, tradeTooltip, press, pressRelationship, openTheirProfile } = menu;
    const bindings: TemplateBindings = {
        profile_link: { onPointerTap: openTheirProfile },
        // A blocked user's name is `infostand.blocked_user` (italic in the client; the binding sets the text only).
        name: { caption: info.isBlocked ? t('infostand.blocked_user') : info.name },
        relationship_status: relationshipIcon ? { visible: true, asset: LayoutImage(`habbo-window-manager-com/${relationshipIcon}`) } : { visible: false },
        buttons: { show: [ ...visibleButtons.map(button => button.key), ...(showsRelationshipGrid ? [ 'relationship_grid' ] : []) ] },
        minimize: { onPointerTap: toggle },
        // `ContextInfoView.onMinimizeHover`: white while the pointer is not over it.
        'minimize/icon': { color: 0xffffff },
        'trade/button': { tooltip: tradeTooltip },
    };

    // `ButtonMenuView` showing a button (`_Str_2304`): enabled, its label white whatever the layout's
    // `text_color`, its arrow icon light grey.
    for (const button of buttons) {
        bindings[`${button.key}/button`] = { ...bindings[`${button.key}/button`], onPointerTap: () => press(button) };
        bindings[`${button.key}/button/label`] = { color: ENABLED_TEXT_COLOR };
        if (ARROW_ROWS.has(button.key)) bindings[`${button.key}/button/icon`] = { color: ENABLED_ICON_COLOR };
    }

    // The respect count is the caption's parameter: the layout's `${infostand.button.respect}` has none.
    const respect = buttons.find(button => button.key === 'respect');

    if (respect) bindings['respect/button/label'] = { ...bindings['respect/button/label'], caption: respect.caption };

    RELATIONSHIPS.forEach((relationship, index) => {
        bindings[`${RELATIONSHIP_CELLS[index]}/button`] = { onPointerTap: () => pressRelationship(relationship) };
    });

    // `ButtonMenuView._Str_2304`: a shown button's arrow sits 8 past its label's text, right of it
    // (`arrow_right`) or left (`arrow_left`) - not where the layout drew it.
    const arrange = ({ find }: TemplateWindows) => {
        for (const button of visibleButtons) {
            if (!ARROW_ROWS.has(button.key)) continue;

            const label = find(`${button.key}/button/label`);
            const icon = find(`${button.key}/button/icon`);

            if (!label || !icon) continue;

            if (icon.element?.tags?.includes('arrow_left')) icon.setX(label.x + ((label.width - label.textWidth) / 2) - icon.width - ARROW_GAP);
            else if (icon.element?.tags?.includes('arrow_right')) icon.setX(label.x + ((label.width + label.textWidth) / 2) + ARROW_GAP);
        }
    };

    return (
        <TemplateWindow
            id="habbo-room-ui-com/avatar_menu_widget"
            bindings={bindings}
            arrange={arrange}
        />
    );
};
