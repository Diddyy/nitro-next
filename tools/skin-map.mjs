/**
 * The skin map: writes `skins.json` (`buildSkinMap` in nitro-theme `template/templateSkins.ts`) from
 * the published template bundles - every frame, border, button ... skin of the window manager
 * library's theme, the theme sheet sprites it draws with their sizes and nine-slice, and the template
 * windows (and their elements) that draw it. The client's build runs it (`vite.config.ts`'s `skinMap`, the
 * output's `skins.json`) and its development server on the first request; run it again when other
 * bundles are published. The extension inspector and the development build's overlay check read it.
 *
 * The bundles come from `asset.bundles.templates` (`%libname%` the library) of the client's
 * `nitro-config.json`, or `--from`: that url form, or a folder of `<library>.nitro` files. The libraries
 * are the ones the client's source names (`habbo-<x>-com`, `-lib`), or `--libraries a,b`; one the
 * bundles do not have is listed and skipped.
 *
 *   node tools/skin-map.mjs                                  (writes packages/nitro-react/dist/skins.json)
 *   node tools/skin-map.mjs --from https://cdn.example.com/bundled/templates/%libname%.nitro
 *   node tools/skin-map.mjs --from ./bundles --out skins.json
 */
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

// The bundler resolves the source's extensionless relative imports; Node's own TypeScript loading needs the file name.
registerHooks({ resolve: (specifier, context, next) => {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        const url = new URL(`${specifier}.ts`, context.parentURL);

        if (fs.existsSync(url)) return next(url.href, context);
    }

    return next(specifier, context);
} });

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildSkinMap, THEME_SKIN_LIBRARY } = await import(pathToFileURL(path.join(root, 'packages/nitro-theme/src/template/templateSkins.ts')).href);

const args = process.argv.slice(2);
const option = (name) => {
    const at = args.indexOf(name);

    return (at >= 0) ? args[at + 1] : undefined;
};
const out = path.resolve(option('--out') ?? path.join(root, 'packages/nitro-react/dist/skins.json'));
const from = option('--from') ?? JSON.parse(fs.readFileSync(path.join(root, 'packages/nitro-react/public/config/nitro-config.json'), 'utf8'))['asset.bundles.templates'];

if (!from) {
    console.error('No bundles: pass --from <url with %libname% | folder>, or set asset.bundles.templates in nitro-config.json.');
    process.exit(1);
}

/** The template libraries the client's source names. */
const sourceLibraries = () => {
    const names = new Set();
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        if (entry.isDirectory()) return walk(path.join(dir, entry.name));

        if (!/\.tsx?$/.test(entry.name)) return;

        for (const match of fs.readFileSync(path.join(dir, entry.name), 'utf8').matchAll(/\bhabbo-[a-z0-9-]+?-(?:com|lib)\b|\bhabbo-new-navigator\b/g)) names.add(match[0]);
    });

    [ 'packages/nitro-react/src', 'packages/nitro-theme/src' ].forEach(dir => walk(path.join(root, dir)));
    names.add(THEME_SKIN_LIBRARY);

    return [ ...names ].sort();
};

const libraries = option('--libraries')?.split(',').filter(Boolean) ?? sourceLibraries();

/** A bundle's bytes, or `undefined` when there is none. */
const fetchBundle = async (library) => {
    if (/^https?:/i.test(from)) {
        const response = await fetch(from.replace('%libname%', library));

        return response.ok ? Buffer.from(await response.arrayBuffer()) : undefined;
    }

    const file = path.join(from, `${library}.nitro`);

    return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
};

/** The JSON entries of a zip (a `.nitro` bundle), by name: its central directory read, each entry inflated. */
const zipJson = (bytes) => {
    const end = bytes.lastIndexOf(Buffer.from([ 0x50, 0x4b, 0x05, 0x06 ]));
    const count = bytes.readUInt16LE(end + 10);
    const files = {};
    let at = bytes.readUInt32LE(end + 16);

    for (let index = 0; index < count; index++) {
        const method = bytes.readUInt16LE(at + 10);
        const size = bytes.readUInt32LE(at + 20);
        const nameLength = bytes.readUInt16LE(at + 28);
        const extraLength = bytes.readUInt16LE(at + 30);
        const commentLength = bytes.readUInt16LE(at + 32);
        const local = bytes.readUInt32LE(at + 42);
        const name = bytes.toString('utf8', at + 46, at + 46 + nameLength);

        if (name.endsWith('.json')) {
            const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
            const data = bytes.subarray(start, start + size);

            files[name] = JSON.parse(((method === 8) ? zlib.inflateRawSync(data) : data).toString('utf8'));
        }

        at += 46 + nameLength + extraLength + commentLength;
    }

    return files;
};

const templates = {};
const missing = [];
let theme;
let frames;

for (const library of libraries) {
    const bytes = await fetchBundle(library);

    if (!bytes) {
        missing.push(library);
        continue;
    }

    const files = zipJson(bytes);

    Object.assign(templates, files['templates.json']?.templates ?? {});

    if (library === THEME_SKIN_LIBRARY) {
        theme = files['theme-variants.json'];
        frames = files['theme_spritesheet.json']?.frames;
    }
}

if (!theme || !frames) {
    console.error(`${THEME_SKIN_LIBRARY}'s bundle has no theme (theme-variants.json, theme_spritesheet.json): nothing to map.`);
    process.exit(1);
}

const map = buildSkinMap(theme, frames, templates);
const text = `${JSON.stringify(map)}\n`;
const summary = `${Object.keys(map.skins).length} skins, ${Object.keys(map.sprites).length} sprites, ${Object.keys(templates).length} templates of ${libraries.length - missing.length} libraries${missing.length ? ` (no bundle: ${missing.join(', ')})` : ''}`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
console.log(`wrote ${path.relative(process.cwd(), out)} (${(text.length / 1024).toFixed(0)} KiB) - ${summary}`);
