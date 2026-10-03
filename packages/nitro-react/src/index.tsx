import '@pixi/layout';

import { extend } from '@pixi/react';
import { Container, Graphics, NineSliceSprite, Sprite, Text, TilingSprite } from 'pixi.js';
import { createRoot } from 'react-dom/client';

import { WebSocketContextProvider } from '#base/context/communication';

import { Nitro } from './Nitro';

// NitroLogger.LOG_ERROR = import.meta.env.DEV;
// NitroLogger.LOG_WARN = import.meta.env.DEV;
// NitroLogger.LOG_PACKETS = import.meta.env.DEV;

extend({
    Container,
    Graphics,
    NineSliceSprite,
    Sprite,
    Text,
    TilingSprite,
});

declare global {
    interface Window {
        NitroConfig: {
            'nitro.config.url': string;
        };
        NitroParsedConfig: Record<string, unknown>;
    }
}

window.NitroConfig = window.NitroConfig || {};

// A deployment's socket, baked in at build time from `VITE_SOCKET_URL`. `NitroConfig` overrides
// `nitro-config.json`, so this wins over the file; a page that sets `socket.url` itself keeps it.
const pageConfig = window.NitroConfig as Record<string, unknown>;

if (import.meta.env.VITE_SOCKET_URL && !pageConfig['socket.url']) pageConfig['socket.url'] = import.meta.env.VITE_SOCKET_URL;

const element = document.getElementById('root');

// The system, user and navigator stores are app-wide singletons, so only the socket needs a provider.
if (element) createRoot(element).render(
    <WebSocketContextProvider>
        <Nitro />
    </WebSocketContextProvider>,
);
