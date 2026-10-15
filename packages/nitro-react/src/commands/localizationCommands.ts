/**
 * The hotel's other languages - Flash `CoreLocalizationManager`'s localization definitions, which
 * `HabboLocalizationManager.configureLocalizationLocations` registers from the configuration and
 * the `:lang <name>` chat command activates (`ChatInputWidgetHandler`).
 *
 * A definition's url is a gamedata hashes file (`https://www.habbo.fi/gamedata/hashes` in the
 * client's own `localization_configuration`), not a texts file: activating one reads the hashes,
 * then loads `<external_texts url>/<hash>` and lays it over the texts there are
 * (`parseLocalizationData` updates key by key - a key the new file lacks keeps its old text).
 * Every text a layout names by `${key}` is a registered listener in Flash and shows the new
 * language straight away (`updateAllListeners`); here those are the template windows, which read
 * the store's localizations. Text a view set from code keeps the language it was set in until it
 * is set again, as in Flash.
 */
import { NitroLogger } from '@nitrodevco/nitro-api';

import { systemStore } from '#base/context/system';
import { parseLocalizationData } from '#base/utils';

/** `LocalizationDefinition`: `code` is `<language>_<country>.<encoding>` (`en_US.iso-8859-1`). */
export interface LocalizationDefinition {
    languageCode: string;
    countryCode: string;
    encoding: string;
    name: string;
    url: string;
}

/** The game data a hashes file names, as `GameDataResources.parse` reads it. */
interface GameDataResources {
    urls: Record<string, string>;
    hashes: Record<string, string>;
}

/** `GameDataResources.isValid`: the four resources the client cannot start without. */
const REQUIRED_GAME_DATA = [ 'external_texts', 'external_variables', 'furnidata', 'productdata' ];

const createLocalizationDefinition = (code: string, name: string, url: string): LocalizationDefinition => {
    const [ languageCode, region = '' ] = code.split('_');
    const [ countryCode, encoding ] = region.split('.');

    return { languageCode, countryCode, encoding, name, url };
};

/**
 * `HabboLocalizationManager.configureLocalizationLocations` with
 * `CoreLocalizationManager.registerLocalizationDefinition`: `localization.1`, `localization.2`, ...
 * until one is missing, each registered under the value of `localization.<n>` - the name `:lang`
 * takes - with its `.code`, `.name` and `.url`. A name already registered keeps its first
 * definition (the client's own list has `de` twice; `de` is Germany's).
 */
export const getLocalizationDefinitions = (): Map<string, LocalizationDefinition> => {
    const config = systemStore.getState().config;
    const property = (key: string) => {
        const value = config[key];

        return ((typeof value === 'string') || (typeof value === 'number')) ? String(value) : '';
    };
    const definitions = new Map<string, LocalizationDefinition>();

    for (let index = 1; config[`localization.${index}`] !== undefined; index++) {
        const key = `localization.${index}`;
        const id = property(key);

        if (!definitions.has(id)) definitions.set(id, createLocalizationDefinition(property(`${key}.code`), property(`${key}.name`), property(`${key}.url`)));
    }

    return definitions;
};

/** `GameDataResources.parse`: the `hashes` array of `{ name, url, hash }`; undefined unless `isValid`. */
const parseGameDataResources = (body: string): GameDataResources | undefined => {
    const resources: GameDataResources = { urls: {}, hashes: {} };
    const entries = (JSON.parse(body) as { hashes?: { name?: string; url?: string; hash?: string }[] }).hashes ?? [];

    for (const { name, url, hash } of entries) {
        if (!name) continue;

        resources.urls[name] = url ?? '';
        resources.hashes[name] = hash ?? '';
    }

    return REQUIRED_GAME_DATA.every(name => resources.urls[name] && resources.hashes[name]) ? resources : undefined;
};

/** `CoreLocalizationManager.validateLocalizationData` (never accepting an empty file). */
const isLocalizationData = (body: string) => (body.length > 0) && (body.indexOf('<!DOCTYPE html') === -1);

/** `onLocalizationReady` / `onLocalizationFailed`: the texts, asked for a second time when the first ask fails. */
const fetchExternalTexts = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);

        if (response.ok) return await response.text();
    } catch {
        // Flash's onLocalizationFailed loads the same url again.
    }

    const response = await fetch(url);

    if (!response.ok) throw new Error(`Localization ${url} answered ${response.status}`);

    return await response.text();
};

/**
 * `CoreLocalizationManager.loadLocalizationFromURL` then `onLocalizationReady`: the hashes, then
 * the external texts they point at, laid over the current texts. Flash's `parseLocalizationData`
 * stores no empty value, so an empty one here leaves the old text as it is.
 */
const loadLocalizationFromUrl = async (hashesUrl: string): Promise<boolean> => {
    if (!hashesUrl) {
        NitroLogger.error('[CoreLocalizationManager] Localization hashes URL was null or empty!');

        return false;
    }

    try {
        const response = await fetch(hashesUrl);
        const resources = response.ok ? parseGameDataResources(await response.text()) : undefined;

        if (!resources) {
            NitroLogger.error(`[CoreLocalizationManager] No valid game data hashes at ${hashesUrl}`);

            return false;
        }

        const body = await fetchExternalTexts(`${resources.urls.external_texts}/${resources.hashes.external_texts}`);

        if (!isLocalizationData(body)) return false;

        const localizations = parseLocalizationData(body);

        for (const key in localizations) {
            if (!localizations[key].length) delete localizations[key];
        }

        systemStore.getState().setLocalization(localizations);

        return true;
    } catch (err) {
        NitroLogger.error(err);

        return false;
    }
};

/**
 * `CoreLocalizationManager.activateLocalizationDefinition`: false for a name no definition has;
 * otherwise its texts start loading, and true comes back before they arrive. Flash's `:lang`
 * returns null either way, so nothing is said in the chat.
 */
export const activateLocalizationDefinition = (name: string): boolean => {
    const definition = getLocalizationDefinitions().get(name);

    if (!definition) return false;

    void loadLocalizationFromUrl(definition.url);

    return true;
};
