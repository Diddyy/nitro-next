/**
 * Not Flash's: the open windows of the client modules (`windows.register` / `open`), each drawn by
 * its module's component in a boundary of its own, so a module that throws while drawing loses its
 * window and nothing else. The component draws its own frame - the theme's `Frame` or a
 * `TemplateWindow` - and is handed its params and its `close`.
 */
import { useClientModulesActions, useClientModulesStore } from '#base/context/client-modules';
import { ViewErrorBoundary } from '#base/views/system/ViewErrorBoundary';

export const ClientModuleWindowsView = () => {
    const windows = useClientModulesStore(x => x.windows);
    const openWindows = useClientModulesStore(x => x.openWindows);
    const { closeWindow } = useClientModulesActions();

    return (
        <>
            {Object.entries(openWindows).map(([ key, params ]) => {
                const window = windows[key];

                if (!window) return null;

                const Window = window.component;

                return (
                    <ViewErrorBoundary key={key}>
                        <Window
                            params={params}
                            close={() => closeWindow(key)}
                        />
                    </ViewErrorBoundary>
                );
            })}
        </>
    );
};
