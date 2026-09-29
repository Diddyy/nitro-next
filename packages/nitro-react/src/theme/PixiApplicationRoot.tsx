import { GetRoomStage } from '@nitrodevco/nitro-renderer';
import { PixiApplicationRoot as ThemeApplicationRoot } from '@nitrodevco/nitro-theme';
import { Application as PixiApplication } from 'pixi.js';
import { ComponentProps } from 'react';

/** The room stage goes under everything the UI draws: the first child of the stage. */
const addRoomStage = (app: PixiApplication) => void app.stage.addChild(GetRoomStage());

/** The theme's root, with the client's room stage on it. */
export const PixiApplicationRoot = (props: Omit<ComponentProps<typeof ThemeApplicationRoot>, 'onInit'>) => (
    <ThemeApplicationRoot
        {...props}
        onInit={addRoomStage}
    />
);
