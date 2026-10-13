import { IOutgoingPacket } from '@nitrodevco/nitro-api';

// `ModToolPreferencesComposer(x, y, width, height)`: the issue handler window.
export type ModToolPreferencesComposerType = {
    windowX: number;
    windowY: number;
    windowWidth: number;
    windowHeight: number;
};

export class ModToolPreferencesComposer implements IOutgoingPacket<ModToolPreferencesComposerType> {
    public constructor(private params: ModToolPreferencesComposerType) { }

    public compose(): (number | string | boolean)[] {
        return [ this.params.windowX, this.params.windowY, this.params.windowWidth, this.params.windowHeight ];
    }
}
