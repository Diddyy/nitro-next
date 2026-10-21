/**
 * Not Flash's: the client half of the `clienterrors` extension of Turbo's client errors plugin. Once
 * the server accepts the extension (`setClientErrorReporting`) the client reports, one JSON report
 * per error (`TurboClientErrorReportComposer`), what it catches:
 *
 * - `error`: an uncaught exception (`window` `error`), Flash's `uncaughtError`;
 * - `rejection`: a promise rejected with no handler (`unhandledrejection`);
 * - `react`: an error a view threw while drawing, from its `ViewErrorBoundary` (`reportReactError`),
 *   with React's component stack;
 * - `logged`: anything the renderer or the UI caught and logged (`NitroLogger.error`), logged to the
 *   console or not;
 * - `renderer`: the GPU device or context lost (`reportRendererError`); when the client starts again
 *   for it, the report waits in the tab's session storage and goes with the next session.
 *
 * Each report carries the error's message and its stack as the browser wrote it (resolved against
 * the build's source maps on the server's side, never here), the client build and
 * `production.version`, the browser, the room id, and the last outgoing message names as
 * breadcrumbs (`recordClientErrorBreadcrumb`) - never their content, so never chat text. The page is
 * sent without its query, which carries the login ticket. Limits on the client's side as on the
 * server's: 10 reports a minute, 100 a session, 5 of one error. Until the extension is accepted
 * nothing is recorded, listened to or sent.
 */
import { NitroLogger } from '@nitrodevco/nitro-api';
import { TurboClientErrorReportComposer } from '@nitrodevco/nitro-packets';
import { GetRenderer } from '@nitrodevco/nitro-renderer';

import type { Send } from '#base/context/communication';
import { getRoom } from '#base/context/room';
import { configString } from '#base/context/system';

/** The build's name, replaced at build time (vite.config.ts `buildId`); undefined outside Vite. */
declare const __NITRO_BUILD__: string | undefined;

export const TURBO_CLIENT_ERRORS_CAPABILITY = 'clienterrors';

export type ClientErrorKind = 'error' | 'rejection' | 'react' | 'logged' | 'renderer';

type Breadcrumb = { t: number; c: string; m: string };

const MAX_BREADCRUMBS = 20;
const MAX_MESSAGE = 1000;
const MAX_STACK = 16000;
const MAX_COMPONENT_STACK = 8000;
/** The server's default `MaxPayloadBytes`. */
const MAX_REPORT_BYTES = 32 * 1024;
const REPORTS_PER_MINUTE = 10;
const MAX_REPORTS = 100;
const MAX_SAME_ERROR = 5;
/** Reports kept for the next session when the client starts again for a lost GPU. */
const PENDING_KEY = 'nitro.clienterrors.pending';
const MAX_PENDING = 5;
/** Messages sent all the time on their own, which say nothing of what the user did. */
const QUIET_MESSAGES = new Set([ 'Pong', 'LatencyPingRequest', 'LatencyPingReport', 'PerformanceLog', 'LagWarningReport', 'EventLog', 'TurboClientErrorReport' ]);
/** The browser's own noise, and errors of extensions injected into the page: not the client's. */
const IGNORED = [ /^Script error\.?$/, /^ResizeObserver loop/, /(chrome|moz|safari(-web)?)-extension:\/\// ];

let send: Send | null = null;
let uninstall: (() => void) | null = null;
let reporting = false;
let sent = 0;
let tokens = REPORTS_PER_MINUTE;
let refilledAt = 0;
const breadcrumbs: Breadcrumb[] = [];
const perError = new Map<string, number>();
/** Errors already reported, so one that reaches two hooks (a boundary and the logger) counts once. */
let reported = new WeakSet<object>();

const now = () => Math.round(performance.now());

const cut = (text: string | undefined | null, max: number) => (text && text.length > max) ? text.slice(0, max) : (text || undefined);

const describe = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;

    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
};

/** The client's state worth knowing for any error: build, browser, room. Never the page's query. */
const context = () => {
    const navigatorData = navigator as Navigator & { userAgentData?: { platform?: string } };

    return {
        build: (typeof __NITRO_BUILD__ === 'string') ? __NITRO_BUILD__ : 'dev',
        production: configString('production.version') || undefined,
        userAgent: navigator.userAgent,
        platform: navigatorData.userAgentData?.platform || navigator.platform || undefined,
        page: `${window.location.origin}${window.location.pathname}`,
        roomId: getRoom()?.roomId ?? undefined,
        viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio },
        renderer: (GetRenderer() as { name?: string } | undefined)?.name,
        uptimeMs: now(),
    };
};

type Caught = { kind: ClientErrorKind; name?: string; message: string; stack?: string; source?: string; componentStack?: string };

/** What `error` is, as a report says it. */
const caughtOf = (kind: ClientErrorKind, error: unknown, extra: Omit<Caught, 'kind' | 'message'> = {}): Caught => (error instanceof Error)
    ? { kind, name: error.name, message: error.message, stack: error.stack, ...extra }
    : { kind, message: describe(error), ...extra };

const take = (caught: Caught) => {
    if (IGNORED.some(pattern => pattern.test(caught.message) || (caught.stack ? pattern.test(caught.stack.split('\n', 3).join('\n')) : false))) return false;
    if (sent >= MAX_REPORTS) return false;

    const key = `${caught.name}:${caught.message}:${caught.stack?.split('\n', 3).join('|') ?? caught.source ?? ''}`;
    const same = perError.get(key) ?? 0;

    if (same >= MAX_SAME_ERROR) return false;

    const time = now();

    tokens = Math.min(REPORTS_PER_MINUTE, tokens + ((time - refilledAt) / 60000) * REPORTS_PER_MINUTE);
    refilledAt = time;

    if (tokens < 1) return false;

    tokens -= 1;
    sent++;
    perError.set(key, same + 1);

    return true;
};

/** The report as JSON bytes, made smaller until it fits the server's limit; null when it never does. */
const encode = (caught: Caught, at: Record<string, unknown>): Uint8Array | null => {
    const report = {
        v: 1,
        kind: caught.kind,
        name: cut(caught.name, 128),
        message: cut(caught.message, MAX_MESSAGE) ?? '',
        stack: cut(caught.stack, MAX_STACK),
        source: cut(caught.source, 512),
        componentStack: cut(caught.componentStack, MAX_COMPONENT_STACK),
        ...at,
        breadcrumbs: [ ...breadcrumbs ],
    };
    const encoder = new TextEncoder();
    let bytes = encoder.encode(JSON.stringify(report));

    if (bytes.byteLength > MAX_REPORT_BYTES) {
        report.breadcrumbs = [];
        report.stack = cut(report.stack, 4000);
        report.componentStack = cut(report.componentStack, 2000);
        bytes = encoder.encode(JSON.stringify(report));
    }

    return (bytes.byteLength > MAX_REPORT_BYTES) ? null : bytes;
};

const report = (caught: Caught, error?: unknown) => {
    if (!send || reporting) return;
    if (error && typeof error === 'object') {
        if (reported.has(error)) return;

        reported.add(error);
    }

    if (!take(caught)) return;

    // A failing send logs through `NitroLogger.error`, which would report again.
    reporting = true;

    try {
        const bytes = encode(caught, context());

        if (bytes) send(new TurboClientErrorReportComposer({ report: bytes }));
    } catch {
        // Reporting never throws into the code that failed.
    } finally {
        reporting = false;
    }
};

const onError = (event: ErrorEvent) => {
    const source = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;

    report(caughtOf('error', event.error ?? event.message, { source }), event.error);
};

const onRejection = (event: PromiseRejectionEvent) => report(caughtOf('rejection', event.reason), event.reason);

/** `NitroLogger.error(...)`: the first error among its values, its strings before it as the message. */
const onLogged = (messages: unknown[]) => {
    const error = messages.find(x => x instanceof Error);
    const text = messages.filter(x => !(x instanceof Error)).map(x => cut(describe(x), 200)).join(' ');

    if (!(error instanceof Error)) {
        if (text) report({ kind: 'logged', message: text });

        return;
    }

    report({ kind: 'logged', name: error.name, message: text ? `${text}: ${error.message}` : error.message, stack: error.stack }, error);
};

const readPending = (): Caught[] => {
    try {
        const pending = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) ?? '[]') as Caught[];

        window.sessionStorage.removeItem(PENDING_KEY);

        return Array.isArray(pending) ? pending.slice(0, MAX_PENDING) : [];
    } catch {
        return [];
    }
};

/**
 * Starts reporting when the server accepts the extension (with the socket's `send`), and stops when
 * it does not. Reports kept from the session before go first.
 */
export const setClientErrorReporting = (enabled: boolean, socketSend?: Send) => {
    uninstall?.();
    uninstall = null;
    send = null;
    breadcrumbs.length = 0;
    perError.clear();
    reported = new WeakSet();
    sent = 0;
    tokens = REPORTS_PER_MINUTE;
    refilledAt = now();

    if (!enabled || !socketSend) return;

    send = socketSend;
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    NitroLogger.errorListener = onLogged;

    uninstall = () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);

        if (NitroLogger.errorListener === onLogged) NitroLogger.errorListener = null;
    };

    for (const pending of readPending()) report(pending);
};

/** One message the client sent, by name: the breadcrumbs. Nothing while the extension is not accepted. */
export const recordClientErrorBreadcrumb = (category: string, name: string) => {
    if (!send) return;

    const message = name.endsWith('Composer') ? name.slice(0, -'Composer'.length) : name;

    if (QUIET_MESSAGES.has(message)) return;

    breadcrumbs.push({ t: now(), c: category, m: message });

    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
};

/** A view's error, from its `ViewErrorBoundary`, with React's component stack. */
export const reportReactError = (error: unknown, componentStack?: string | null) => report(caughtOf('react', error, { componentStack: componentStack ?? undefined }), error);

/**
 * The renderer lost its GPU. When the client is about to start again for it (`reloading`), the report
 * is kept in the tab's session storage and sent by the next session, which the reload would
 * otherwise cut off.
 */
export const reportRendererError = (message: string, reloading = false) => {
    if (!send) return;

    const caught: Caught = { kind: 'renderer', message };

    if (!reloading) {
        report(caught);

        return;
    }

    try {
        const pending = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) ?? '[]') as Caught[];

        window.sessionStorage.setItem(PENDING_KEY, JSON.stringify([ ...(Array.isArray(pending) ? pending : []), caught ].slice(-MAX_PENDING)));
    } catch {
        // No session storage: the report is lost with the page.
    }
};
