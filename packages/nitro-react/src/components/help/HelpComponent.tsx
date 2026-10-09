/**
 * Mounts the help window (`HelpView`) while it is up - `TopicsFlowHelpController.toggleWindow`,
 * which the purse's help button reaches through `HabboToolbar.toggleWindowVisibility("HELP")` and
 * `GuideHelpManager.onHabboToolbarEvent` (`HTIE_ICON_HELP` -> `toggleNewHelpWindow`).
 */
import { useIsWindowVisible, useWindowActions } from '#base/context/system';
import { HelpView } from '#base/views/help/HelpView';

export const HelpComponent = () => {
    const isVisible = useIsWindowVisible('help');
    const { hideWindow } = useWindowActions();

    if (!isVisible) return null;

    return <HelpView onClose={() => hideWindow('help')} />;
};
