/** Session + persistent game state */

// Game State
let currentPuzzleIndex = 0;

let currentRevealed = new Set();

let currentRevealsUsed = 0;

let revealsThisRound = 0;

let extraHintUsed = 0;


// Session-specific tracking (for recap)
let sessionPointsEarned = 0;

let sessionRevealsUsed = 0;

let sessionExtraHintsUsed = 0;

let perfectSolvesThisSession = 0;


// Per-puzzle flag for the "Reveal full answer" cheat button
let fullRevealUsed = false;

let timeUpUsed = false;           // Time Attack: puzzle timed out (0 pts, no solve credit)

let sessionPointsAwarded = {};    // Prevent double-awarding points on resubmit

let successAdvanceHandler = null; // Keydown handler for success modal (must be removable)


// Time Attack timer state
let timeAttackInterval = null;

let timeAttackSecondsLeft = 60;

const TIME_ATTACK_DURATION = 60;  // seconds per puzzle in Time Attack


// Session-local tracking (so short sessions feel independent)
let sessionSolved = {};           // IDs solved in the current session

let sessionIsFullRun = false;     // true only when user chose "All" (999)

let currentGameMode = 'normal';   // 'normal' | 'challenge' | 'time_attack' | 'no_mistakes' | 'marathon'

/** True after end-of-session recap / mistake-end — blocks further play until menu. */
let sessionEnded = false;

/** Guard against double-submit races. */
let isSubmittingAnswer = false;


// Rolling list of puzzles seen in recent short sessions (to avoid repeats)
let recentShortPuzzles = [];


// Points earned in the most recent short session (for display on main menu)
let lastSessionPoints = 0;

let gameState = {
    solved: {},
    score: 0,
    playerName: "Player",
    currentStreak: 0,
    hintsUsed: {},
    achievements: {},
    // Achievement tracking counters
    totalPerfectSolves: 0,
    mixedSessionsCompleted: 0,
    lifetimeRevealsUsed: 0,
    lifetimeExtraHintsUsed: 0,
    hasUsedReveal: false,
    hasUsedExtraHint: false,
    // Daily Puzzle tracking
    dailyLastDate: null,
    dailyCurrentStreak: 0,
    dailyLongestStreak: 0,
    // Challenge Mode tracking
    challengeRunsCompleted: 0,
    // Last-used session settings (for the New Session modal)
    lastCategory: "Mixed Bag",
    lastNumQuestions: 10,
    lastGameMode: "normal"
};


let selectedCategory = null;

let selectedNumQuestions = null;


const STORAGE_KEY = 'puzzleOfFortuneState';

const LEGACY_STORAGE_KEY = 'yuletideFortuneState';

const SAVE_VERSION = 2;


function createDefaultGameState() {
    return {
        version: SAVE_VERSION,
        solved: {},
        score: 0,
        playerName: "Player",
        currentStreak: 0,
        hintsUsed: {},
        achievements: {},
        totalPerfectSolves: 0,
        mixedSessionsCompleted: 0,
        lifetimeRevealsUsed: 0,
        lifetimeExtraHintsUsed: 0,
        hasUsedReveal: false,
        hasUsedExtraHint: false,
        dailyLastDate: null,
        dailyCurrentStreak: 0,
        dailyLongestStreak: 0,
        challengeRunsCompleted: 0,
        lastCategory: "Mixed Bag",
        lastNumQuestions: 10,
        lastGameMode: "normal",
        recentShortPuzzles: []
    };
}


function normalizeGameState(raw) {
    const defaults = createDefaultGameState();
    const state = (raw && typeof raw === 'object') ? { ...defaults, ...raw } : { ...defaults };

    if (!state.solved || typeof state.solved !== 'object') state.solved = {};
    if (typeof state.score !== 'number' || Number.isNaN(state.score)) state.score = 0;
    if (typeof state.playerName !== 'string' || !state.playerName.trim()) state.playerName = "Player";
    if (typeof state.currentStreak !== 'number') state.currentStreak = 0;
    if (!state.hintsUsed || typeof state.hintsUsed !== 'object') state.hintsUsed = {};
    if (!state.achievements || typeof state.achievements !== 'object') state.achievements = {};
    if (typeof state.totalPerfectSolves !== 'number') state.totalPerfectSolves = 0;
    if (typeof state.mixedSessionsCompleted !== 'number') state.mixedSessionsCompleted = 0;
    if (typeof state.lifetimeRevealsUsed !== 'number') state.lifetimeRevealsUsed = 0;
    if (typeof state.lifetimeExtraHintsUsed !== 'number') state.lifetimeExtraHintsUsed = 0;
    if (!Array.isArray(state.recentShortPuzzles)) state.recentShortPuzzles = [];
    if (typeof state.hasUsedReveal !== 'boolean') state.hasUsedReveal = !!state.hasUsedReveal;
    if (typeof state.hasUsedExtraHint !== 'boolean') state.hasUsedExtraHint = !!state.hasUsedExtraHint;
    if (state.dailyLastDate == null) state.dailyLastDate = null;
    if (typeof state.dailyCurrentStreak !== 'number') state.dailyCurrentStreak = 0;
    if (typeof state.dailyLongestStreak !== 'number') state.dailyLongestStreak = 0;
    if (typeof state.challengeRunsCompleted !== 'number') state.challengeRunsCompleted = 0;
    if (!state.lastCategory) state.lastCategory = "Mixed Bag";
    if (typeof state.lastNumQuestions !== 'number') state.lastNumQuestions = 10;
    if (!state.lastGameMode || !GAME_MODES[state.lastGameMode]) state.lastGameMode = "normal";
    state.version = SAVE_VERSION;
    return state;
}


function loadGameState() {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        // Migrate older "Yuletide Fortune" saves if present
        saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (saved) {
        try {
            gameState = normalizeGameState(JSON.parse(saved));
        } catch (e) {
            console.warn('[Puzzle of Fortune] Failed to parse save; using defaults.', e);
            gameState = createDefaultGameState();
        }
    } else {
        gameState = createDefaultGameState();
    }

    // Sync module-level recent list
    if (gameState.recentShortPuzzles && gameState.recentShortPuzzles.length > 0) {
        recentShortPuzzles = [...gameState.recentShortPuzzles];
    }
}


function saveGameState() {
    gameState = normalizeGameState(gameState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    // Keep legacy key in sync during transition so older bookmarks still see progress
    try { localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(gameState)); } catch (e) {}
    updateHeaderScore();
    updateAchievementsButton();
}


function getLifetimeSolvedCount() {
    return Object.keys(gameState.solved || {}).length;
}


function getSolvedCount() {
    // Count only solves that happened in *this* session's list.
    // Lifetime solves no longer auto-count toward the current session progress
    // (because repeats now load fresh and are playable again).
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    let count = 0;
    sessionPuzzles.forEach(p => {
        if (sessionSolved[p.id]) {
            count++;
        }
    });
    return count;
}


function sessionPuzzlesLetterCount() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const puzzle = sessionPuzzles[currentPuzzleIndex];
    if (!puzzle) return 0;
    return puzzle.answer.toUpperCase().replace(/[^A-Z0-9]/g, '').length;
}


function addToRecentShortPuzzles(ids) {
    if (!Array.isArray(ids)) return;

    // Load from gameState if the module var is empty
    if (recentShortPuzzles.length === 0 && gameState.recentShortPuzzles) {
        recentShortPuzzles = [...gameState.recentShortPuzzles];
    }

    ids.forEach(id => {
        // Remove if already present (move to end)
        const idx = recentShortPuzzles.indexOf(id);
        if (idx !== -1) recentShortPuzzles.splice(idx, 1);

        recentShortPuzzles.push(id);
    });

    // Keep the list capped (last ~150 puzzles)
    if (recentShortPuzzles.length > 150) {
        recentShortPuzzles = recentShortPuzzles.slice(-150);
    }

    // Persist
    gameState.recentShortPuzzles = [...recentShortPuzzles];
    saveGameState();
}

