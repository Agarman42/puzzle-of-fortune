/** Core game flow: sessions, answers, reveals, navigation */


// Mode selection now lives entirely in the New Session setup modal.
// Kept as no-ops so any residual call sites remain safe.
function initModeSelector() { /* modes chosen in showGameSetupModal */ }

function updateModeDescription() { /* no hub mode description UI */ }


// ===== Time Attack Timer Functions =====
function startTimeAttackTimer() {
    stopTimeAttackTimer();
    if (currentGameMode !== 'time_attack') return;

    timeAttackSecondsLeft = TIME_ATTACK_DURATION;
    updateTimerDisplay();

    const display = document.getElementById('timer-display');
    if (display) {
        display.classList.remove('hidden');
        display.classList.add('flex', 'is-on');
        display.classList.remove('is-urgent');
    }

    timeAttackInterval = setInterval(() => {
        timeAttackSecondsLeft--;
        updateTimerDisplay();

        if (timeAttackSecondsLeft <= 0) {
            stopTimeAttackTimer();
            handleTimeUp();
        }
    }, 1000);
}


function stopTimeAttackTimer() {
    if (timeAttackInterval) {
        clearInterval(timeAttackInterval);
        timeAttackInterval = null;
    }
    const display = document.getElementById('timer-display');
    if (display) {
        display.classList.add('hidden');
        display.classList.remove('flex', 'is-on', 'is-urgent');
        display.classList.add('hidden');
    }
}


function updateTimerDisplay() {
    const valueEl = document.getElementById('timer-value');
    const display = document.getElementById('timer-display');
    if (!valueEl || !display) return;

    valueEl.textContent = timeAttackSecondsLeft;

    display.classList.toggle('is-urgent', timeAttackSecondsLeft <= 10);
}


function handleTimeUp() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    if (currentPuzzleIndex < 0 || currentPuzzleIndex >= sessionPuzzles.length) return;

    const puzzle = sessionPuzzles[currentPuzzleIndex];
    timeUpUsed = true;
    fullRevealUsed = true; // makes display static + "Continue" label
    sessionPointsAwarded[puzzle.id] = true; // 0 pts; Continue should not re-score

    // Reveal the full answer (no solve credit, 0 pts)
    const answer = puzzle.answer.toUpperCase();
    let pos = 0;
    for (let i = 0; i < answer.length; i++) {
        if (isAnswerLetter(answer[i])) currentRevealed.add(pos++);
    }
    createPuzzleDisplay(puzzle);
    updatePotentialPointsUI();
    updateSubmitButton();
    updateNextButton();

    showToast("Time's up — 0 points. Click Continue / Next.", 2200);
}


function unlockAchievement(id) {
    if (isAchievementUnlocked(id)) return false;

    const ach = achievements.find(a => a.id === id);
    if (!ach) return false;

    gameState.achievements[id] = {
        unlockedAt: Date.now()
    };

    saveGameState();

    // Show nice achievement unlock banner
    showAchievementUnlock(ach);
    updateAchievementsButton();

    return true;
}


function checkAndUnlockAchievements(context = {}) {
    // context can contain: { isMixed: boolean, sessionSolved: number, sessionPerfects: number, etc. }
    const lifetimeSolved = getLifetimeSolvedCount();

    // Beginner
    if (lifetimeSolved >= 1) unlockAchievement("first_solve");
    if (gameState.totalPerfectSolves >= 1) unlockAchievement("first_perfect");
    if (gameState.hasUsedReveal) unlockAchievement("use_reveal");
    if (gameState.hasUsedExtraHint) unlockAchievement("use_extra_hint");

    // Progress (lifetime)
    if (lifetimeSolved >= 25) unlockAchievement("solve_25");
    if (lifetimeSolved >= 100) unlockAchievement("solve_100");
    if (gameState.totalPerfectSolves >= 5) unlockAchievement("perfect_5");
    if (gameState.totalPerfectSolves >= 20) unlockAchievement("perfect_20");

    // Sessions
    if (context.sessionSolved >= 40) unlockAchievement("complete_40");
    if (context.sessionSolved >= 80) unlockAchievement("complete_80");

    if (context.isMixed) {
        unlockAchievement("mixed_bag");
        if (context.sessionPerfects >= 3) unlockAchievement("mixed_perfect");
    }

    // Challenge
    if (gameState.currentStreak >= 10) unlockAchievement("no_help_10");

    // Low help run (80-question session with very few reveals)
    if (context.sessionSolved >= 80 && context.totalRevealsUsed <= 5) {
        unlockAchievement("low_help_80");
    }
}


function startDailyPuzzle() {
    const today = getTodayDateString();
    const dailyPuzzle = getDailyPuzzle();

    // Check if already completed today
    if (gameState.dailyLastDate === today) {
        showDailyAlreadyDone();
        return;
    }

    // Set up a special 1-puzzle "daily" session
    window.currentSessionPuzzles = [dailyPuzzle];
    selectedCategory = "Daily Puzzle";
    selectedNumQuestions = 1;
    sessionIsFullRun = false;
    currentGameMode = 'normal'; // Daily is treated as normal mode for now

    // Reset session tracking
    sessionPointsEarned = 0;
    sessionRevealsUsed = 0;
    sessionExtraHintsUsed = 0;
    perfectSolvesThisSession = 0;
    sessionSolved = {};
    sessionPointsAwarded = {};
    sessionEnded = false;
    isSubmittingAnswer = false;
    lastSessionPoints = 0;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    updateHeaderScore(false);
    loadPuzzle(0);
}


function revealRandomLetter() {
    if (sessionEnded) return;
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const puzzle = sessionPuzzles[currentPuzzleIndex];
    const answer = puzzle.answer.toUpperCase();
    
    const unrevealedLetters = {};
    let letterPos = 0;
    
    for (let i = 0; i < answer.length; i++) {
        const ch = answer[i];
        if (isAnswerLetter(ch)) {
            const tile = toTileChar(ch);
            if (!currentRevealed.has(letterPos)) {
                if (!unrevealedLetters[tile]) unrevealedLetters[tile] = [];
                unrevealedLetters[tile].push(letterPos);
            }
            letterPos++;
        }
    }
    
    const availableLetters = Object.keys(unrevealedLetters);
    if (availableLetters.length === 0) {
        showAlert("Every letter on this puzzle is already showing.", {
            title: "Nothing left to reveal",
            variant: 'info',
            icon: 'sparkles',
            confirmLabel: 'Nice',
        });
        return;
    }

    // Smarter reveal: prefer letters with more unknown positions + slight vowel bias
    const VOWELS = ['A', 'E', 'I', 'O', 'U'];
    let weightedList = [];

    availableLetters.forEach(letter => {
        const count = unrevealedLetters[letter].length;
        let weight = count;                    // more occurrences = higher chance
        if (VOWELS.includes(letter)) weight += 1; // small bonus for vowels

        for (let i = 0; i < weight; i++) {
            weightedList.push(letter);
        }
    });

    const chosenLetter = weightedList[Math.floor(Math.random() * weightedList.length)];
    unrevealedLetters[chosenLetter].forEach(pos => currentRevealed.add(pos));
    
    currentRevealsUsed++;
    revealsThisRound++;
    sessionRevealsUsed++;
    gameState.lifetimeRevealsUsed = (gameState.lifetimeRevealsUsed || 0) + 1;
    gameState.currentStreak = 0;
    if (!gameState.hasUsedReveal) {
        gameState.hasUsedReveal = true;
    }
    saveGameState();
    
    createPuzzleDisplay(puzzle);
    updatePotentialPointsUI();
    checkAndUnlockAchievements(); // "use_reveal"

    // Nice pop animation on the whole puzzle when revealing
    const puzzleContainer = document.getElementById('puzzle-display');
    if (puzzleContainer) {
        puzzleContainer.classList.add('letter-just-revealed');
        setTimeout(() => {
            if (puzzleContainer) puzzleContainer.classList.remove('letter-just-revealed');
        }, 450);
    }
}


function useExtraHint() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const puzzle = sessionPuzzles[currentPuzzleIndex];
    if (!puzzle.extraHint || extraHintUsed > 0) return;

    const box = document.getElementById('extra-hint-box');
    const btn = document.getElementById('extra-hint-btn');
    if (!box || !btn) return;

    box.innerHTML = `<span class="font-semibold">Hint:</span> ${escapeHtml(puzzle.extraHint)}`;
    box.classList.remove('hidden');
    box.classList.add('block');

    extraHintUsed = 1;
    sessionExtraHintsUsed++;
    gameState.lifetimeExtraHintsUsed = (gameState.lifetimeExtraHintsUsed || 0) + 1;
    if (!gameState.hasUsedExtraHint) {
        gameState.hasUsedExtraHint = true;
    }
    saveGameState();
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.innerHTML = `<i class="fa-solid fa-lightbulb text-[10px]"></i> <span>Clue used</span>`;

    updatePotentialPointsUI();
    checkAndUnlockAchievements(); // "use_extra_hint"
}


function loadPuzzle(index) {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    if (index < 0 || index >= sessionPuzzles.length) return;
    if (sessionEnded) {
        showToast("This session is over. Return to the menu or play again.");
        return;
    }

    stopTimeAttackTimer();

    currentPuzzleIndex = index;
    currentRevealed = new Set();
    currentRevealsUsed = 0;
    extraHintUsed = 0;
    fullRevealUsed = false;
    timeUpUsed = false;

    const puzzle = sessionPuzzles[index];
    const lifetimeSolved = !!gameState.solved[puzzle.id];
    const solvedThisSession = !!sessionSolved[puzzle.id];
    
    document.getElementById('current-puzzle-num').textContent = (currentPuzzleIndex + 1);
    
    const totalEl = document.getElementById('total-puzzles');
    if (totalEl) totalEl.textContent = sessionPuzzles.length;
    const totalSolvedEl = document.getElementById('total-solved');
    if (totalSolvedEl) totalSolvedEl.textContent = sessionPuzzles.length;

    const difficulty = getDifficulty(puzzle);
    const round = getRound(puzzle.id);
    const statusEl = document.getElementById('puzzle-status');
    
    const catIcon = getCategoryIcon(puzzle.category);
    let statusHTML = `
        <span class="text-xs font-medium">${catIcon} ${escapeHtml(puzzle.category)}</span> 
        <span class="text-[10px] text-slate-400 mx-1">•</span>
        <span class="px-2 py-0.5 text-[10px] rounded-full font-medium 
            ${difficulty === 'Easy' ? 'bg-emerald-900/40 text-emerald-300' : 
              difficulty === 'Medium' ? 'bg-amber-900/40 text-amber-300' : 
              'bg-orange-900/40 text-orange-300'}">${difficulty}</span>
    `;
    
    if (lifetimeSolved) {
        statusHTML += ` <span class="solved-badge text-xs px-2 py-0.5 rounded-full font-medium ml-1">SOLVED</span>`;
    }
    statusEl.innerHTML = statusHTML;
    
    document.getElementById('hint-text').textContent = puzzle.question;
    
    // Only pre-fill the board for puzzles solved *earlier in this exact session*
    // (so Prev / jump back within the current run shows the solved state).
    // Lifetime-solved puzzles (from previous sessions) always load fresh/blank
    // so repeats in Mixed Bag, Play Again, etc. are still playable and fun.
    if (solvedThisSession) {
        const answer = puzzle.answer.toUpperCase();
        let pos = 0;
        for (let i = 0; i < answer.length; i++) {
            if (isAnswerLetter(answer[i])) currentRevealed.add(pos++);
        }
    }
    
    createPuzzleDisplay(puzzle);
    updateSolvedCountUI();
    updatePotentialPointsUI();
    updateSubmitButton();

    // Control Extra Hint button visibility
    const extraBtn = document.getElementById('extra-hint-btn');
    const extraBox = document.getElementById('extra-hint-box');
    if (extraBtn && extraBox) {
        // Always reset the box when loading a new puzzle
        extraBox.innerHTML = '';
        extraBox.classList.add('hidden');
        extraBox.classList.remove('block');

        if (puzzle.extraHint) {
            extraBtn.classList.remove('hidden');
            extraBtn.disabled = false;
            extraBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            extraBtn.innerHTML = `<i class="fa-solid fa-lightbulb text-[10px]"></i> <span>Extra clue (−2)</span>`;

            // If the hint was already used this session (rare edge case), re-show it
            if (extraHintUsed > 0 && puzzle.extraHint) {
                extraBox.innerHTML = `<span class="font-semibold">Hint:</span> ${escapeHtml(puzzle.extraHint)}`;
                extraBox.classList.remove('hidden');
                extraBox.classList.add('block');
                extraBtn.disabled = true;
                extraBtn.classList.add('opacity-50', 'cursor-not-allowed');
                extraBtn.innerHTML = `<i class="fa-solid fa-lightbulb text-[10px]"></i> <span>Clue used</span>`;
            }
        } else {
            extraBtn.classList.add('hidden');
        }
    }

    updateNextButton();

    // Hide buttons based on current game mode
    const modeConfig = GAME_MODES[currentGameMode] || GAME_MODES.normal;
    const revealBtn = document.getElementById('reveal-btn');
    const extraHintBtn = document.getElementById('extra-hint-btn');
    const fullRevealBtn = document.getElementById('full-reveal-btn');
    if (revealBtn) revealBtn.style.display = modeConfig.allowReveal ? '' : 'none';
    if (extraHintBtn) {
        // Extra hint only if mode allows AND this puzzle has one (visibility also set above)
        if (!modeConfig.allowExtraHint) extraHintBtn.style.display = 'none';
    }
    // Challenge: no full-answer reveal either
    if (fullRevealBtn) {
        fullRevealBtn.style.display = modeConfig.allowReveal ? '' : 'none';
    }

    // Show current game mode badge in the header (except for Normal, which is the default)
    updateGameModeBadge();

    // Time Attack: only start timer if this puzzle is not already completed this session
    if (currentGameMode === 'time_attack' && !solvedThisSession && !sessionSolved[puzzle.id]) {
        startTimeAttackTimer();
    }
}


function updateSubmitButton() {
    const btn = document.getElementById('submit-btn');
    if (!btn) return;

    const icon = btn.querySelector('i');
    const span = btn.querySelector('span');

    const locked = typeof puzzleLockedThisSession === 'function' && puzzleLockedThisSession();
    const giveUp = document.getElementById('full-reveal-btn');
    const revealBtn = document.getElementById('reveal-btn');
    const extraBtn = document.getElementById('extra-hint-btn');
    if (giveUp) giveUp.disabled = locked;
    if (revealBtn) revealBtn.disabled = locked;
    if (locked && extraBtn) extraBtn.disabled = true;

    if (locked) {
        btn.classList.add('hidden');
        return;
    }
    btn.classList.remove('hidden');
    btn.classList.add('btn-gold');
    btn.classList.remove('btn-continue');
    if (icon) icon.className = 'fa-solid fa-check';
    if (span) span.textContent = 'Submit';
}


function updateNextButton() {
    const btn = document.getElementById('next-btn');
    if (!btn) return;

    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const isLastPuzzle = (currentPuzzleIndex + 1 >= sessionPuzzles.length);

    const span = btn.querySelector('span');

    if (isLastPuzzle) {
        if (span) span.textContent = 'Finish Session';
        btn.classList.add('is-finish');
    } else {
        if (span) span.textContent = 'Next';
        btn.classList.remove('is-finish');
    }
}


function submitAnswer() {
    const container = document.getElementById('puzzle-display');
    if (!container) return;

    if (sessionEnded) {
        showToast("This session is over. Return to the menu or play again.");
        return;
    }

    if (isSubmittingAnswer) return;

    if (typeof puzzleLockedThisSession === 'function' && puzzleLockedThisSession()) {
        nextPuzzle();
        return;
    }

    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const puzzle = sessionPuzzles[currentPuzzleIndex];
    const answer = puzzle.answer.toUpperCase();
    const totalLetters = [...puzzle.answer].filter(isAnswerLetter).length;
    const inputs = Array.from(container.querySelectorAll('input.puzzle-tile'));

    let isCorrect = false;
    if (currentRevealed.size >= totalLetters) {
        isCorrect = true;
    } else {
        // Blank / incomplete submit: never count as a "wrong answer" for mistake modes
        const emptyInputs = inputs.filter((inp) => !(inp.value || '').trim());
        if (inputs.length > 0 && emptyInputs.length === inputs.length) {
            showToast("Type your answer first.", 1400);
            return;
        }

        // Allow leaving only a leading The/A/An blank; otherwise require all tiles filled
        if (emptyInputs.length > 0) {
            const artLen = leadingArticleLetterCount(puzzle.answer);
            const emptyPos = emptyInputs.map((inp) => parseInt(inp.dataset.position || '-1', 10)).sort((a, b) => a - b);
            const onlyLeadingArticle =
                artLen > 0 &&
                emptyPos.length === artLen &&
                emptyPos.every((p, i) => p === i);
            if (!onlyLeadingArticle) {
                showToast("Fill in all the tiles.", 1400);
                return;
            }
        }

        let reconstructed = '';
        const allTiles = container.querySelectorAll('.puzzle-tile, input.puzzle-tile');
        allTiles.forEach(el => {
            if (el.classList.contains('punctuation')) return;
            if (el.tagName === 'INPUT') {
                reconstructed += el.value.toUpperCase();
            } else {
                reconstructed += el.textContent.toUpperCase();
            }
        });
        // Short aliases only when the board is fully filled (no empty inputs)
        const allowShortAliases = emptyInputs.length === 0;
        isCorrect = answersMatch(reconstructed, puzzle.answer, puzzle.aliases, { allowShortAliases });
    }

    if (isCorrect) {
        isSubmittingAnswer = true;
        // Always track for this session's recap
        sessionSolved[puzzle.id] = true;

        // Award 0 if full reveal was used; otherwise apply mode multiplier via helper
        let pointsEarned = computePointsEarned(puzzle, currentRevealsUsed, extraHintUsed, fullRevealUsed);

        // Only award points once per puzzle per session
        if (!sessionPointsAwarded[puzzle.id]) {
            gameState.score += pointsEarned;
            sessionPointsEarned += pointsEarned;
            sessionPointsAwarded[puzzle.id] = true;
        }

        // Always record as solved for lifetime Progress / stats
        // (Short sessions still try to avoid repeats via the recentShortPuzzles list)
        if (!gameState.solved[puzzle.id]) {
            gameState.solved[puzzle.id] = true;

            if (currentRevealsUsed === 0 && extraHintUsed === 0 && !fullRevealUsed) {
                gameState.currentStreak++;
            } else {
                gameState.currentStreak = 0;
            }

            if (!fullRevealUsed && currentRevealsUsed === 0 && extraHintUsed === 0) {
                perfectSolvesThisSession++;
                gameState.totalPerfectSolves = (gameState.totalPerfectSolves || 0) + 1;
            }
        }

        saveGameState();
        updateHeaderScore();
        checkAndUnlockAchievements();
        let pos = 0;
        for (let i = 0; i < answer.length; i++) {
            if (isAnswerLetter(answer[i])) currentRevealed.add(pos++);
        }
        createPuzzleDisplay(puzzle);
        stopTimeAttackTimer();
        updateSubmitButton();
        updateNextButton();
        showSuccessModal(puzzle, pointsEarned);
        isSubmittingAnswer = false;
    } else {
        // Wrong answer handling
        const modeCfg = GAME_MODES[currentGameMode] || GAME_MODES.normal;

        if (inputs.length > 0) {
            if (modeCfg.wrongAnswerClearsPuzzle || modeCfg.endOnMistake) {
                // Challenge / No Mistakes / Marathon: wipe tile progress
                inputs.forEach(inp => inp.value = '');
                // Also clear any letters frozen from prior wrong attempts
                if (modeCfg.endOnMistake || modeCfg.wrongAnswerClearsPuzzle) {
                    // Keep already-revealed help letters; only clear typed progress via inputs above
                }
                if (modeCfg.endOnMistake) {
                    sessionEnded = true;
                    showToast("Wrong answer — session over!", 1600);
                    stopTimeAttackTimer();
                    setTimeout(() => {
                        showEndOfListModal();
                    }, 1200);
                } else {
                    showToast("Wrong! All progress on this puzzle lost.", 1600);
                }
            } else {
                // Normal / Time Attack: keep letters that are correct in position
                const expected = [];
                let p = 0;
                for (let i = 0; i < answer.length; i++) {
                    const ch = answer[i];
                    if (isAnswerLetter(ch)) {
                        expected[p++] = toTileChar(ch);
                    }
                }

                let kept = 0;
                const keptPositions = [];

                inputs.forEach(inp => {
                    const pos = parseInt(inp.dataset.position || '-1', 10);
                    const val = (inp.value || '').toUpperCase();
                    if (pos >= 0 && val && val === expected[pos]) {
                        keptPositions.push(pos);
                        kept++;
                    } else {
                        inp.value = '';
                    }
                });

                if (keptPositions.length > 0) {
                    keptPositions.forEach(pos => currentRevealed.add(pos));
                    createPuzzleDisplay(puzzle);
                    updatePotentialPointsUI();

                    const display = document.getElementById('puzzle-display');
                    if (display) {
                        display.classList.add('letters-just-frozen');
                        setTimeout(() => {
                            if (display) display.classList.remove('letters-just-frozen');
                        }, 1300);
                    }
                }

                if (kept > 0) {
                    showToast(`${kept} letter${kept > 1 ? 's' : ''} locked in!`, 1600);
                } else {
                    showToast("Not quite right. Keep trying!", 1400);
                }
            }
        } else {
            showToast("Not quite right. Keep trying!", 1400);
        }

        // Gentle shake + focus (skip when the session is ending or board was wiped)
        if (!modeCfg.wrongAnswerClearsPuzzle && !modeCfg.endOnMistake) {
            container.classList.add('board-wrong');
            setTimeout(() => container.classList.remove('board-wrong'), 400);
            container.style.transition = 'none';
            container.style.transform = 'translateX(3px)';
            setTimeout(() => {
                container.style.transition = 'transform 0.12s ease';
                container.style.transform = 'translateX(-3px)';
                setTimeout(() => { container.style.transform = 'translateX(0)'; }, 70);
            }, 8);

            setTimeout(() => {
                if (typeof shouldAutofocusTiles === 'function' && !shouldAutofocusTiles()) return;
                const inputs2 = Array.from(container.querySelectorAll('input.puzzle-tile'));
                const firstEmpty = inputs2.find(i => !i.value);
                if (firstEmpty) {
                    firstEmpty.focus();
                    firstEmpty.select();
                } else if (inputs2.length) {
                    inputs2[0].focus();
                    inputs2[0].select();
                }
            }, 120);
        }
    }
}


function prevPuzzle() {
    if (sessionEnded) {
        showToast("This session is over.");
        return;
    }
    let prevIndex = currentPuzzleIndex - 1;
    if (prevIndex < 0) {
        showToast("You're at the first puzzle.");
        return;
    }
    loadPuzzle(prevIndex);
}


async function quitToMenu() {
    const ok = await showConfirm(
        "You'll lose progress on the current session (lifetime score stays saved).",
        {
            title: "Leave this session?",
            confirmLabel: "Return to menu",
            cancelLabel: "Keep playing",
            variant: 'danger',
            icon: 'door-open',
        }
    );
    if (!ok) return;

    // Record recently played for short sessions (to avoid repeats next time)
    if (!sessionIsFullRun && window.currentSessionPuzzles) {
        const playedIds = window.currentSessionPuzzles.map(p => p.id);
        addToRecentShortPuzzles(playedIds);
    }

    // Capture session points for header (even if quitting early)
    if (!sessionIsFullRun) {
        lastSessionPoints = sessionPointsEarned;
    }

    window.currentSessionPuzzles = null;

    // Clear session stats
    sessionPointsEarned = 0;
    sessionRevealsUsed = 0;
    sessionExtraHintsUsed = 0;
    perfectSolvesThisSession = 0;
    sessionSolved = {};
    sessionPointsAwarded = {};
    sessionIsFullRun = false;
    sessionEnded = false;
    isSubmittingAnswer = false;
    currentGameMode = 'normal';
    clearSuccessAdvanceHandler();

    stopTimeAttackTimer();

    // Restore buttons
    const revealBtn = document.getElementById('reveal-btn');
    const extraBtn = document.getElementById('extra-hint-btn');
    if (revealBtn) revealBtn.style.display = '';
    if (extraBtn) extraBtn.style.display = '';

    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');

    // Show last short session points in header if applicable
    updateHeaderScore(!sessionIsFullRun);
    updateAchievementsButton();
    updateDailyUI();
}


// Clean return used after completing a full session (no scary confirm, and clears the round)
function finishSessionAndReturn() {
    const modal = document.getElementById('end-modal');
    if (modal) modal.remove();

    // Record the puzzles we just played so we can avoid repeats in future short sessions
    if (!sessionIsFullRun && window.currentSessionPuzzles) {
        const playedIds = window.currentSessionPuzzles.map(p => p.id);
        addToRecentShortPuzzles(playedIds);
    }

    // Capture last short session points for the main menu header
    if (!sessionIsFullRun) {
        lastSessionPoints = sessionPointsEarned;
    } else {
        lastSessionPoints = 0;
    }

    // === Stats 2.0: Record per-mode session data (skip pure Daily 1-puzzle runs) ===
    if (selectedCategory !== 'Daily Puzzle') {
        const modeKey = currentGameMode || 'normal';
        const runKey = `${modeKey}RunsCompleted`;
        const bestKey = `${modeKey}BestScore`;

        gameState[runKey] = (gameState[runKey] || 0) + 1;

        if (!gameState[bestKey] || sessionPointsEarned > gameState[bestKey]) {
            gameState[bestKey] = sessionPointsEarned;
        }

        const pointsKey = `${modeKey}TotalPoints`;
        gameState[pointsKey] = (gameState[pointsKey] || 0) + sessionPointsEarned;

        const sessionPuzzlesForStats = window.currentSessionPuzzles || [];
        const wasPerfect = perfectSolvesThisSession > 0 && perfectSolvesThisSession === sessionPuzzlesForStats.length;
        if (wasPerfect) {
            const perfectKey = `${modeKey}PerfectRuns`;
            gameState[perfectKey] = (gameState[perfectKey] || 0) + 1;
        }
    }

    saveGameState();
    // ===============================================

    // Capture session points for header (even if quitting early)
    if (!sessionIsFullRun) {
        lastSessionPoints = sessionPointsEarned;
    }

    window.currentSessionPuzzles = null;

    // Clear session stats
    sessionPointsEarned = 0;
    sessionRevealsUsed = 0;
    sessionExtraHintsUsed = 0;
    perfectSolvesThisSession = 0;
    sessionSolved = {};
    sessionPointsAwarded = {};
    sessionIsFullRun = false;
    sessionEnded = false;
    isSubmittingAnswer = false;
    currentGameMode = 'normal';
    clearSuccessAdvanceHandler();

    stopTimeAttackTimer();

    // Restore buttons
    const revealBtn = document.getElementById('reveal-btn');
    const extraBtn = document.getElementById('extra-hint-btn');
    if (revealBtn) revealBtn.style.display = '';
    if (extraBtn) extraBtn.style.display = '';

    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');

    // Show last short session points in header if applicable
    updateHeaderScore(!sessionIsFullRun);
    updateAchievementsButton();
    updateDailyUI();
}


async function revealFullAnswerWithConfirm() {
    if (sessionEnded) return;
    const modeConfig = GAME_MODES[currentGameMode] || GAME_MODES.normal;
    if (!modeConfig.allowReveal) {
        showToast("Full reveal is disabled in this mode.");
        return;
    }
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const puzzle = sessionPuzzles[currentPuzzleIndex];
    const ok = await showConfirm(
        "This shows the full phrase immediately.\nYou’ll earn 0 points for this puzzle.",
        {
            title: "Give up on this phrase?",
            confirmLabel: "Show answer",
            cancelLabel: "Keep solving",
            variant: 'warning',
            icon: 'flag',
        }
    );
    if (!ok) return;

    stopTimeAttackTimer();
    fullRevealUsed = true;
    gameState.currentStreak = 0;

    // Session progress: count as completed so Finish Session works
    sessionSolved[puzzle.id] = true;
    // No points; prevent Continue/submit from awarding later
    sessionPointsAwarded[puzzle.id] = true;

    // Lifetime progress list includes revealed answers (not a perfect solve)
    if (!gameState.solved[puzzle.id]) {
        gameState.solved[puzzle.id] = true;
    }
    saveGameState();
    checkAndUnlockAchievements();

    updateSubmitButton();
    updateNextButton();
    updatePotentialPointsUI();
    const answer = puzzle.answer.toUpperCase();
    let pos = 0;
    for (let i = 0; i < answer.length; i++) {
        if (isAnswerLetter(answer[i])) currentRevealed.add(pos++);
    }
    createPuzzleDisplay(puzzle);
    showToast("Answer shown · 0 pts", 1600);
}


function nextPuzzle() {
    if (sessionEnded) {
        showEndOfListModal();
        return;
    }
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    let nextIndex = currentPuzzleIndex + 1;

    if (nextIndex >= sessionPuzzles.length) {
        // Prevent finishing the session until the last puzzle is solved or fully revealed (incl. Time Attack timeout reveal)
        // Only sessionSolved (or the current-instance reveal/time-up flags) count.
        // A lifetime-solved puzzle that happens to be last still needs to be actively completed this run.
        const currentPuzzle = sessionPuzzles[currentPuzzleIndex];
        const isSolved = !!(sessionSolved[currentPuzzle.id] || fullRevealUsed || timeUpUsed);

        if (!isSolved) {
            showToast("Solve or give up on this last puzzle first.");
            return;
        }

        showEndOfListModal();
        return;
    }

    loadPuzzle(nextIndex);
}


function startGame() {
    // Legacy entry point (old button was removed from the hub).
    // Now simply opens the clean focused setup modal.
    showGameSetupModal();
}


// Quick one-tap preset (bypasses the full modal for the most common case)
function quickStartNormal10() {
    startSessionWithSettings("Mixed Bag", 10, 'normal');
}


function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Prefer puzzles not seen in recent short sessions, without fully undoing that preference. */

function pickSessionPuzzles(pool, takeCount) {
    const recent = gameState.recentShortPuzzles || [];
    const recentSet = new Set(recent);
    const fresh = pool.filter(p => !recentSet.has(p.id));
    const seen = pool.filter(p => recentSet.has(p.id));
    shuffleInPlace(fresh);
    shuffleInPlace(seen);
    const ordered = fresh.concat(seen);
    if (takeCount == null || takeCount >= ordered.length) return ordered;
    return ordered.slice(0, takeCount);
}


// Shared session launcher – used by the new modal, Quick Start, and (temporarily) any old paths
function startSessionWithSettings(category, numQuestions, mode) {
    if (!category) {
        showToast("Please select a category!", 2000);
        return;
    }

    selectedCategory = category;
    selectedNumQuestions = numQuestions;
    currentGameMode = mode || 'normal';

    // Persist last-used choices for the New Session modal
    gameState.lastCategory = category;
    gameState.lastNumQuestions = numQuestions;
    gameState.lastGameMode = currentGameMode;
    saveGameState();

    // The old name was already handled in the modal; for quick path we keep whatever is in gameState
    if (!gameState.playerName) gameState.playerName = "Player";

    const modeInfo = GAME_MODES[currentGameMode];
    // Note: the confirm for non-normal is performed by the caller (the modal) so we don't duplicate here.
    // For the Quick path we deliberately stay in Normal.

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    updateHeaderScore();
    updateSolvedCountUI();

    // (The rest of the original startGame filtering + session reset + loadPuzzle is below)
    // We will keep the existing body for now and call into it, or fully extract in the next step.
    // For the first implementation we reuse the proven path by setting the globals and calling the original startGame
    // after the screen toggle has happened. To avoid double work we will inline the core here in a follow-up edit.

    // TEMPORARY BRIDGE: set globals then call the existing startGame body by extracting the real work.
    // For cleanliness in this edit we will keep the original startGame for now and have it read from the globals we just set.
    // The old startGame is still present in the file (its button was removed from the hub). It will continue to work as a fallback.

    // Build the session list, preferring puzzles not seen in recent short runs
    let filteredPuzzles;
    if (selectedCategory === "Mixed Bag") {
        const pool = [...puzzles];
        // "All" means the full bank; otherwise take the requested count (capped by pool size)
        const take = (selectedNumQuestions && selectedNumQuestions !== 999)
            ? selectedNumQuestions
            : pool.length;
        filteredPuzzles = pickSessionPuzzles(pool, take);
    } else {
        const pool = puzzles.filter(p => p.category === selectedCategory);
        if (selectedNumQuestions && selectedNumQuestions !== 999) {
            filteredPuzzles = pickSessionPuzzles(pool, selectedNumQuestions);
        } else {
            // Category "All" — full category, shuffled, still prefer unseen first
            filteredPuzzles = pickSessionPuzzles(pool, pool.length);
        }
    }

    window.currentSessionPuzzles = filteredPuzzles;

    sessionPointsEarned = 0;
    sessionRevealsUsed = 0;
    sessionExtraHintsUsed = 0;
    perfectSolvesThisSession = 0;
    sessionSolved = {};
    sessionPointsAwarded = {};
    sessionIsFullRun = (selectedNumQuestions === 999);
    sessionEnded = false;
    isSubmittingAnswer = false;
    lastSessionPoints = 0;

    updateHeaderScore();
    loadPuzzle(0);
}


async function resetProgress() {
    const ok = await showConfirm(
        "Wipes score, solved puzzles, achievements, and daily streak on this device. This can’t be undone.",
        {
            title: "Reset everything?",
            confirmLabel: "Yes, wipe it",
            cancelLabel: "Never mind",
            variant: 'danger',
            icon: 'bomb',
        }
    );
    if (!ok) return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    gameState = createDefaultGameState();
    recentShortPuzzles = [];
    lastSessionPoints = 0;
    saveGameState();
    updateHeaderScore();
    updateSolvedCountUI();
    updateAchievementsButton();
    updateDailyUI();
    showToast("Progress has been reset.");
}


function jumpToPuzzle(puzzleId) {
    // Active session: jump within the session list
    if (window.currentSessionPuzzles && window.currentSessionPuzzles.length) {
        if (sessionEnded) {
            showToast("This session is over.");
            return;
        }
        const index = window.currentSessionPuzzles.findIndex(p => p.id === puzzleId);
        if (index !== -1) loadPuzzle(index);
        return;
    }

    // From main menu (lifetime progress): open a 1-puzzle practice session
    const puzzle = puzzles.find(p => p.id === puzzleId);
    if (!puzzle) return;
    window.currentSessionPuzzles = [puzzle];
    selectedCategory = puzzle.category || "Practice";
    selectedNumQuestions = 1;
    sessionIsFullRun = false;
    currentGameMode = 'normal';
    sessionPointsEarned = 0;
    sessionRevealsUsed = 0;
    sessionExtraHintsUsed = 0;
    perfectSolvesThisSession = 0;
    sessionSolved = {};
    sessionPointsAwarded = {};
    sessionEnded = false;
    isSubmittingAnswer = false;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    updateHeaderScore(false);
    loadPuzzle(0);
}


// Helper for the "Play Again" button in the recap — quick re-entry loop
function replayLastSessionConfig() {
    const modal = document.getElementById('end-modal');
    if (modal) modal.remove();

    const cat = selectedCategory;
    const num = selectedNumQuestions;
    const mode = currentGameMode;

    finishSessionAndReturn();

    setTimeout(() => {
        if (cat && num != null && mode) {
            startSessionWithSettings(cat, num, mode);
        }
    }, 160);
}


function clearSuccessAdvanceHandler() {
    if (successAdvanceHandler) {
        document.removeEventListener('keydown', successAdvanceHandler);
        successAdvanceHandler = null;
    }
}

