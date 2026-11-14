import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

// Bundle the TypeScript module using the same @ alias as Vite, without writing artifacts.
const bundle = await build({
  entryPoints: ['src/data/defaultContent.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  alias: { '@': new URL('../src', import.meta.url).pathname },
});
const { createDefaultContent, mergeContent } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
);

const defaults = createDefaultContent();
const oldContent = mergeContent({ theme: { accent: '#123456' } });
assert.equal(oldContent.theme.accent, '#123456');
assert.equal(oldContent.theme.bone, defaults.theme.bone);
assert.equal(defaults.theme.ink, '#4d3308');
assert.equal(mergeContent({ theme: { ink: '#141019' } }).theme.ink, '#4d3308');
assert.equal(mergeContent({ theme: { ink: '#314159' } }).theme.ink, '#314159');

const chosen = { ink: '#112233', bone: '#eeeedd', accent: '#b89a62', lilac: '#667788' };
const saved = mergeContent({ theme: chosen });
assert.deepEqual(mergeContent(JSON.parse(JSON.stringify(saved))).theme, saved.theme);
for (const [key, value] of Object.entries(chosen)) assert.equal(saved.theme[key], value);

const invalid = mergeContent({ theme: { ink: 'invalid', bone: '#fff', accent: null } });
assert.equal(invalid.theme.ink, defaults.theme.ink);
assert.equal(invalid.theme.bone, defaults.theme.bone);
assert.equal(invalid.theme.accent, defaults.theme.accent);
const backgrounds = mergeContent({ theme: { backgroundLight: '#aabbcc', backgroundDark: '#123456' } });
assert.equal(backgrounds.theme.backgroundLight, '#aabbcc');
assert.equal(mergeContent(JSON.parse(JSON.stringify(backgrounds))).theme.backgroundDark, '#123456');
assert.equal(mergeContent({ theme: { backgroundLight: 'invalid' } }).theme.backgroundLight, undefined);

const themeBundle = await build({
  entryPoints: ['src/lib/theme.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
});
const { siteBackground, siteSurfaces, productAccent, productCardColours, contrastRatio } = await import(`data:text/javascript;base64,${Buffer.from(themeBundle.outputFiles[0].contents).toString('base64')}`);
assert.equal(defaults.theme.lilac, '#c7a873');
assert.equal(mergeContent({ theme: { lilac: '#C9B5F7' } }).theme.lilac, '#c7a873');
assert.equal(mergeContent({ theme: { lilac: '#123456' } }).theme.lilac, '#123456');
for (const colour of ['#C9B5F7', '#D9B8E8', '#A9A6E8', '#D9D2E8']) {
  assert.equal(productAccent(colour, '#D4A035'), '#D4A035');
}
assert.equal(productAccent('#B8C98A', '#D4A035'), '#B8C98A');
assert.equal(siteBackground(defaults.theme, 'light'), '#e2ded7');
assert.equal(siteBackground(defaults.theme, 'dark'), '#583f17');
assert.equal(siteBackground(backgrounds.theme, 'light'), '#aabbcc');
assert.equal(siteBackground(backgrounds.theme, 'dark'), '#123456');
// A page-background edit must not recolour the section/card surface palette.
assert.notEqual(siteBackground(defaults.theme, 'light'), siteBackground(backgrounds.theme, 'light'));
assert.deepEqual(siteSurfaces(defaults.theme), siteSurfaces(backgrounds.theme));
assert.notDeepEqual(siteSurfaces(defaults.theme), siteSurfaces({ ...defaults.theme, bone: '#ffffff' }));
const cardCss = await readFile(new URL('../src/styles/product-card.css', import.meta.url), 'utf8');
assert.match(cardCss, /background-color: var\(--product-card-base, color-mix\(in srgb, var\(--color-acid\) 48%, white\)\)/);
assert.match(cardCss, /background: var\(--product-card-disc, color-mix\(in srgb, var\(--color-acid\) 66%, white\)\)/);
assert.match(cardCss, /--color-bone: var\(--color-card-light\)/);

const defaultCard = productCardColours(defaults.theme);
assert.deepEqual(defaultCard, { base: '#ead19e', disc: '#e3c07a', text: '#4d3308' });
assert.ok(contrastRatio(defaultCard.text, defaultCard.base) >= 4.5);
assert.ok(contrastRatio(defaultCard.text, defaultCard.disc) >= 4.5);
const custom = mergeContent({ theme: { productCardBase: '#102030', productCardDisc: '#405060', productCardText: '#ffffff' } });
const reloaded = mergeContent(JSON.parse(JSON.stringify(custom)));
assert.deepEqual(productCardColours(reloaded.theme), { base: '#102030', disc: '#405060', text: '#ffffff' });
assert.deepEqual(productCardColours({ ...reloaded.theme, backgroundLight: '#eeeeee' }), productCardColours(reloaded.theme));
const partlyReset = { ...reloaded.theme, productCardDisc: undefined };
assert.equal(productCardColours(partlyReset).disc, defaultCard.disc);
assert.equal(productCardColours(partlyReset).base, '#102030');
const invalidCard = mergeContent({ theme: { productCardBase: '#fff', productCardDisc: null, productCardText: 'invalid' } });
assert.deepEqual(productCardColours(invalidCard.theme), defaultCard);
assert.ok(contrastRatio('#777777', '#888888') < 4.5);
console.log('Theme palette, editable product cards, persistence and contrast tests passed.');
