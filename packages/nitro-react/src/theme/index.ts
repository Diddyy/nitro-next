/**
 * The client's theme: `@nitrodevco/nitro-theme` - the window skins, buttons, text and the rest, shared
 * with Nitro Studio - wired into the client (`themeHost`: its asset bundles, config and window
 * manager), with what only the client has: the room stage under the UI (`PixiApplicationRoot`) and
 * the countdown, which reads its translations.
 */
import './themeHost';

export * from './CountdownWidget';
export * from './TemplateWindow';
export * from './useTemplate';
export * from '@nitrodevco/nitro-theme';
// Over the theme's own: the client's puts its room stage under the UI.
export { PixiApplicationRoot } from './PixiApplicationRoot';
