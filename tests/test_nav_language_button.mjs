import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navbar = readFileSync('src/components/layout/Navbar.tsx', 'utf8');
const firstGroup = navbar.slice(navbar.indexOf('<div className="flex items-center gap-2 lg:gap-3">'), navbar.indexOf('<nav className="hidden items-center'));
assert.match(firstGroup, /onClick=\{\(\) => setMobileOpen\(true\)\}[\s\S]*?aria-label=\{t\("nav\.menu"\)\}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick=\{toggle\}[\s\S]*?lg:hidden[\s\S]*?aria-label=\{t\("lang\.switch"\)\}[\s\S]*?lang === "ar" \? "EN" : "ع"/);
const actions = navbar.slice(navbar.indexOf('<div className="flex items-center gap-1.5 sm:gap-2">'));
assert.match(actions, /onClick=\{toggle\}[\s\S]*?hidden h-10[\s\S]*?lg:flex[\s\S]*?aria-label=\{t\("lang\.switch"\)/);
const language = readFileSync('src/i18n/LanguageContext.tsx', 'utf8');
assert.match(language, /usePersistentState<Lang>\("malika\.language\.v1", "ar"\)/);
assert.match(language, /prev === "ar" \? "en" : "ar"/);
console.log('Mobile language button placement, desktop breakpoint and persistent language toggle checks passed.');
