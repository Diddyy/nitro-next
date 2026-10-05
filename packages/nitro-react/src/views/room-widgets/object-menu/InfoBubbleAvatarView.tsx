import { ISimpleRoomObjectData } from '@nitrodevco/nitro-api';
import { useState } from 'react';

import { useTranslation } from '#base/context/system';
import { Box, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';

import { InfoBubbleMenuButton } from './InfoBubbleMenuButton';
import { InfoBubbleMenuFrame } from './InfoBubbleMenuFrame';
import { AVATAR_MENU_GEOMETRY } from './InfoBubbleMenuGeometry';
import { RELATIONSHIP_ICONS, RELATIONSHIPS, useAvatarMenu } from './useAvatarMenu';

export interface InfoBubbleAvatarViewProps {
    objectData: ISimpleRoomObjectData;
    onClose: () => void;
}

/** `avatar_menu_widget`'s rows are 137 wide; the relationship grid's cells 45 by 25. */
const ROW_WIDTH = 137;
const ROW_HEIGHT = 26;
const GRID_CELL_WIDTH = 45;
const GRID_HEIGHT = 25;

/** The rows carrying `arrow_right` - each opens a sub-page. */
const SUBMENU_ROWS = [ 'relationship', 'mute', 'ban_with_duration', 'moderate', 'ambassador' ];

/**
 * The menu over another user - `AvatarMenuView`, on the `avatar_menu_widget` layout. The name
 * opens their profile; the buttons act on them through the same actions the infostand uses, and
 * the moderation, ban, mute, relationship and ambassador sets are sub-pages of the one menu
 * (`useAvatarMenu`).
 *
 * Each page lists its rows in the layout's child order (`updateButtons` only shows and hides
 * them). The layout's `blow`, `perform`, `report` and `donate_*` rows are not offered: the port
 * has no action behind them.
 */
export const InfoBubbleAvatarView = ({ objectData, onClose }: InfoBubbleAvatarViewProps) => {
    const menu = useAvatarMenu(objectData, onClose);
    const [ collapsed, setCollapsed ] = useState(false);
    const t = useTranslation();

    if (!menu) return null;

    const { info, visibleButtons, showsRelationshipGrid, relationshipIcon, tradeTooltip, press, pressRelationship, openTheirProfile } = menu;
    const rowHeights = [ ...(showsRelationshipGrid ? [ GRID_HEIGHT ] : []), ...visibleButtons.map(() => ROW_HEIGHT) ];

    return (
        <InfoBubbleMenuFrame
            geometry={AVATAR_MENU_GEOMETRY}
            rowHeights={rowHeights}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed(!collapsed)}
            header={(
                <Region
                    name="profile_link"
                    cursor="pointer"
                    onPointerTap={openTheirProfile}
                    layout={{ position: 'absolute', left: 0, top: 7, width: 143, height: 16, flexDirection: 'row', justifyContent: 'center' }}
                >
                    {/* `name`: `u_bold` at `font_size` 11, centred; a blocked user is the italic `infostand.blocked_user`. */}
                    <ThemeText
                        text={info.isBlocked ? t('infostand.blocked_user') : info.name}
                        textStyle="u_bold"
                        textOptions={{ fill: '#ffffff', fontSize: 11 }}
                        flashFormat={info.isBlocked ? { italic: true } : undefined}
                        name="name"
                        verticalAlign="top"
                    />
                    {relationshipIcon && (
                        <ThemeImage
                            name="relationship_status"
                            src={LayoutImage(`habbo-window-manager-com/${relationshipIcon}`)}
                            bitmap={{ stretchedX: false, stretchedY: false }}
                            layout={{ position: 'absolute', left: 5, top: 1, width: 16, height: 14 }}
                        />
                    )}
                </Region>
            )}
        >
            {showsRelationshipGrid && (
                <Box layout={{ flexDirection: 'row', width: ROW_WIDTH, height: GRID_HEIGHT, gap: 1, flexShrink: 0 }}>
                    {RELATIONSHIPS.map(relationship => (
                        <InfoBubbleMenuButton
                            key={relationship}
                            shape="grid"
                            recolorsOnHover={false}
                            width={GRID_CELL_WIDTH}
                            height={GRID_HEIGHT}
                            onPress={() => pressRelationship(relationship)}
                        >
                            {/* The 49x17 `static_bitmap` over the button, its art centred and never stretched. */}
                            <ThemeImage
                                src={LayoutImage(`habbo-window-manager-com/${RELATIONSHIP_ICONS[relationship]}`)}
                                bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                                layout={{ width: GRID_CELL_WIDTH + 4, height: 17 }}
                            />
                        </InfoBubbleMenuButton>
                    ))}
                </Box>
            )}
            {visibleButtons.map(button => (
                <InfoBubbleMenuButton
                    key={button.key}
                    width={ROW_WIDTH}
                    caption={button.caption}
                    // `AvatarMenuView._buttonEventProc` takes `WME_OVER` for its own tracking and
                    // never reaches `ButtonMenuView`'s, so this menu alone leaves its rows dark.
                    recolorsOnHover={false}
                    arrow={SUBMENU_ROWS.includes(button.key) ? 'right' : ((button.key === 'actions') ? 'left' : undefined)}
                    tooltip={(button.key === 'trade') ? tradeTooltip : undefined}
                    adornment={(button.key === 'replenish_respect') && (
                        <ThemeImage
                            src={LayoutImage('habbo-window-manager-com/pursearea_duckets_icon.png')}
                            bitmap={{ stretchedX: false, stretchedY: false, etchingColor: 0x48000000 }}
                            dynamicRole="icon"
                            layout={{ position: 'absolute', left: 110, top: 10, width: 15, height: 15 }}
                        />
                    )}
                    onPress={() => press(button)}
                />
            ))}
        </InfoBubbleMenuFrame>
    );
};
