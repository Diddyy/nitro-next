import { useState } from 'react';

import { openClientLink } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useEarningsStore } from '#base/context/earnings';
import { useTranslation } from '#base/context/system';
import { useUserStore } from '#base/context/user';
import { Box, TemplateWindow } from '#base/theme';

import { PurseSettingsList } from './PurseView';

/**
 * The purse drawn from its Flash template (`habbo-toolbar-com/purse_xml`, `grid_purse`) rather than
 * `PurseView`'s hand-placed geometry - the window templates spike. The behaviour is `PurseView`'s:
 * the currency counts (`PurseAreaExtension`), the club days, the earnings button opening the vault
 * with its unseen dot, and the settings button dropping the settings list. `ui.templates.purse`
 * picks it in `MainView`.
 *
 * Every other element - borders, icons, tooltips, the hover style - comes from the template.
 */
export const PurseTemplateView = () => {
    const credits = useUserStore(x => x.credits);
    const activityPoints = useUserStore(x => x.activityPoints);
    const showingIndicator = useEarningsStore(x => x.showingIndicator);
    const { send } = useWebSocketContext();
    const t = useTranslation();
    const [ settingsVisible, setSettingsVisible ] = useState(false);

    return (
        <>
            {/* `ExtensionView.refreshItemWindow` lifts the grid 5 pixels while the purse is in it; its `spacing` is 2. */}
            <Box layout={{ position: 'relative', marginTop: -5, marginBottom: 2, flexShrink: 0 }}>
                <TemplateWindow
                    id="habbo-toolbar-com/purse_xml"
                    bindings={{
                        diamond_count: { caption: String(activityPoints[5] ?? 0) },
                        credit_count: { caption: String(credits ?? 0) },
                        ducket_count: { caption: String(activityPoints[0] ?? 0) },
                        days: { caption: t('purse.clubdays.zero.amount.text') },
                        earnings_button: { onPointerTap: () => openClientLink(send, 'habboUI/open/vault') },
                        earnings_unseen_indicator: { visible: showingIndicator },
                        settings_button: { onPointerTap: () => setSettingsVisible(visible => !visible) },
                    }}
                />
            </Box>
            {settingsVisible && <PurseSettingsList onClose={() => setSettingsVisible(false)} />}
        </>
    );
};
