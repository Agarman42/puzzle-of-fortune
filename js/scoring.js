/** Scoring, modes, pure helpers, achievements data */


// Mode definitions
const GAME_MODES = {
    normal: {
        name: "Normal",
        description: "Standard rules. Reveals and hints are available.",
        pointMultiplier: 1,
        allowReveal: true,
        allowExtraHint: true,
        wrongAnswerClearsPuzzle: false,
        endOnMistake: false,
    },
    challenge: {
        name: "Challenge",
        description: "No reveals or hints. Wrong answers clear the entire puzzle. +50% points.",
        pointMultiplier: 1.5,
        allowReveal: false,
        allowExtraHint: false,
        wrongAnswerClearsPuzzle: true,
        endOnMistake: false,
    },
    time_attack: {
        name: "Time Attack",
        description: "60 seconds per puzzle. Race against the clock — solve fast to maximize your score!",
        pointMultiplier: 1,
        allowReveal: true,
        allowExtraHint: true,
        wrongAnswerClearsPuzzle: false,
        endOnMistake: false,
    },
    no_mistakes: {
        name: "No Mistakes",
        description: "One wrong answer ends your session. Maximum risk, maximum reward.",
        pointMultiplier: 2,
        allowReveal: true,
        allowExtraHint: true,
        wrongAnswerClearsPuzzle: false,
        endOnMistake: true,
    },
    marathon: {
        name: "Marathon",
        description: "Keep going until you get one wrong. How far can you go?",
        pointMultiplier: 1,
        allowReveal: true,
        allowExtraHint: true,
        wrongAnswerClearsPuzzle: false,
        endOnMistake: true,
    }
};


function getRound(puzzleId) {
    return Math.ceil(puzzleId / 20);
}


function getDifficulty(puzzle) {
    // Manual override wins (we will use this for cleanup)
    if (puzzle.difficulty) return puzzle.difficulty;

    const len = puzzle.answer.length;
    if (len <= 9)  return "Easy";
    if (len <= 20) return "Medium";
    return "Hard";
}


function getBasePoints(difficulty) {
    if (difficulty === "Easy") return 8;
    if (difficulty === "Medium") return 10;
    return 12;
}


/**
 * Fold accents/diacritics so "Bûche" and "Buche" compare equal and map to typeable tiles.
 * Uses Unicode NFD + strip combining marks (ES2018+; modern browsers / Node 18+).
 */
function foldDiacritics(str) {
    return String(str ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}

/** Canonical form for answer comparison: lowercase, no diacritics, alphanumeric only. */
function normalizeAnswer(str) {
    return foldDiacritics(str)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/** True if this character becomes a letter/digit tile (after folding accents). */
function isAnswerLetter(ch) {
    if (ch == null || ch === '') return false;
    const folded = foldDiacritics(ch).toUpperCase();
    return folded.length > 0 && /[A-Z0-9]/.test(folded[0]);
}

/** Character shown on a tile / expected when typing (ASCII-friendly uppercase). */
function toTileChar(ch) {
    return foldDiacritics(ch).toUpperCase();
}

/**
 * If the phrase starts with a standalone English article (The/A/An + space),
 * return the phrase without it. Does NOT strip letters from words like "Animal".
 */
function stripLeadingArticlePhrase(str) {
    const raw = String(str ?? '').trim();
    const m = raw.match(/^(the|an|a)\s+(.+)$/i);
    return m ? m[2].trim() : raw;
}

/** Letter count of a leading The/A/An word (0 if none). Used for partial-board rules. */
function leadingArticleLetterCount(answer) {
    const m = String(answer ?? '').trim().match(/^(the|an|a)\s+/i);
    if (!m) return 0;
    return normalizeAnswer(m[1]).length;
}

/**
 * Expand a canonical answer into alternate phrasings:
 * - "Tió de Nadal (or Caga Tió)" → full, left side, right side
 * - "Little Christmas or Women's Christmas" → full + each side
 * - Leading "The/A/An " only when present as a separate word
 */
function expandAnswerVariants(answer) {
    const variants = new Set();
    const raw = String(answer ?? '').trim();
    if (!raw) return [];

    const add = (s) => {
        const t = String(s ?? '').trim();
        if (t) variants.add(t);
    };

    add(raw);

    // Whole-word article only: "The Nutcracker" → also "Nutcracker" (not "Animal" → "imal")
    const withoutArticle = stripLeadingArticlePhrase(raw);
    if (withoutArticle !== raw) add(withoutArticle);

    // "X (or Y)" / "X (Y)" parentheticals
    const paren = raw.match(/^(.+?)\s*\(\s*(?:or\s+)?([^)]+?)\s*\)\s*$/i);
    if (paren) {
        add(paren[1]);
        add(paren[2]);
        add(stripLeadingArticlePhrase(paren[1]));
        add(stripLeadingArticlePhrase(paren[2]));
    } else if (/\sor\s/i.test(raw)) {
        raw.split(/\sor\s/i).forEach((part) => {
            add(part);
            add(stripLeadingArticlePhrase(part));
        });
    }

    // "and" ↔ "&" (common alternate writings)
    if (/\sand\s/i.test(raw)) {
        add(raw.replace(/\sand\s/gi, ' & '));
    }
    if (/\s&\s/.test(raw)) {
        add(raw.replace(/\s&\s/g, ' and '));
    }

    // Drop periods so "Dr. Seuss" matches "Dr Seuss", "St. Nicholas" → "St Nicholas"
    if (raw.includes('.')) {
        add(raw.replace(/\./g, ''));
    }

    return [...variants];
}

/** Set of normalized keys that should count as this phrase. */
function answerMatchKeys(str) {
    const keys = new Set();
    const primary = normalizeAnswer(str);
    if (!primary) return keys;
    keys.add(primary);
    // Whole-word article strip on the original phrase (not on the compacted key)
    const stripped = stripLeadingArticlePhrase(str);
    if (stripped !== String(str ?? '').trim()) {
        const k = normalizeAnswer(stripped);
        if (k) keys.add(k);
    }
    return keys;
}

/**
 * Flexible answer check for submit.
 * Accepts: exact (normalized), whole-word leading The/A/An, "X or Y" / "X (or Y)"
 * branches, and optional puzzle.aliases entries.
 *
 * options.allowShortAliases — if false (default when board has empty tiles),
 * aliases shorter than the official answer are ignored (prevents partial-fill exploits).
 */
function answersMatch(userStr, correctStr, aliases, options = {}) {
    const userKeys = answerMatchKeys(userStr);
    if (userKeys.size === 0) return false;

    const fullNormLen = normalizeAnswer(correctStr).length;
    const candidates = expandAnswerVariants(correctStr);

    if (Array.isArray(aliases)) {
        aliases.forEach((a) => {
            if (a == null || !String(a).trim()) return;
            const alias = String(a).trim();
            if (options.allowShortAliases === false) {
                // Only accept aliases that cover the full answer length
                if (normalizeAnswer(alias).length < fullNormLen) return;
            }
            candidates.push(alias);
        });
    }

    for (const candidate of candidates) {
        for (const key of answerMatchKeys(candidate)) {
            if (userKeys.has(key)) return true;
        }
    }
    return false;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}



// Static Tailwind class maps (dynamic bg-${color}-* strings are not generated by Tailwind)
const ACCENT_CLASSES = {
    emerald: {
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        title: 'text-emerald-400',
        points: 'text-emerald-300',
        border: 'border-emerald-700',
        text: 'text-emerald-400',
    },
    rose: {
        iconBg: 'bg-rose-500/10',
        iconColor: 'text-rose-400',
        title: 'text-rose-400',
        points: 'text-rose-300',
        border: 'border-rose-700',
        text: 'text-rose-400',
    },
    amber: {
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
        title: 'text-amber-400',
        points: 'text-amber-300',
        border: 'border-amber-700',
        text: 'text-amber-400',
    },
    cyan: {
        iconBg: 'bg-cyan-500/10',
        iconColor: 'text-cyan-400',
        title: 'text-cyan-400',
        points: 'text-cyan-300',
        border: 'border-cyan-700',
        text: 'text-cyan-400',
    },
    violet: {
        iconBg: 'bg-violet-500/10',
        iconColor: 'text-violet-400',
        title: 'text-violet-400',
        points: 'text-violet-300',
        border: 'border-violet-700',
        text: 'text-violet-400',
    },
    orange: {
        iconBg: 'bg-orange-500/10',
        iconColor: 'text-orange-400',
        title: 'text-orange-400',
        points: 'text-orange-300',
        border: 'border-orange-700',
        text: 'text-orange-400',
    },
};


function getAccentClasses(accent) {
    return ACCENT_CLASSES[accent] || ACCENT_CLASSES.emerald;
}


function computePointsEarned(puzzle, revealsUsed, hintsUsed, usedFullReveal) {
    if (usedFullReveal) return 0;
    const base = getBasePoints(getDifficulty(puzzle));
    let points = Math.max(4, base - revealsUsed - (2 * hintsUsed));
    const modeCfg = GAME_MODES[currentGameMode] || GAME_MODES.normal;
    if (modeCfg.pointMultiplier !== 1 && points > 0) {
        points = Math.max(1, Math.round(points * modeCfg.pointMultiplier));
    }
    return points;
}


function getCategoryIcon(category) {
    const icons = {
        "Mixed Bag": "🎲",
        "Christmas Classics": "🎄",
        "Holiday Movies & TV": "📺",
        "Christmas Music & Songs": "🎵",
        "Traditions & Fun Facts": "❄️",
        "Famous Quotes & Lore": "💬",
        "General Knowledge Trivia": "🧠",
        "Famous Movies": "🎬",
        "Sports": "🏀"
    };
    return icons[category] || "📁";
}


function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// Deterministic daily puzzle selection (same for everyone on the same day)
function getDailyPuzzle() {
    const dateStr = getTodayDateString();
    
    // Simple hash from date string to use as seed
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = (hash << 5) - hash + dateStr.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    
    // Use hash to pick a puzzle (avoid negative)
    const index = Math.abs(hash) % puzzles.length;
    
    return puzzles[index];
}


// Returns mode-specific copy + visual theming for success screens and end recaps
function getModeRecapInfo(modeKey) {
    const mode = GAME_MODES[modeKey] || GAME_MODES.normal;

    switch (modeKey) {
        case 'time_attack':
            return {
                successTitle: "Great time!",
                endTitle: "Time Attack Complete!",
                endSubtitle: (solved, total, percent) => 
                    percent === 100 
                        ? "You beat the clock on every puzzle!" 
                        : `You powered through ${solved} puzzles under pressure.`,
                icon: "fa-solid fa-stopwatch",
                accent: "amber",
                shortName: "Time Attack"
            };
        case 'challenge':
            return {
                successTitle: "Nicely done!",
                endTitle: "Challenge Complete!",
                endSubtitle: (solved, total, percent) => 
                    percent === 100 
                        ? "You conquered the Challenge with no helps!" 
                        : "Tough run — well played.",
                icon: "fa-solid fa-bolt",
                accent: "rose",
                shortName: "Challenge"
            };
        case 'no_mistakes':
            return {
                successTitle: "Flawless!",
                endTitle: "No Mistakes Run!",
                endSubtitle: (solved, total, percent) => 
                    percent === 100 
                        ? "Perfect — zero mistakes the whole way." 
                        : `You made it through ${solved} without a single slip.`,
                icon: "fa-solid fa-shield-halved",
                accent: "cyan",
                shortName: "No Mistakes"
            };
        case 'marathon':
            return {
                successTitle: "Keep going!",
                endTitle: "Marathon Finished!",
                endSubtitle: (solved, total, percent) => 
                    `You lasted ${solved} puzzles. Impressive endurance!`,
                icon: "fa-solid fa-person-running",
                accent: "violet",
                shortName: "Marathon"
            };
        default:
            return {
                successTitle: "Nailed it!",
                endTitle: "Session Complete!",
                endSubtitle: (solved, total, percent) => {
                    if (percent === 100) return "Perfect completion!";
                    if (percent >= 90) return "Excellent work!";
                    if (percent >= 75) return "Great job!";
                    return "Solid effort!";
                },
                icon: "fa-solid fa-trophy",
                accent: "emerald",
                shortName: "Normal"
            };
    }
}


// Compute a delightful performance tier + messaging from session stats
function getPerformanceTier(solved, total, perfectSolves, reveals, extraHints, modeKey) {
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
    const helpCount = reveals + extraHints;
    const noHelpPerfect = (perfectSolves === solved) && (helpCount === 0) && (solved > 0);
    const isFullPerfect = (percent === 100) && (helpCount === 0);

    let tier = "Solid Run";
    let tierClass = "text-emerald-400";
    let flavor = "";
    let crown = false;
    let confettiBoost = 0;

    if (modeKey === 'no_mistakes' && percent === 100) {
        tier = "FLAWLESS VICTORY";
        tierClass = "text-cyan-400";
        flavor = "Zero mistakes. Maximum respect.";
        crown = true;
        confettiBoost = 2;
    } else if (noHelpPerfect || isFullPerfect) {
        tier = "PERFECT RUN";
        tierClass = "text-emerald-400";
        flavor = "No helps, no mistakes — you owned it!";
        crown = true;
        confettiBoost = 2;
    } else if (percent === 100) {
        tier = "COMPLETE";
        tierClass = "text-emerald-400";
        flavor = helpCount <= 2 ? "Outstanding control." : "You got every single one.";
        crown = helpCount === 0;
    } else if (percent >= 90) {
        tier = "EXCELLENT";
        tierClass = "text-emerald-400";
        flavor = "So close to perfect — great work.";
    } else if (percent >= 75) {
        tier = "STRONG";
        tierClass = "text-amber-400";
        flavor = "Really good session.";
    } else if (percent >= 50) {
        tier = "GOOD EFFORT";
        tierClass = "text-amber-400";
        flavor = "You pushed through.";
    } else {
        tier = "FINISHED";
        tierClass = "text-slate-400";
        flavor = "Every session makes you sharper.";
    }

    // Mode-specific overrides for flavor
    if (modeKey === 'time_attack' && percent >= 80) {
        flavor = "Clock management was on point.";
    }
    if (modeKey === 'marathon' && solved >= 20) {
        tier = "MARATHON LEGEND";
        tierClass = "text-violet-400";
        flavor = "That was a serious grind. Impressive.";
        crown = true;
    }
    if (modeKey === 'challenge' && percent >= 70) {
        flavor = "You took the hard path and delivered.";
    }

    return { tier, tierClass, flavor, crown, confettiBoost, percent };
}


// ============================================
// ACHIEVEMENT SYSTEM
// ============================================

const achievements = [
    // Beginner
    { id: "first_solve", name: "First Victory", desc: "Solve your first puzzle", icon: "🏆", tier: "Bronze" },
    { id: "first_perfect", name: "Flawless", desc: "Solve a puzzle with zero reveals and zero hints", icon: "✨", tier: "Bronze" },
    { id: "use_reveal", name: "Need a Hand?", desc: "Use the Reveal a Letter button for the first time", icon: "👁️", tier: "Bronze" },
    { id: "use_extra_hint", name: "A Little Help", desc: "Use an Extra Hint for the first time", icon: "💡", tier: "Bronze" },

    // Progress
    { id: "solve_25", name: "Getting the Hang of It", desc: "Solve 25 puzzles total", icon: "📈", tier: "Silver" },
    { id: "solve_100", name: "Dedicated Solver", desc: "Solve 100 puzzles total", icon: "🎯", tier: "Gold" },
    { id: "perfect_5", name: "Perfectionist", desc: "Achieve 5 perfect solves (0 help)", icon: "🌟", tier: "Silver" },
    { id: "perfect_20", name: "Master Solver", desc: "Achieve 20 perfect solves", icon: "👑", tier: "Gold" },

    // Sessions
    { id: "complete_40", name: "Solid Session", desc: "Complete a 40+ question session", icon: "📋", tier: "Silver" },
    { id: "complete_80", name: "Full Run", desc: "Complete an 80-question category", icon: "🏅", tier: "Gold" },
    { id: "mixed_bag", name: "Mixed Bag Explorer", desc: "Complete a Mixed Bag session", icon: "🎲", tier: "Silver" },
    { id: "mixed_perfect", name: "Chaos Master", desc: "Complete a Mixed Bag session with 3+ perfect solves", icon: "🌀", tier: "Gold" },

    // Challenge
    { id: "no_help_10", name: "Iron Will", desc: "Solve 10 puzzles in a row with zero help", icon: "🛡️", tier: "Gold" },
    { id: "low_help_80", name: "Efficient", desc: "Complete an 80-question session using 5 or fewer reveals", icon: "⚡", tier: "Gold" },
];


function isAchievementUnlocked(id) {
    return !!gameState.achievements[id];
}


function getAchievementProgress(ach) {
    const lifetimeSolved = getLifetimeSolvedCount();
    switch (ach.id) {
        case "first_solve":
            return { current: Math.min(lifetimeSolved, 1), target: 1 };
        case "first_perfect":
            return { current: Math.min(gameState.totalPerfectSolves || 0, 1), target: 1 };
        case "solve_25":
            return { current: Math.min(lifetimeSolved, 25), target: 25 };
        case "solve_100":
            return { current: Math.min(lifetimeSolved, 100), target: 100 };
        case "perfect_5":
            return { current: Math.min(gameState.totalPerfectSolves || 0, 5), target: 5 };
        case "perfect_20":
            return { current: Math.min(gameState.totalPerfectSolves || 0, 20), target: 20 };
        case "complete_40":
            // This one is harder to track historically without storing session history.
            // For now we'll just show it as binary (unlocked or not) in the modal.
            return null;
        case "complete_80":
            return null;
        case "mixed_bag":
            return null;
        case "mixed_perfect":
            return null;
        case "no_help_10":
            return { current: Math.min(gameState.currentStreak || 0, 10), target: 10 };
        case "low_help_80":
            return null;
        default:
            return null;
    }
}

