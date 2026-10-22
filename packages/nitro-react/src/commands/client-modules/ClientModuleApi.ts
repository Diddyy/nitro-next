/**
 * Not Flash's: version 1 of what a client module is handed - `activate(api)` - by the loader in
 * `commands/client-modules`. Everything a module adds through it is taken out again when the module
 * stops, whether or not it disposed of it itself; each `register`/`add`/`handle` also returns the
 * function that takes that one thing out early.
 *
 * Turbo's `docs/client-modules.md` is the module author's side of it.
 */
import type { IMessageDataWrapper } from '@nitrodevco/nitro-api';
import type { ComponentType, ReactNode } from 'react';

import type { ClientModuleAlert, ClientModuleAvatar, ClientModuleWindowProps } from '#base/context/client-modules';

import type { ClientModuleLibraries } from './clientModuleLibraries';

export type ClientModuleDispose = () => void;

/** What a composer writes: an int, a string or a boolean (a byte), in wire order. */
export type ClientModulePacketValue = number | string | boolean;

export interface ClientModuleApi {
    readonly version: 1;
    /** The module's key: its plugin's. */
    readonly key: string;
    /**
     * The URL the module was named by. A module checked by its SHA-256 runs from a `blob:` URL, so
     * `import.meta.url` cannot find the files beside it: `new URL('icon.png', api.baseUrl)` can.
     */
    readonly baseUrl: string;
    /** The client's own React, theme and stores, shared rather than bundled a second time. */
    readonly libs: ClientModuleLibraries;
    windows: {
        /** A window by id: the component is drawn in the client's window layer while it is open. */
        register: (id: string, component: ComponentType<ClientModuleWindowProps>) => ClientModuleDispose;
        open: (id: string, params?: Record<string, unknown>) => void;
        close: (id: string) => void;
        toggle: (id: string, params?: Record<string, unknown>) => void;
    };
    toolbar: {
        /** An icon in the bottom bar, after the client's own: `icon` is an image URL. */
        add: (item: { id: string; icon: string; tooltip?: string; onClick: () => void }) => ClientModuleDispose;
    };
    meMenu: {
        /** An entry in the me menu, before its spacer: a clone of the profile entry with its own caption. */
        add: (item: { id: string; caption: string; onClick: () => void }) => ClientModuleDispose;
    };
    links: {
        /** Every in-client link `<prefix>/...` that the client itself has no route for. */
        handle: (prefix: string, handler: (link: string) => void) => ClientModuleDispose;
        /** Opens an in-client link, the client's or a module's. */
        open: (link: string) => void;
    };
    packets: {
        /** Reads an extension header's packet and hands it to `listener`. Undefined when the header is not free. */
        registerParser: <T>(header: number, parse: (wrapper: IMessageDataWrapper) => T, listener: (data: T) => void) => ClientModuleDispose | undefined;
        /** Claims an extension header to send on. Undefined when the header is not free. */
        registerComposer: (header: number) => ClientModuleDispose | undefined;
        /** Sends on a header the module claimed: each value an int, a string or a boolean. */
        send: (header: number, ...values: ClientModulePacketValue[]) => void;
    };
    config: {
        /** A configuration value as the hotel set it, `undefined` when unset. */
        get: (key: string) => unknown;
    };
    texts: {
        /** A text by key, `%name%` replaced from `replacements`; `fallback` when the hotel has none. */
        get: (key: string, fallback?: string, replacements?: Record<string, string>) => string;
    };
    sounds: {
        /** A sample of the client's sound manager by id, at the UI volume. */
        play: (soundId: string) => void;
    };
    room: {
        /** Draws over every avatar in the room, placed above its head every frame. */
        avatarOverlay: (render: (avatar: ClientModuleAvatar) => ReactNode) => ClientModuleDispose;
    };
    notifications: {
        /** A bubble layout: a template of the bundles (`<library>/<asset>_xml`) and its height. */
        registerLayout: (name: string, layout: { template: string; height: number }) => ClientModuleDispose;
        /** A bubble in the client's stack, drawn with a registered layout. */
        add: (layout: string, text: string, options?: { image?: string; link?: string }) => void;
        /**
         * The picture of every alert and notification popup, open or yet to open: `resolve` is shown each
         * with the picture it has (an asset name or a URL, `undefined` for none) and gives another, or
         * `undefined` to leave it.
         */
        setIllustration: (resolve: (alert: ClientModuleAlert) => string | undefined) => ClientModuleDispose;
    };
}
