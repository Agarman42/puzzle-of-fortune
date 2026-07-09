#!/usr/bin/env node
/**
 * Node unit tests for Puzzle of Fortune pure logic.
 * Loads classic browser scripts into a VM sandbox (no DOM for these cases).
 *
 * Note: top-level let/const from scripts are lexical in the VM context, so we
 * read/write them via runInContext rather than sandbox object properties.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        passed++;
        return;
    }
    failed++;
    console.error('  FAIL:', msg);
}

function assertEqual(actual, expected, msg) {
    const ok = Object.is(actual, expected) ||
        (typeof actual === 'object' && actual !== null && JSON.stringify(actual) === JSON.stringify(expected));
    if (ok) {
        passed++;
        return;
    }
    failed++;
    console.error('  FAIL:', msg, '\n    expected:', expected, '\n    actual:  ', actual);
}

function loadContext() {
    const localStore = new Map();
    const sandbox = {
        console,
        Set,
        Map,
        Math,
        Date,
        JSON,
        Object,
        Array,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        isNaN: Number.isNaN,
        localStorage: {
            getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
            setItem: (k, v) => localStore.set(k, String(v)),
            removeItem: (k) => localStore.delete(k),
            _store: localStore,
        },
        document: {
            getElementById: () => null,
            documentElement: { style: { setProperty: () => {} } },
            head: { appendChild: () => {} },
            createElement: () => ({
                style: {},
                textContent: '',
                classList: { add() {}, remove() {}, contains() { return false; } },
            }),
            body: { appendChild: () => {}, removeChild: () => {} },
        },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);

    vm.runInContext(`
        function updateHeaderScore() {}
        function updateAchievementsButton() {}
        function updateDailyUI() {}
        function showToast() {}
        function showAchievementUnlock() {}
    `, context);

    for (const rel of ['js/data/puzzles.js', 'js/scoring.js', 'js/state.js', 'js/game.js']) {
        const code = fs.readFileSync(path.join(root, rel), 'utf8');
        vm.runInContext(code, context, { filename: rel });
    }

    return {
        run: (code) => vm.runInContext(code, context),
        context,
        localStore,
    };
}

console.log('Puzzle of Fortune — unit tests\n');

const { run, localStore } = loadContext();

// --- normalizeAnswer ---
console.log('normalizeAnswer');
assertEqual(run(`normalizeAnswer('Hello, World!')`), 'helloworld', 'strips punctuation/spaces');
assertEqual(run(`normalizeAnswer("  It's a Wonderful Life  ")`), 'itsawonderfullife', 'handles apostrophes');
assertEqual(run(`normalizeAnswer('Bûche de Noël')`), 'buchedenoel', 'folds accents');
assertEqual(run(`normalizeAnswer('Buche de Noel')`), 'buchedenoel', 'ASCII form matches accented');

// --- isAnswerLetter / toTileChar ---
console.log('isAnswerLetter / toTileChar');
assert(run(`isAnswerLetter('û') === true`), 'accented letter is a tile');
assert(run(`isAnswerLetter('.') === false`), 'punctuation is not a tile');
assertEqual(run(`toTileChar('û')`), 'U', 'tile char folds to ASCII upper');
assertEqual(run(`toTileChar('é')`), 'E', 'é → E');
assertEqual(
    run(`[...'Bûche'].filter(isAnswerLetter).map(toTileChar).join('')`),
    'BUCHE',
    'Bûche tiles are B-U-C-H-E'
);

// --- answersMatch ---
console.log('answersMatch');
assert(run(`answersMatch('The Nutcracker', 'The Nutcracker')`), 'exact match');
assert(run(`answersMatch('Nutcracker', 'The Nutcracker')`), 'optional whole-word leading The');
assert(run(`answersMatch('the nutcracker', 'The Nutcracker')`), 'case/punctuation insensitive');
assert(run(`answersMatch('Buche de Noel', 'Bûche de Noël')`), 'accent-insensitive match');
assert(run(`answersMatch('Caga Tio', 'Tió de Nadal (or Caga Tió)')`), 'parenthetical or-branch');
assert(run(`answersMatch('Tio de Nadal', 'Tió de Nadal (or Caga Tió)')`), 'left side of parenthetical');
assert(run(`answersMatch('Little Christmas', "Little Christmas or Women's Christmas")`), 'bare or-branch');
assert(run(`answersMatch('Seuss', 'Dr. Seuss (narrator)', ['Seuss'])`), 'explicit aliases array');
assert(run(`answersMatch('Seuss', 'Dr. Seuss (narrator)', ['Seuss'], { allowShortAliases: false }) === false`), 'short aliases blocked when disallowed');
assert(run(`answersMatch('wrong', 'The Nutcracker') === false`), 'rejects wrong answer');
assert(run(`answersMatch('', 'The Nutcracker') === false`), 'rejects empty');

// Whole-word article only — must NOT strip prefixes inside words
assert(run(`answersMatch('imal', 'Animal') === false`), 'Animal ≠ imal (false article strip)');
assert(run(`answersMatch('ater', 'Theater') === false`), 'Theater ≠ ater');
assert(run(`answersMatch('ustralia', 'Australia') === false`), 'Australia ≠ ustralia');
assert(run(`answersMatch('dywilliams', 'Andy Williams') === false`), 'Andy ≠ dy…');

assert(run(`answersMatch('Hansel & Gretel', 'Hansel and Gretel')`), 'and/& interchange');
assert(run(`answersMatch('Dr Seuss', 'Dr. Seuss')`), 'period-insensitive abbreviations');
assert(run(`answersMatch('St Nicholas', 'St. Nicholas')`), 'St. without period');

assertEqual(run(`leadingArticleLetterCount('The Nutcracker')`), 3, 'leading The = 3 letters');
assertEqual(run(`leadingArticleLetterCount('Animal')`), 0, 'Animal has no leading article word');
assertEqual(run(`leadingArticleLetterCount('A Christmas Carol')`), 1, 'leading A = 1 letter');

// --- escapeHtml ---
console.log('escapeHtml');
assertEqual(run(`escapeHtml('<b>"x"</b>')`), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;', 'escapes HTML specials');
assertEqual(run(`escapeHtml(null)`), '', 'null-safe');

// --- getBasePoints / getDifficulty ---
console.log('difficulty & base points');
assertEqual(run(`getBasePoints('Easy')`), 8, 'easy base');
assertEqual(run(`getBasePoints('Medium')`), 10, 'medium base');
assertEqual(run(`getBasePoints('Hard')`), 12, 'hard base');
assertEqual(run(`getDifficulty({ difficulty: 'Hard', answer: 'x' })`), 'Hard', 'manual difficulty wins');
assertEqual(run(`getDifficulty({ answer: 'short' })`), 'Easy', 'short answer easy by length');

// --- computePointsEarned ---
console.log('computePointsEarned');
run(`currentGameMode = 'normal'`);
assertEqual(
    run(`computePointsEarned({ difficulty: 'Hard' }, 0, 0, false)`),
    12,
    'normal hard perfect = 12'
);
assertEqual(
    run(`computePointsEarned({ difficulty: 'Hard' }, 2, 1, false)`),
    8,
    'hard -2 reveals -2 hint = 8'
);
assertEqual(
    run(`computePointsEarned({ difficulty: 'Easy' }, 10, 0, false)`),
    4,
    'floors at 4'
);
assertEqual(
    run(`computePointsEarned({ difficulty: 'Hard' }, 0, 0, true)`),
    0,
    'full reveal = 0'
);

run(`currentGameMode = 'challenge'`);
assertEqual(
    run(`computePointsEarned({ difficulty: 'Hard' }, 0, 0, false)`),
    18,
    'challenge 1.5× hard perfect = 18'
);

run(`currentGameMode = 'no_mistakes'`);
assertEqual(
    run(`computePointsEarned({ difficulty: 'Medium' }, 0, 0, false)`),
    20,
    'no_mistakes 2× medium = 20'
);

run(`currentGameMode = 'normal'`);

// --- GAME_MODES rules ---
console.log('GAME_MODES');
assert(run(`GAME_MODES.no_mistakes.endOnMistake === true`), 'no_mistakes ends on mistake');
assert(run(`GAME_MODES.marathon.endOnMistake === true`), 'marathon ends on mistake');
assert(run(`GAME_MODES.no_mistakes.wrongAnswerClearsPuzzle === false`), 'no_mistakes clear flag is independent');
assert(run(`GAME_MODES.challenge.wrongAnswerClearsPuzzle === true`), 'challenge clears puzzle');
assert(run(`GAME_MODES.challenge.allowReveal === false`), 'challenge no reveal');

// --- pickSessionPuzzles ---
console.log('pickSessionPuzzles');
run(`
    gameState.recentShortPuzzles = [1, 2, 3];
    const pool = [1, 2, 3, 10, 11, 12, 13].map((id) => ({ id }));
    const _rand = Math.random;
    Math.random = () => 0.5;
    globalThis.__picked = pickSessionPuzzles(pool, 3);
    globalThis.__all = pickSessionPuzzles(pool, 999);
    Math.random = _rand;
`);
const picked = run(`__picked`);
const all = run(`__all`);
assertEqual(picked.length, 3, 'takes 3');
assert(
    picked.every((p) => ![1, 2, 3].includes(p.id)),
    'prefers non-recent when enough fresh exist: ' + JSON.stringify(picked.map((p) => p.id))
);
assertEqual(all.length, 7, 'take >= length returns all');
assert(
    all.slice(0, 4).every((p) => ![1, 2, 3].includes(p.id)) &&
        all.slice(4).every((p) => [1, 2, 3].includes(p.id)),
    'orders fresh before recent for full list'
);

// --- normalizeGameState ---
console.log('normalizeGameState');
assertEqual(run(`createDefaultGameState().version`), run(`SAVE_VERSION`), 'default has save version');
assert(run(`Array.isArray(createDefaultGameState().recentShortPuzzles)`), 'default recent list');

run(`
    globalThis.__norm = normalizeGameState({
        score: 'nope',
        solved: null,
        lastGameMode: 'not-a-mode',
    });
`);
assertEqual(run(`__norm.score`), 0, 'invalid score -> 0');
assertEqual(run(`typeof __norm.solved`), 'object', 'solved object restored');
assertEqual(run(`__norm.lastGameMode`), 'normal', 'bad mode -> normal');
assertEqual(run(`__norm.version`), run(`SAVE_VERSION`), 'version stamped');

run(`globalThis.__ok = normalizeGameState({ score: 42, solved: { '5': true } })`);
assertEqual(run(`__ok.score`), 42, 'keeps valid score');
assertEqual(run(`__ok.solved['5']`), true, 'keeps solved map');

// load/save round-trip
console.log('loadGameState / saveGameState');
run(`
    gameState = createDefaultGameState();
    gameState.score = 99;
    gameState.solved = { '7': true };
    saveGameState();
`);
assert(localStore.get(run(`STORAGE_KEY`))?.includes('"score":99'), 'persists score to primary key');
assert(localStore.has(run(`LEGACY_STORAGE_KEY`)), 'mirrors legacy key');

run(`
    gameState = createDefaultGameState();
    loadGameState();
`);
assertEqual(run(`gameState.score`), 99, 'reloads score');
assertEqual(run(`gameState.solved['7']`), true, 'reloads solved');

// migrate from legacy only
run(`
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ score: 12, solved: { '1': true } }));
    loadGameState();
`);
assertEqual(run(`gameState.score`), 12, 'migrates from legacy key');

// --- puzzle bank ---
console.log('puzzle bank');
assert(run(`Array.isArray(puzzles)`), 'puzzles is array');
assertEqual(run(`puzzles.length`), 640, '640 puzzles');
assertEqual(run(`new Set(puzzles.map(p => p.id)).size`), 640, 'unique ids');
run(`
    globalThis.__cats = {};
    for (const p of puzzles) {
        __cats[p.category] = (__cats[p.category] || 0) + 1;
    }
`);
const cats = run(`__cats`);
for (const [cat, n] of Object.entries(cats)) {
    assertEqual(n, 80, `${cat} has 80 puzzles`);
}
assert(
    run(`puzzles.every(p => p.question && p.answer && p.category)`),
    'every puzzle has question, answer, category'
);

// --- getDailyPuzzle ---
console.log('getDailyPuzzle');
assertEqual(run(`getDailyPuzzle().id`), run(`getDailyPuzzle().id`), 'same day returns same puzzle');
assert(run(`!!getDailyPuzzle().answer`), 'daily has answer');

// Summary
console.log('\n' + '─'.repeat(40));
console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
