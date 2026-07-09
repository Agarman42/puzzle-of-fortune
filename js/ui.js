/** UI rendering, modals, toasts */


function updateAchievementsButton() {
    const btnText = document.getElementById('achievements-btn-text');
    if (!btnText) return;

    const unlocked = Object.keys(gameState.achievements || {}).length;
    const total = achievements.length;
    btnText.textContent = `Achievements (${unlocked}/${total})`;
}


function updateHeaderScore(showLastSession = false) {
    const scoreEl = document.getElementById('header-score');
    const suffixEl = document.getElementById('header-score-suffix');
    if (!scoreEl) return;

    const onStartScreen = !document.getElementById('game-screen').classList.contains('hidden') === false; // rough check

    // After a short session on the main menu, show the session result prominently
    if (!window.currentSessionPuzzles && lastSessionPoints > 0) {
        scoreEl.textContent = `+${lastSessionPoints}`;
        scoreEl.style.color = '#4ade80'; // nice green to indicate "this run"
        if (suffixEl) {
            suffixEl.textContent = 'last run';
            suffixEl.className = 'text-xs text-emerald-400 ml-1';
        }
    } else {
        scoreEl.textContent = gameState.score;
        scoreEl.style.color = '';
        if (suffixEl) {
            suffixEl.textContent = '';
        }
    }
}


function showAchievementUnlock(ach) {
    // Remove any existing unlock banner first
    const existing = document.getElementById('achievement-unlock-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'achievement-unlock-banner';
    banner.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] max-w-sm w-[92%] sm:w-auto 
                        bg-slate-900 border border-emerald-700 rounded-3xl shadow-2xl shadow-black/50 
                        flex items-start gap-4 p-4 transition-all duration-300 scale-95 opacity-0`;

    banner.innerHTML = `
        <div class="text-4xl mt-0.5">${ach.icon}</div>
        <div class="flex-1 min-w-0">
            <div class="text-emerald-400 text-xs font-semibold tracking-[1.5px] uppercase mb-0.5">Achievement Unlocked</div>
            <div class="text-white font-semibold text-lg leading-tight">${ach.name}</div>
            <div class="text-slate-300 text-sm mt-1">${ach.desc}</div>
        </div>
        <button class="text-slate-400 hover:text-white text-xl leading-none mt-1" onclick="this.closest('#achievement-unlock-banner').remove()">×</button>
    `;

    document.body.appendChild(banner);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        banner.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        banner.style.transform = 'translate(-50%, 0)';
        banner.style.opacity = '1';
    });

    // Auto-dismiss after 5.5 seconds
    setTimeout(() => {
        if (banner && banner.parentNode) {
            banner.style.transition = 'all 0.35s ease';
            banner.style.opacity = '0';
            banner.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => {
                if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
            }, 350);
        }
    }, 5500);
}


function updateDailyUI() {
    const badge = document.getElementById('daily-streak-badge');
    const resetText = document.getElementById('daily-reset-text');
    if (!badge || !resetText) return;

    const today = getTodayDateString();
    const isCompletedToday = gameState.dailyLastDate === today;

    if (gameState.dailyCurrentStreak > 0) {
        badge.textContent = `${gameState.dailyCurrentStreak}🔥`;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }

    if (isCompletedToday) {
        resetText.textContent = "Come back tomorrow for a new daily!";
    } else {
        // Show a hint about today's category
        try {
            const daily = getDailyPuzzle();
            resetText.innerHTML = `Today's puzzle is from <span class="text-emerald-400">${escapeHtml(daily.category)}</span>`;
        } catch (e) {
            resetText.textContent = "";
        }
    }
}


function updatePotentialPointsUI() {
    const el = document.getElementById('potential-points');
    if (!el) return;

    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    if (!sessionPuzzles || currentPuzzleIndex < 0 || currentPuzzleIndex >= sessionPuzzles.length) {
        el.innerHTML = '';
        return;
    }

    const puzzle = sessionPuzzles[currentPuzzleIndex];
    const solvedThisSession = !!sessionSolved[puzzle.id];

    if (solvedThisSession) {
        el.innerHTML = `Done`;
        el.className = `text-[10px] px-2 py-px rounded-full bg-slate-700/60 text-slate-300 font-medium tabular-nums leading-none flex items-center`;
        return;
    }

    const potential = computePointsEarned(puzzle, currentRevealsUsed, extraHintUsed, fullRevealUsed);
    const isPerfect = !fullRevealUsed && (currentRevealsUsed === 0 && extraHintUsed === 0);
    el.innerHTML = fullRevealUsed 
        ? `Potential: <span class="font-bold">0</span>` 
        : `Potential: <span class="font-bold">${potential}</span>`;

    if (fullRevealUsed) {
        el.className = `text-[10px] px-2 py-px rounded-full bg-slate-700/60 text-slate-300 font-medium tabular-nums leading-none flex items-center`;
    } else if (isPerfect) {
        el.className = `text-[10px] px-2 py-px rounded-full bg-emerald-900/40 text-emerald-300 font-medium tabular-nums leading-none flex items-center`;
    } else {
        el.className = `text-[10px] px-2 py-px rounded-full bg-emerald-900/30 text-emerald-400 font-medium tabular-nums leading-none flex items-center`;
    }
}


function createPuzzleDisplay(puzzle) {
    const container = document.getElementById('puzzle-display');
    container.innerHTML = '';
    container.className = `puzzle-container rounded-3xl p-5 sm:p-6 min-h-[130px] flex flex-wrap items-center justify-center gap-x-1 gap-y-2`;

    const answer = puzzle.answer;

    const charData = [];
    let letterIndex = 0;

    for (let i = 0; i < answer.length; i++) {
        const raw = answer[i];
        if (raw === ' ') {
            charData.push({ type: 'space', char: ' ' });
        } else if (isAnswerLetter(raw)) {
            charData.push({
                type: 'letter',
                char: toTileChar(raw),
                index: letterIndex,
                revealed: currentRevealed.has(letterIndex)
            });
            letterIndex++;
        } else {
            charData.push({ type: 'punctuation', char: raw });
        }
    }

    let currentWordDiv = null;
    
    charData.forEach((item) => {
        if (item.type === 'space') {
            if (currentWordDiv) {
                container.appendChild(currentWordDiv);
                currentWordDiv = null;
            }
            const spacer = document.createElement('div');
            spacer.className = 'w-2';
            container.appendChild(spacer);
        } else {
            if (!currentWordDiv) {
                currentWordDiv = document.createElement('div');
                currentWordDiv.className = 'word-group flex';
                currentWordDiv.style.gap = '4px';
                currentWordDiv.style.marginRight = '8px';
            }
            
            if (item.type === 'punctuation') {
                const punct = document.createElement('span');
                punct.className = 'punctuation';
                punct.textContent = item.char;
                punct.style.marginLeft = '1px';
                punct.style.marginRight = '5px';
                punct.style.fontWeight = '700';
                punct.style.color = '#713f12';

                if (item.char === ',') {
                    punct.style.fontSize = '1.5rem';
                    punct.style.verticalAlign = 'baseline';
                    punct.style.position = 'relative';
                    punct.style.top = '15px';
                } else if (item.char === "'") {
                    punct.style.fontSize = '1.2rem';
                    punct.style.verticalAlign = 'super';
                    punct.style.lineHeight = '0.5';
                } else {
                    punct.style.fontSize = '1.2rem';
                    punct.style.verticalAlign = 'baseline';
                }
                currentWordDiv.appendChild(punct);
            } else if (item.revealed) {
                const tile = document.createElement('div');
                tile.className = `puzzle-tile revealed`;
                tile.textContent = item.char;
                tile.style.fontSize = (item.char === 'I' || item.char === '1') ? '1.5rem' : '1.4rem';
                currentWordDiv.appendChild(tile);
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.className = `puzzle-tile`;
                input.style.textAlign = 'center';
                input.style.caretColor = 'transparent';
                input.style.textTransform = 'uppercase';
                input.dataset.position = item.index;
                // Input handling (uppercase, advance, space block) is in setupInteractiveInputs
                currentWordDiv.appendChild(input);
            }
        }
    });
    
    if (currentWordDiv) {
        container.appendChild(currentWordDiv);
    }
    setupInteractiveInputs(container);
    return charData;
}


function setupInteractiveInputs(container) {
    const inputs = Array.from(container.querySelectorAll('input.puzzle-tile'));
    if (inputs.length === 0) return;
    setTimeout(() => {
        const firstEmpty = inputs.find(inp => !inp.value);
        if (firstEmpty && document.activeElement.tagName !== 'INPUT') firstEmpty.focus();
    }, 60);
    inputs.forEach((input, index) => {
        // Ensure click focuses and selects this specific tile (core UX request)
        input.addEventListener('click', () => {
            input.focus();
            input.select();
        });
        input.addEventListener('focus', () => {
            input.select();
        });

        // Strong prevention: block space characters from ever entering the tile
        input.addEventListener('beforeinput', (e) => {
            if (e.data === ' ') {
                e.preventDefault();
            }
        });

        input.addEventListener('input', (e) => {
            // Ignore spaces entirely - they should not advance or stay in the tile
            if (e.target.value === ' ' || e.target.value === '') {
                e.target.value = '';
                return;
            }
            // Keep a single uppercase character
            e.target.value = e.target.value.slice(-1).toUpperCase();
            if (e.target.value) {
                const nextInput = inputs[index + 1];
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        });
        input.addEventListener('keydown', (e) => {
            // Block spacebar while typing answers (prevents inserting spaces into single-letter tiles)
            // but allow it when the success modal is open (for the "press space to advance" feature)
            // Extra prevention for space key (covers some edge cases)
            if (e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32) {
                const successModal = document.getElementById('success-modal');
                const isSuccessOpen = successModal && successModal.classList.contains('flex');
                if (!isSuccessOpen) {
                    e.preventDefault();
                    return;
                }
            }

            if (e.key === 'Backspace' && !input.value && index > 0) {
                const prevInput = inputs[index - 1];
                if (prevInput) {
                    prevInput.focus();
                    prevInput.select();
                }
            }
            if (e.key === 'ArrowRight') {
                const nextInput = inputs[index + 1];
                if (nextInput) { e.preventDefault(); nextInput.focus(); nextInput.select(); }
            }
            if (e.key === 'ArrowLeft') {
                const prevInput = inputs[index - 1];
                if (prevInput) { e.preventDefault(); prevInput.focus(); prevInput.select(); }
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                submitAnswer();
            }
        });
    });
    // Use onclick (not addEventListener) so re-renders overwrite instead of stacking handlers
    container.onclick = (ev) => {
        if (ev.target.tagName === 'INPUT') return;
        const firstEmpty = inputs.find(inp => !inp.value);
        if (firstEmpty && document.activeElement.tagName !== 'INPUT') {
            firstEmpty.focus();
            firstEmpty.select();
        }
    };
}


function updateSolvedCountUI() {
    const count = getSolvedCount();
    const el = document.getElementById('solved-count');
    if (el) el.textContent = count;
}


function updateGameModeBadge() {
    const badge = document.getElementById('game-mode-badge');
    if (!badge) return;

    const mode = GAME_MODES[currentGameMode];
    if (!mode || currentGameMode === 'normal') {
        badge.classList.add('hidden');
        return;
    }

    badge.classList.remove('hidden');
    badge.textContent = mode.name;

    // Color coding by mode vibe
    badge.className = `text-[10px] px-2 py-px rounded-full font-semibold border `;
    if (currentGameMode === 'challenge') {
        badge.classList.add('bg-amber-900/40', 'text-amber-300', 'border-amber-800');
    } else if (currentGameMode === 'time_attack') {
        badge.classList.add('bg-red-900/40', 'text-red-300', 'border-red-800');
    } else if (currentGameMode === 'no_mistakes') {
        badge.classList.add('bg-violet-900/40', 'text-violet-300', 'border-violet-800');
    } else if (currentGameMode === 'marathon') {
        badge.classList.add('bg-sky-900/40', 'text-sky-300', 'border-sky-800');
    } else {
        badge.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
    }
}


function showSuccessModal(puzzle, pointsEarned = 0) {
    const modal = document.getElementById('success-modal');
    document.getElementById('success-answer').textContent = puzzle.answer;

    // Mode-aware title + light theming on the success popup
    const recap = getModeRecapInfo(currentGameMode);
    const titleEl = document.getElementById('success-title');
    if (titleEl) titleEl.textContent = recap.successTitle;

    // Apply mode accent via static class map (Tailwind cannot see dynamic class strings)
    const circle = document.getElementById('success-icon-circle');
    const iconEl = document.getElementById('success-icon');
    const pointsEl = document.getElementById('success-points');
    const accent = getAccentClasses(recap.accent || 'emerald');
    if (circle && iconEl) {
        circle.className = `mx-auto w-16 h-16 ${accent.iconBg} rounded-full flex items-center justify-center mb-4`;
        iconEl.className = `fa-solid fa-check-circle ${accent.iconColor} text-5xl`;
    }
    if (titleEl) {
        titleEl.className = `text-2xl font-bold ${accent.title}`;
    }
    if (pointsEl) {
        pointsEl.className = `mt-1 font-medium ${accent.points}`;
    }

    let pointsText;
    if (fullRevealUsed) {
        pointsText = `+0 points (full answer revealed)`;
    } else {
        pointsText = `+${pointsEarned} points`;
    }
    if (pointsEl) {
        pointsEl.textContent = `${pointsText} • ${getSolvedCount()} solved`;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    launchSimpleConfetti();

    // Update the success modal's Next button if this was the last puzzle
    const successNextBtn = document.getElementById('success-next-btn');
    if (successNextBtn) {
        const sessionPuzzles = window.currentSessionPuzzles || puzzles;
        const isLast = (currentPuzzleIndex + 1 >= sessionPuzzles.length);
        if (isLast) {
            successNextBtn.textContent = 'Finish Session';
        } else {
            successNextBtn.textContent = 'Next Puzzle';
        }
    }

    // Remove any leftover handler, then allow Space/Enter after a short delay
    // so the keypress that submitted does not also advance.
    clearSuccessAdvanceHandler();
    setTimeout(() => {
        // Modal may have been closed already
        if (!modal.classList.contains('flex')) return;
        successAdvanceHandler = (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                clearSuccessAdvanceHandler();
                hideSuccessModal();
                nextPuzzle();
            }
        };
        document.addEventListener('keydown', successAdvanceHandler);
    }, 150);
}


function hideSuccessModal() {
    clearSuccessAdvanceHandler();
    const modal = document.getElementById('success-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');

    // Refresh the in-game Next button state (important for last puzzle)
    updateNextButton();
}


function launchSimpleConfetti() {
    const colors = ['#c8102e', '#006341', '#f59e0b', '#ffffff'];
    for (let i = 0; i < 28; i++) {
        setTimeout(() => {
            const conf = document.createElement('div');
            conf.style.position = 'fixed';
            conf.style.left = Math.random() * 100 + 'vw';
            conf.style.top = '-10px';
            conf.style.width = '8px';
            conf.style.height = '8px';
            conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            conf.style.background = colors[Math.floor(Math.random() * colors.length)];
            conf.style.zIndex = '9999';
            conf.style.opacity = Math.random() + 0.6;
            conf.style.transition = 'transform 1.1s linear, opacity 1.1s linear';
            document.body.appendChild(conf);
            const angle = Math.random() * 60 + 30;
            const velocity = Math.random() * 80 + 120;
            setTimeout(() => {
                conf.style.transform = `translateY(${velocity}px) rotate(${angle * 3}deg)`;
                conf.style.opacity = '0';
            }, 50);
            setTimeout(() => conf.remove(), 1400);
        }, i * 4);
    }
}


function showProgressModal() {
    const hasActiveSession = !!window.currentSessionPuzzles;
    let displayPuzzles;

    if (hasActiveSession) {
        displayPuzzles = window.currentSessionPuzzles;
    } else {
        // No active session (user is on main menu) → show only permanently solved puzzles
        displayPuzzles = puzzles.filter(p => gameState.solved[p.id]);
    }

    let listHTML = '';

    if (displayPuzzles.length === 0) {
        listHTML = `<div class="p-4 text-center text-slate-400">No solved puzzles to show yet.</div>`;
    } else {
        displayPuzzles.forEach((p, idx) => {
            const solved = hasActiveSession 
                ? !!sessionSolved[p.id]
                : !!gameState.solved[p.id];

            const qShort = escapeHtml(p.question.substring(0, 55)) + (p.question.length > 55 ? '...' : '');
            listHTML += `
                <div onclick="jumpToPuzzle(${p.id}); document.getElementById('progress-modal').remove();" 
                     class="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-800 active:bg-slate-800 ${solved ? 'bg-emerald-900/20' : ''} min-h-[52px]">
                    <div>
                        <span class="font-mono text-sm">#${idx + 1} of ${displayPuzzles.length}</span> 
                        <span class="ml-2">${qShort}</span>
                    </div>
                    ${solved ? '<i class="fa-solid fa-check text-emerald-400"></i>' : ''}
                </div>
            `;
        });
    }

    const modalHTML = `
        <div id="progress-modal" onclick="document.getElementById('progress-modal').remove()" 
             class="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center">
            <div onclick="event.stopImmediatePropagation()" 
                 class="bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-700 max-h-[85vh] overflow-hidden flex flex-col">
                <div class="px-5 pt-5 pb-3 border-b border-slate-700 flex items-center justify-between">
                    <div>
                        <div class="font-bold text-xl">${hasActiveSession ? 'Current Session Progress' : 'Lifetime Progress'}</div>
                        <div class="text-emerald-400 text-sm">
                            ${hasActiveSession 
                                ? `${getSolvedCount()} / ${displayPuzzles.length} solved • ${gameState.score} pts`
                                : `${displayPuzzles.length} puzzles solved • ${gameState.score} pts`}
                        </div>
                    </div>
                    <button onclick="document.getElementById('progress-modal').remove()" class="text-2xl leading-none text-slate-400 hover:text-white px-2">&times;</button>
                </div>
                <div class="p-4 overflow-auto flex-1 space-y-1 text-sm">
                    ${listHTML}
                </div>
                <div class="p-4 border-t border-slate-700 bg-slate-950 flex gap-3">
                    <button onclick="shareScore(); document.getElementById('progress-modal').remove()" class="flex-1 py-3 text-sm font-semibold bg-white text-slate-900 rounded-2xl active:scale-[0.985] transition-all">Share Score</button>
                    <button onclick="resetProgress(); document.getElementById('progress-modal').remove()" class="px-5 py-3 text-sm font-medium text-red-400 hover:bg-red-950 active:bg-red-950 rounded-2xl border border-red-900/50 active:scale-[0.985] transition-all">Reset</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}


// ============================================================
// NEW: Game Setup Modal + helpers (clean hub + focused setup)
// ============================================================

function showGameSetupModal() {
    const setupModal = document.createElement('div');
    setupModal.className = `fixed inset-0 bg-black/70 z-[80] flex items-end sm:items-center justify-center p-4`;

    // Use last-used settings if available (persisted from previous sessions)
    const defaultCategory = gameState.lastCategory || "Mixed Bag";
    const defaultLength = (typeof gameState.lastNumQuestions === 'number') ? gameState.lastNumQuestions : 10;
    const defaultMode = gameState.lastGameMode || 'normal';

    let currentSetup = {
        category: defaultCategory,
        numQuestions: defaultLength,
        mode: defaultMode
    };

    const modeKeys = Object.keys(GAME_MODES);

    function renderModeButtons(container) {
        container.innerHTML = '';
        modeKeys.forEach(key => {
            const m = GAME_MODES[key];
            const isActive = key === currentSetup.mode;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `px-4 py-2.5 text-sm rounded-2xl border transition-all text-left flex-1 min-w-[110px] min-h-[56px] active:scale-[0.985] ${isActive 
                ? 'bg-orange-600 border-orange-500 text-white shadow' 
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 active:bg-slate-600 text-slate-200'}`;
            btn.innerHTML = `
                <div class="font-semibold">${m.name}</div>
                <div class="text-[10px] opacity-80 mt-0.5 leading-tight">${m.description.split('.')[0]}.</div>
            `;
            btn.addEventListener('click', () => {
                currentSetup.mode = key;
                renderModeButtons(container);
                updateSummary();
            });
            container.appendChild(btn);
        });
    }

    function renderCategoryGrid(container) {
        container.innerHTML = '';

        const cats = [
            { value: "Mixed Bag", label: "Mixed Bag", icon: "🎲", hint: "Random from all" },
            { value: "Christmas Classics", label: "Christmas Classics", icon: "🎄" },
            { value: "Holiday Movies & TV", label: "Holiday Movies & TV", icon: "📺" },
            { value: "Christmas Music & Songs", label: "Christmas Music", icon: "🎵" },
            { value: "Traditions & Fun Facts", label: "Traditions & Facts", icon: "❄️" },
            { value: "Famous Quotes & Lore", label: "Quotes & Lore", icon: "💬" },
            { value: "General Knowledge Trivia", label: "General Trivia", icon: "🧠" },
            { value: "Famous Movies", label: "Famous Movies", icon: "🎬" },
            { value: "Sports", label: "Sports", icon: "🏀" },
        ];

        cats.forEach(cat => {
            const isActive = cat.value === currentSetup.category;
            const card = document.createElement('button');
            card.type = 'button';

            // Mobile-friendly: good tap targets + press feedback
            card.className = `px-2.5 py-2.5 sm:py-2 sm:px-3 text-xs sm:text-sm rounded-2xl border transition-all text-left min-h-[52px] active:scale-[0.985] ${isActive 
                ? 'bg-orange-600 border-orange-500 text-white shadow ring-1 ring-orange-400' 
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 active:bg-slate-600 text-slate-200'}`;

            // Better layout for long labels like "Mixed Bag (Random)"
            if (cat.hint) {
                card.innerHTML = `
                    <div class="flex items-start gap-1.5">
                        <span class="text-base leading-none mt-0.5">${cat.icon}</span>
                        <div class="flex-1 min-w-0 leading-tight">
                            <div class="font-medium">${cat.label}</div>
                            <div class="text-[10px] opacity-75 -mt-0.5">${cat.hint}</div>
                        </div>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="flex items-center gap-1.5">
                        <span class="text-base">${cat.icon}</span>
                        <span class="font-medium">${cat.label}</span>
                    </div>
                `;
            }

            card.addEventListener('click', () => {
                currentSetup.category = cat.value;
                renderCategoryGrid(container);
                updateSummary();
            });
            container.appendChild(card);
        });
    }

    function updateSummary() {
        const sumEl = setupModal.querySelector('#setup-summary');
        if (!sumEl) return;
        const modeName = GAME_MODES[currentSetup.mode].name;
        const len = currentSetup.numQuestions === 999 ? 'All' : currentSetup.numQuestions;
        sumEl.textContent = `${len} puzzles • ${currentSetup.category} • ${modeName}`;
    }

    setupModal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-700 p-5 sm:p-6 max-h-[92vh] overflow-auto">
            <div class="flex justify-between items-center mb-3">
                <div class="font-bold text-2xl">New Session</div>
                <button class="text-3xl leading-none text-slate-400 hover:text-white" onclick="event.target.closest('.fixed').remove()">&times;</button>
            </div>

            <!-- Player name (compact) -->
            <div class="mb-3">
                <label class="block text-xs uppercase tracking-widest text-slate-400 mb-1">Player Name (optional)</label>
                <input id="setup-player-name" type="text" placeholder="Your name" value="${escapeHtml(gameState.playerName || '')}"
                       class="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-red-500">
            </div>

            <!-- Category -->
            <div class="mb-3">
                <label class="block text-xs uppercase tracking-widest text-slate-400 mb-1.5">Category</label>
                <div id="setup-category-grid" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <!-- Populated dynamically as nice visual cards -->
                </div>
            </div>

            <!-- Length -->
            <div class="mb-3">
                <label class="block text-xs uppercase tracking-widest text-slate-400 mb-1">How Many Questions?</label>
                <div id="setup-length-buttons" class="flex flex-wrap gap-2">
                    <!-- Populated by JS below for nice active styling -->
                </div>
            </div>

            <!-- Game Modes (rich cards) -->
            <div class="mb-3">
                <label class="block text-xs uppercase tracking-widest text-slate-400 mb-1">Game Mode</label>
                <div id="setup-mode-buttons" class="flex flex-wrap gap-2">
                    <!-- Populated dynamically -->
                </div>
                <div class="text-[10px] text-slate-400 mt-1 min-h-[14px]" id="setup-mode-hint"></div>
            </div>

            <!-- Live summary -->
            <div class="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm mb-4">
                <div class="text-slate-400 text-xs">You'll play</div>
                <div id="setup-summary" class="font-semibold text-emerald-300"></div>
            </div>

            <div class="flex flex-col gap-3">
                <button id="setup-launch-btn"
                        class="w-full py-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-3xl flex items-center justify-center gap-x-2 text-lg transition-all">
                    <i class="fa-solid fa-play"></i>
                    <span>Launch Session</span>
                </button>
                <button onclick="event.target.closest('.fixed').remove()" 
                        class="w-full py-3 text-sm text-slate-400 hover:text-white active:text-white transition-colors min-h-[44px]">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(setupModal);

    // Robust backdrop close handler (only closes if clicking the dark overlay itself)
    setupModal.addEventListener('click', (e) => {
        if (e.target === setupModal) {
            setupModal.remove();
        }
    });

    // Post-insert wiring
    const lengthContainer = setupModal.querySelector('#setup-length-buttons');
    const modeContainer = setupModal.querySelector('#setup-mode-buttons');
    const categoryGrid = setupModal.querySelector('#setup-category-grid');
    const summaryEl = setupModal.querySelector('#setup-summary');
    const launchBtn = setupModal.querySelector('#setup-launch-btn');

    // Length buttons (recreated for the modal)
    const lengths = [5,10,20,40,60,80,999];
    lengths.forEach(len => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = len === 999 ? 'All' : len;
        b.className = `px-4 py-2.5 sm:py-2 text-sm font-medium rounded-2xl border transition-all min-h-[44px] flex items-center justify-center active:scale-[0.985] ${len === currentSetup.numQuestions 
            ? 'bg-red-600 border-red-500 text-white' 
            : 'bg-slate-800 border-slate-700 hover:bg-slate-700 active:bg-slate-600 text-slate-200'}`;
        b.addEventListener('click', () => {
            currentSetup.numQuestions = len;
            // re-highlight
            lengthContainer.querySelectorAll('button').forEach(bb => {
                bb.classList.remove('bg-red-600', 'border-red-500', 'text-white');
                bb.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-200');
            });
            b.classList.remove('bg-slate-800', 'border-slate-700', 'text-slate-200');
            b.classList.add('bg-red-600', 'border-red-500', 'text-white');
            updateSummary();
        });
        lengthContainer.appendChild(b);
    });

    // Modes
    renderModeButtons(modeContainer);

    // Category grid (visual cards instead of select)
    renderCategoryGrid(categoryGrid);

    // Initial summary
    updateSummary();

    // Launch
    launchBtn.addEventListener('click', async () => {
        const nameInput = setupModal.querySelector('#setup-player-name');
        if (nameInput) {
            gameState.playerName = nameInput.value.trim() || "Player";
        }

        const chosenCategory = currentSetup.category;
        const chosenNum = currentSetup.numQuestions;
        const chosenMode = currentSetup.mode;

        const modeInfo = GAME_MODES[chosenMode];
        if (chosenMode !== 'normal') {
            const details = [
                modeInfo.description,
                '',
                `Point multiplier: ${modeInfo.pointMultiplier}×`,
                modeInfo.allowReveal ? null : '• Reveal Letter is disabled',
                modeInfo.allowExtraHint ? null : '• Extra Hint is disabled',
                modeInfo.wrongAnswerClearsPuzzle ? '• Wrong answers clear the whole puzzle' : null,
                modeInfo.endOnMistake ? '• One mistake ends the session' : null,
                '',
                'Start this mode?',
            ].filter((line) => line != null).join('\n');

            const ok = await showConfirm(details, {
                title: `${modeInfo.name} mode`,
                confirmLabel: 'Let’s go',
                cancelLabel: 'Back',
                variant: 'mode',
                icon: chosenMode === 'time_attack' ? 'stopwatch'
                    : chosenMode === 'challenge' ? 'bolt'
                    : chosenMode === 'no_mistakes' ? 'shield-halved'
                    : chosenMode === 'marathon' ? 'person-running'
                    : 'gamepad',
            });
            if (!ok) return;
        }

        setupModal.remove();
        startSessionWithSettings(chosenCategory, chosenNum, chosenMode);
    });
}


function showHowToPlay() {
    const modal = document.createElement('div');
    modal.className = `fixed inset-0 bg-black/70 z-[70] flex items-end sm:items-center justify-center p-4`;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.innerHTML = `
        <div class="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-700 p-5 sm:p-6 text-sm max-h-[85vh] overflow-auto">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="font-bold text-2xl">How to Play</div>
                    <div class="text-xs text-slate-400">Phrase puzzle • Score points • Save progress</div>
                </div>
                <button class="text-3xl leading-none text-slate-400" onclick="event.target.closest('.fixed').remove()">&times;</button>
            </div>

            <div class="space-y-4">
                <div>
                    <div class="font-semibold text-emerald-300 mb-1">1. Start a Session</div>
                    <div class="text-slate-300">Click <strong>New Session</strong> to pick a category, number of puzzles (5–80 or All), and game mode. Short sessions prefer puzzles you have not seen recently.</div>
                </div>

                <div>
                    <div class="font-semibold text-emerald-300 mb-1">2. Solve the Phrase</div>
                    <div class="text-slate-300">Read the clue, then type your answer into the tiles. Click any tile to focus it. Press <span class="font-semibold">Submit</span> or hit Enter. Matching is flexible: accents, leading <em>The</em>/<em>A</em>, and many “X or Y” answers are accepted.</div>
                </div>

                <div>
                    <div class="font-semibold text-emerald-300 mb-1">3. Help When Stuck</div>
                    <div class="text-slate-300 space-y-1">
                        <div>• <strong>Reveal a Letter</strong> — Shows every occurrence of a smart letter. <span class="text-amber-400 font-medium">-1 point</span></div>
                        <div>• <strong>Extra Hint</strong> — One-time clue when available. <span class="text-amber-400 font-medium">-2 points</span></div>
                        <div>• <strong>Reveal Full Answer</strong> — Shows the whole answer for <span class="text-amber-400 font-medium">0 points</span>.</div>
                    </div>
                </div>

                <div>
                    <div class="font-semibold text-emerald-300 mb-1">4. Scoring</div>
                    <div class="text-slate-300">
                        Base points: <span class="font-mono text-emerald-400">Easy 8 • Medium 10 • Hard 12</span>.
                        Reveals cost 1, extra hints cost 2. Mode multipliers apply (Challenge 1.5×, No Mistakes 2×). Minimum 4 points before multipliers unless fully revealed (0).
                    </div>
                </div>

                <div>
                    <div class="font-semibold text-emerald-300 mb-1">5. Game Modes</div>
                    <div class="text-slate-300 space-y-1 text-xs sm:text-sm">
                        <div>• <strong>Normal</strong> — Wrong answers freeze correct letters in place.</div>
                        <div>• <strong>Challenge</strong> — No helps; wrong answer clears the puzzle (+50% points).</div>
                        <div>• <strong>Time Attack</strong> — 60 seconds per puzzle.</div>
                        <div>• <strong>No Mistakes</strong> — One wrong answer ends the session (2× points).</div>
                        <div>• <strong>Marathon</strong> — Keep going until you miss once.</div>
                    </div>
                </div>

                <div class="text-xs text-slate-400 pt-1 border-t border-slate-700">
                    Progress, score, and achievements are saved automatically in this browser.
                </div>
            </div>

            <button onclick="event.target.closest('.fixed').remove()" class="mt-5 w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-[0.985] rounded-2xl text-sm font-medium transition-all">Got it!</button>
        </div>
    `;
    document.body.appendChild(modal);
}


function showAchievementsModal() {
    const modal = document.createElement('div');
    modal.className = `fixed inset-0 bg-black/70 z-[70] flex items-end sm:items-center justify-center p-4`;

    const unlockedCount = Object.keys(gameState.achievements).length;
    const total = achievements.length;
    const progressPercent = Math.round((unlockedCount / total) * 100);

    // Group by tier
    const grouped = {
        Bronze: achievements.filter(a => a.tier === "Bronze"),
        Silver: achievements.filter(a => a.tier === "Silver"),
        Gold:   achievements.filter(a => a.tier === "Gold"),
    };

    let html = `
        <div onclick="event.target.remove()" class="w-full sm:max-w-lg bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-700 p-5 sm:p-6 max-h-[85vh] flex flex-col">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <div class="font-bold text-2xl">Achievements</div>
                    <div class="text-sm text-slate-400 mt-0.5">
                        ${unlockedCount} / ${total} unlocked <span class="text-emerald-400">(${progressPercent}%)</span>
                    </div>
                </div>
                <button class="text-3xl leading-none text-slate-400" onclick="event.target.closest('.fixed').remove()">&times;</button>
            </div>

            <!-- Progress bar -->
            <div class="h-2 bg-slate-800 rounded-full mb-5 overflow-hidden">
                <div class="h-2 bg-emerald-500 transition-all" style="width: ${progressPercent}%"></div>
            </div>

            <div class="max-h-[420px] overflow-auto pr-1 space-y-5 text-sm">
    `;

    // Render each tier
    const tierOrder = ["Bronze", "Silver", "Gold"];
    tierOrder.forEach(tier => {
        const items = grouped[tier];
        if (!items || items.length === 0) return;

        html += `<div class="mb-1"><div class="text-xs uppercase tracking-widest text-slate-400 mb-2">${tier}</div>`;

        items.forEach(ach => {
            const unlocked = isAchievementUnlocked(ach.id);
            const progress = !unlocked ? getAchievementProgress(ach) : null;

            let progressHTML = '';
            if (progress && progress.target > 1) {
                const pct = Math.min(Math.round((progress.current / progress.target) * 100), 100);
                progressHTML = `
                    <div class="mt-1.5">
                        <div class="flex justify-between text-[10px] text-slate-400 mb-0.5">
                            <span>${progress.current} / ${progress.target}</span>
                            <span>${pct}%</span>
                        </div>
                        <div class="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div class="h-1.5 bg-emerald-600 transition-all" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }

            html += `
                <div class="flex items-start gap-3 p-3 mb-2 rounded-2xl border ${unlocked ? 'bg-emerald-900/10 border-emerald-800' : 'bg-slate-800/70 border-slate-700'}">
                    <div class="text-2xl mt-0.5">${ach.icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold ${unlocked ? 'text-emerald-300' : 'text-slate-200'}">${ach.name}</div>
                        <div class="text-xs text-slate-400 mt-0.5">${ach.desc}</div>
                        ${progressHTML}
                    </div>
                    <div class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${unlocked ? 'bg-emerald-800 text-emerald-300' : 'bg-slate-700 text-slate-400'}">
                        ${unlocked ? 'Unlocked' : tier}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += `
            </div>

            <button onclick="event.target.closest('.fixed').remove()" 
                    class="mt-5 w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 rounded-2xl text-sm font-medium transition-colors">
                Close
            </button>
        </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);
}


function createCategoryBarsHTML(categoryStats) {
    if (!categoryStats || Object.keys(categoryStats).length === 0) {
        return '<div class="text-slate-400 text-xs py-2">No data yet</div>';
    }

    return Object.keys(categoryStats).map(cat => {
        const s = categoryStats[cat];
        const pct = s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0;
        const barWidth = Math.max(pct, 4); // minimum visible bar

        return `
            <div>
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-slate-300">${cat}</span>
                    <span class="font-mono text-slate-400">${s.solved}/${s.total} <span class="text-emerald-400">(${pct}%)</span></span>
                </div>
                <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-2 bg-emerald-500 rounded-full transition-all" style="width: ${barWidth}%"></div>
                </div>
            </div>
        `;
    }).join('');
}


function createModeStatsHTML() {
    const modes = [
        { key: 'normal',      name: 'Normal',      icon: 'fa-play',         multiplier: '1×',   color: 'emerald' },
        { key: 'challenge',   name: 'Challenge',   icon: 'fa-bolt',         multiplier: '1.5×', color: 'rose' },
        { key: 'time_attack', name: 'Time Attack', icon: 'fa-stopwatch',    multiplier: '1×',   color: 'amber' },
        { key: 'no_mistakes', name: 'No Mistakes', icon: 'fa-shield-halved',multiplier: '2×',   color: 'cyan' },
        { key: 'marathon',    name: 'Marathon',    icon: 'fa-person-running',multiplier: '1×',  color: 'violet' },
    ];

    return modes.map(m => {
        const runs = gameState[`${m.key}RunsCompleted`] || 0;
        const best = gameState[`${m.key}BestScore`] || 0;
        const perfectRuns = gameState[`${m.key}PerfectRuns`] || 0;
        const totalPoints = gameState[`${m.key}TotalPoints`] || 0;
        const avgPoints = runs > 0 ? Math.round(totalPoints / runs) : 0;
        const isEmpty = runs === 0;
        const ac = getAccentClasses(m.color);

        if (isEmpty) {
            return `
                <div class="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/70 flex flex-col items-center justify-center text-center opacity-70">
                    <i class="fa-solid ${m.icon} text-lg text-slate-500 mb-1"></i>
                    <div class="font-medium text-sm">${m.name}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">No runs yet</div>
                </div>
            `;
        }

        return `
            <div class="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-2xl ${ac.iconBg} flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid ${m.icon} ${ac.iconColor}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline justify-between">
                            <div class="font-semibold">${m.name}</div>
                            <div class="text-[10px] ${ac.text} font-medium">${m.multiplier}</div>
                        </div>
                        <div class="flex items-baseline justify-between mt-0.5">
                            <div class="text-2xl font-semibold tabular-nums leading-none">${runs}</div>
                            <div class="text-[10px] text-slate-400">runs</div>
                        </div>
                    </div>
                </div>

                <div class="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center text-xs">
                    <div>
                        ${perfectRuns > 0 ? `<span class="text-emerald-400 font-medium">${perfectRuns} perfect</span>` : ''}
                    </div>
                    <div class="text-right">
                        <span class="font-mono text-emerald-400">${best}</span>
                        <span class="text-slate-400"> best</span>
                    </div>
                </div>

                ${avgPoints > 0 ? `
                <div class="mt-1.5 text-[10px] text-slate-400 flex justify-between">
                    <span>Avg / run</span>
                    <span class="font-mono text-emerald-400">${avgPoints} pts</span>
                </div>` : ''}
            </div>
        `;
    }).join('');
}


function showStatsDashboard() {
    const modal = document.createElement('div');
    modal.className = `fixed inset-0 bg-black/70 z-[70] flex items-end sm:items-center justify-center p-4`;

    const totalSolved = getLifetimeSolvedCount();
    const avgPoints = totalSolved > 0 ? Math.round(gameState.score / totalSolved) : 0;
    const perfectPercent = totalSolved > 0 ? Math.round((gameState.totalPerfectSolves / totalSolved) * 100) : 0;

    // Efficiency metrics
    const totalHelps = (gameState.lifetimeRevealsUsed || 0) + (gameState.lifetimeExtraHintsUsed || 0);
    const helpFreeRate = totalSolved > 0 ? Math.min(100, Math.round(((gameState.totalPerfectSolves || 0) / totalSolved) * 100)) : 0;
    const avgHelpsPerPuzzle = totalSolved > 0 ? (totalHelps / totalSolved).toFixed(1) : '0.0';

    // Category breakdown
    const categoryStats = {};
    puzzles.forEach(p => {
        if (!categoryStats[p.category]) categoryStats[p.category] = { solved: 0, total: 0 };
        categoryStats[p.category].total++;
        if (gameState.solved[p.id]) categoryStats[p.category].solved++;
    });

    let categoryHTML = Object.keys(categoryStats).map(cat => {
        const s = categoryStats[cat];
        const pct = s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0;
        return `
            <div class="flex justify-between text-sm py-1 border-b border-slate-700 last:border-none">
                <span>${escapeHtml(cat)}</span>
                <span class="font-mono">${s.solved}/${s.total} <span class="text-emerald-400">(${pct}%)</span></span>
            </div>
        `;
    }).join('');

    // Efficiency
    const avgReveals = totalSolved > 0 ? (gameState.lifetimeRevealsUsed / totalSolved).toFixed(1) : '0.0';
    const avgHints = totalSolved > 0 ? (gameState.lifetimeExtraHintsUsed / totalSolved).toFixed(1) : '0.0';

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.innerHTML = `
        <div class="w-full sm:max-w-2xl bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-700 p-5 sm:p-6 max-h-[88vh] flex flex-col overflow-hidden">
            <div class="flex justify-between items-center mb-4 sm:mb-6 sticky top-0 bg-slate-900 pb-3 sm:pb-4 border-b border-slate-700 z-10">
                <div>
                    <div class="font-bold text-xl sm:text-2xl">Statistics</div>
                    <div class="text-xs text-emerald-400">Track your progress across all modes</div>
                </div>
                <button class="text-3xl text-slate-400 hover:text-white" onclick="event.target.closest('.fixed').remove()">&times;</button>
            </div>

            <div class="flex-1 overflow-auto space-y-6 sm:space-y-8 pr-1">

            <!-- Lifetime -->
            <div class="mb-6 sm:mb-8">
                <div class="uppercase text-xs tracking-[1.5px] text-slate-400 mb-3">Lifetime</div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <i class="fa-solid fa-check-double text-emerald-400"></i>
                            <span>Puzzles Solved</span>
                        </div>
                        <div class="text-3xl font-semibold mt-1.5 tabular-nums">${totalSolved}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <i class="fa-solid fa-star text-amber-400"></i>
                            <span>Total Points</span>
                        </div>
                        <div class="text-3xl font-semibold mt-1.5 tabular-nums">${gameState.score}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <i class="fa-solid fa-chart-line text-emerald-400"></i>
                            <span>Avg / Puzzle</span>
                        </div>
                        <div class="text-3xl font-semibold mt-1.5 tabular-nums">${avgPoints}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <i class="fa-solid fa-trophy text-yellow-400"></i>
                            <span>Perfect Solves</span>
                        </div>
                        <div class="text-3xl font-semibold mt-1.5 tabular-nums">${gameState.totalPerfectSolves} <span class="text-base text-emerald-400">(${perfectPercent}%)</span></div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <i class="fa-solid fa-eye text-amber-400"></i>
                            <span>Avg Reveals</span>
                        </div>
                        <div class="text-3xl font-semibold mt-1.5 tabular-nums">${avgReveals}</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <i class="fa-solid fa-lightbulb text-amber-400"></i>
                            <span>Avg Hints</span>
                        </div>
                        <div class="text-3xl font-semibold mt-1.5 tabular-nums">${avgHints}</div>
                    </div>
                </div>
            </div>

            <!-- Efficiency & Quality (new in Stats 2.0) -->
            <div class="mb-6 sm:mb-8">
                <div class="uppercase text-xs tracking-[1.5px] text-slate-400 mb-3">Efficiency & Quality</div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div class="bg-slate-800 p-4 rounded-2xl">
                        <div class="text-xs text-slate-400">Help-Free Rate</div>
                        <div class="text-3xl font-semibold mt-1 text-emerald-400">${helpFreeRate}<span class="text-base">%</span></div>
                        <div class="text-[10px] text-slate-500 mt-1">Puzzles solved with 0 reveals</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl">
                        <div class="text-xs text-slate-400">Avg Helps / Puzzle</div>
                        <div class="text-3xl font-semibold mt-1">${avgHelpsPerPuzzle}</div>
                        <div class="text-[10px] text-slate-500 mt-1">Lower is better</div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl">
                        <div class="text-xs text-slate-400">Perfect Solves</div>
                        <div class="text-3xl font-semibold mt-1">${gameState.totalPerfectSolves} <span class="text-base text-emerald-400">(${perfectPercent}%)</span></div>
                    </div>
                </div>
            </div>

            <!-- By Game Mode (new in Stats 2.0) -->
            <div class="mb-6 sm:mb-8">
                <div class="uppercase text-xs tracking-[1.5px] text-slate-400 mb-3">By Game Mode</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${createModeStatsHTML()}
                </div>
            </div>

            <!-- Streaks -->
            <div class="mb-6 sm:mb-8">
                <div class="uppercase text-xs tracking-[1.5px] text-slate-400 mb-3">Daily Streaks</div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center gap-3">
                        <div class="text-3xl">🔥</div>
                        <div>
                            <div class="text-xs text-emerald-400">Current Streak</div>
                            <div class="text-3xl font-bold tabular-nums">${gameState.dailyCurrentStreak || 0} <span class="text-base font-normal">days</span></div>
                        </div>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center gap-3">
                        <div class="text-3xl">🏆</div>
                        <div>
                            <div class="text-xs text-amber-400">Longest Streak</div>
                            <div class="text-3xl font-bold tabular-nums">${gameState.dailyLongestStreak || 0} <span class="text-base font-normal">days</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- By Category (visual bars) -->
            <div class="mb-6 sm:mb-8">
                <div class="uppercase text-xs tracking-[1.5px] text-slate-400 mb-3">By Category</div>
                <div class="bg-slate-800 rounded-2xl p-4 text-sm space-y-2.5">
                    ${createCategoryBarsHTML(categoryStats)}
                </div>
            </div>

            <!-- Overall Activity Summary -->
            <div>
                <div class="uppercase text-xs tracking-[1.5px] text-slate-400 mb-3">Overall Activity</div>
                <div class="bg-slate-800 rounded-2xl p-4 border border-slate-700 text-sm text-slate-300">
                    You're building a strong collection of runs across multiple modes. Keep playing to unlock deeper insights here.
                </div>
            </div>

            </div>

            <button onclick="event.target.closest('.fixed').remove()" 
                    class="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-2xl text-sm font-medium active:scale-[0.985] transition-all">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(modal);
}


function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm z-[999]`;
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'all 0.2s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
    }, duration);
}

/**
 * In-app dialogs — polished confirms/alerts with icons, glow, and motion.
 * Returns a Promise. Only one dialog layer is shown at a time.
 *
 * options.variant: 'danger' | 'warning' | 'mode' | 'info' | 'default'
 * options.icon: Font Awesome icon class suffix, e.g. 'triangle-exclamation'
 */
function closeAppDialog(immediate = true) {
    const existing = document.getElementById('app-dialog');
    if (!existing) return Promise.resolve();
    if (immediate) {
        existing.remove();
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        existing.classList.add('is-leaving');
        setTimeout(() => {
            existing.remove();
            resolve();
        }, 180);
    });
}

function resolveDialogVariant({ variant, danger, icon } = {}) {
    if (variant) return variant;
    if (danger) return 'danger';
    return 'default';
}

function resolveDialogIcon(variant, icon) {
    if (icon) return icon;
    switch (variant) {
        case 'danger': return 'triangle-exclamation';
        case 'warning': return 'eye';
        case 'mode': return 'bolt';
        case 'info': return 'circle-info';
        default: return 'puzzle-piece';
    }
}

function showAppDialog({
    title = '',
    message = '',
    confirmLabel = 'OK',
    cancelLabel = null,
    danger = false,
    variant = null,
    icon = null,
} = {}) {
    return new Promise((resolve) => {
        // Replace any open dialog immediately
        const prev = document.getElementById('app-dialog');
        if (prev) prev.remove();

        const theme = resolveDialogVariant({ variant, danger });
        const iconName = resolveDialogIcon(theme, icon);
        let settled = false;

        const overlay = document.createElement('div');
        overlay.id = 'app-dialog';
        overlay.className = 'app-dialog-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        if (title) overlay.setAttribute('aria-labelledby', 'app-dialog-title');

        const card = document.createElement('div');
        card.className = 'app-dialog-card';
        card.dataset.variant = theme;

        const inner = document.createElement('div');
        inner.className = 'app-dialog-inner';

        // Icon badge
        const iconWrap = document.createElement('div');
        iconWrap.className = 'app-dialog-icon-wrap';
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.innerHTML = `<i class="fa-solid fa-${iconName}"></i>`;
        inner.appendChild(iconWrap);

        if (title) {
            const h = document.createElement('div');
            h.id = 'app-dialog-title';
            h.className = 'app-dialog-title';
            h.textContent = title;
            inner.appendChild(h);
        }

        if (message) {
            const body = document.createElement('div');
            body.className = 'app-dialog-message';
            body.textContent = message;
            inner.appendChild(body);
        }

        const actions = document.createElement('div');
        actions.className = 'app-dialog-actions';

        const finish = (value) => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKey);
            overlay.classList.add('is-leaving');
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 180);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(cancelLabel != null ? false : true);
            } else if (e.key === 'Enter' && !e.shiftKey) {
                // Don't steal Enter from focused cancel if tabbed there
                if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.dialogCancel === '1') {
                    return;
                }
                e.preventDefault();
                finish(true);
            }
        };
        document.addEventListener('keydown', onKey);

        if (cancelLabel != null) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.dataset.dialogCancel = '1';
            cancelBtn.className = 'app-dialog-btn app-dialog-btn-cancel';
            cancelBtn.textContent = cancelLabel;
            cancelBtn.addEventListener('click', () => finish(false));
            actions.appendChild(cancelBtn);
        }

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'app-dialog-btn app-dialog-btn-primary' + (theme === 'danger' || danger ? ' app-dialog-btn-danger' : '');
        // Primary label with subtle icon
        const okIcon = theme === 'danger' ? 'fa-trash' : theme === 'mode' ? 'fa-play' : theme === 'warning' ? 'fa-eye' : 'fa-check';
        okBtn.innerHTML = `<i class="fa-solid ${okIcon} text-xs opacity-90 mr-1.5"></i><span></span>`;
        okBtn.querySelector('span').textContent = confirmLabel;
        okBtn.addEventListener('click', () => finish(true));
        actions.appendChild(okBtn);

        inner.appendChild(actions);
        card.appendChild(inner);
        overlay.appendChild(card);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) finish(cancelLabel != null ? false : true);
        });

        document.body.appendChild(overlay);
        setTimeout(() => okBtn.focus(), 40);
    });
}

function showAlert(message, options = {}) {
    return showAppDialog({
        title: options.title || '',
        message,
        confirmLabel: options.confirmLabel || 'Got it',
        cancelLabel: null,
        danger: !!options.danger,
        variant: options.variant || (options.danger ? 'danger' : 'info'),
        icon: options.icon || null,
    });
}

function showConfirm(message, options = {}) {
    return showAppDialog({
        title: options.title || 'Please confirm',
        message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        danger: !!options.danger,
        variant: options.variant || (options.danger ? 'danger' : 'default'),
        icon: options.icon || null,
    });
}


function shareScore() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const solved = getSolvedCount();
    const total = sessionPuzzles.length;
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
    const category = selectedCategory || "a session";
    const modeKey = currentGameMode || 'normal';
    const recap = getModeRecapInfo(modeKey);
    const modeLabel = recap.shortName || 'Session';
    const tier = getPerformanceTier(solved, total, perfectSolvesThisSession, sessionRevealsUsed, sessionExtraHintsUsed, modeKey);

    let perfLine = '';
    if (perfectSolvesThisSession > 0) {
        perfLine = `\n👑 ${perfectSolvesThisSession} perfect solve${perfectSolvesThisSession > 1 ? 's' : ''}`;
    }
    if (tier.crown && perfectSolvesThisSession === solved) {
        perfLine = `\n👑 PERFECT RUN — no helps!`;
    }

    const text = 
`🧩 ${modeLabel} Run Complete!
+${sessionPointsEarned} points • ${solved}/${total} solved (${percent}%)${perfLine}
${tier.tier} — ${tier.flavor}

Play Puzzle of Fortune!`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Run copied to clipboard! 📋");
        }).catch(() => {
            fallbackShare(text);
        });
    } else {
        fallbackShare(text);
    }
}


function fallbackShare(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand("copy");
        showToast("Run copied to clipboard! 📋");
    } catch (e) {
        prompt("Copy your run:", text);
    }
    document.body.removeChild(textarea);
}


function showEndOfListModal() {
    stopTimeAttackTimer();
    const alreadyEnded = sessionEnded;
    sessionEnded = true;
    isSubmittingAnswer = false;

    // Avoid stacking multiple end modals
    const existingEnd = document.getElementById('end-modal');
    if (existingEnd) existingEnd.remove();
    const existingDaily = document.getElementById('daily-complete-modal');
    if (existingDaily) existingDaily.remove();

    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const solved = getSolvedCount();
    const total = sessionPuzzles.length;
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0;

    const isMixed = selectedCategory === "Mixed Bag";
    // Only count once per session end (re-opening the recap must not re-increment)
    if (isMixed && !alreadyEnded) {
        gameState.mixedSessionsCompleted = (gameState.mixedSessionsCompleted || 0) + 1;
        saveGameState();
    }

    // Daily Puzzle completion handling
    const isDaily = selectedCategory === "Daily Puzzle";
    if (isDaily) {
        const today = getTodayDateString();
        // Only award streak the first time we close out today's daily this session
        if (gameState.dailyLastDate !== today) {
            const yesterday = (() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            })();

            if (gameState.dailyLastDate === yesterday) {
                gameState.dailyCurrentStreak = (gameState.dailyCurrentStreak || 0) + 1;
            } else {
                gameState.dailyCurrentStreak = 1;
            }

            if (gameState.dailyCurrentStreak > (gameState.dailyLongestStreak || 0)) {
                gameState.dailyLongestStreak = gameState.dailyCurrentStreak;
            }

            gameState.dailyLastDate = today;
            saveGameState();
            updateDailyUI();
        }

        showDailyCompleteModal();
        return;
    }

    checkAndUnlockAchievements({
        isMixed: isMixed,
        sessionSolved: solved,
        sessionPerfects: perfectSolvesThisSession,
        totalRevealsUsed: sessionRevealsUsed
    });

    const modal = document.createElement("div");
    modal.id = "end-modal";
    modal.className = `fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4`;

    const recapInfo = getModeRecapInfo(currentGameMode);
    const modeSubtitle = recapInfo.endSubtitle(solved, total, percent);
    const tier = getPerformanceTier(solved, total, perfectSolvesThisSession, sessionRevealsUsed, sessionExtraHintsUsed, currentGameMode);
    const accent = getAccentClasses(recapInfo.accent || 'emerald');
    const icon = recapInfo.icon || 'fa-solid fa-trophy';
    const modeName = recapInfo.shortName || 'Session';

    const iconBg = accent.iconBg;
    const iconColor = accent.iconColor;
    const accentText = accent.text;
    const accentBorder = accent.border;

    const sessionLabel = `${total} ${selectedCategory || 'puzzles'} • ${modeName}`;

    modal.innerHTML = `
        <div onclick="event.stopImmediatePropagation()" 
             class="bg-slate-900 w-full max-w-md rounded-3xl border ${accentBorder} overflow-hidden shadow-2xl">
            
            <!-- Themed header -->
            <div class="px-6 pt-6 pb-4 text-center">
                <div class="mx-auto w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mb-3 ring-1 ring-white/5">
                    <i class="${icon} text-3xl ${iconColor}"></i>
                </div>
                <div class="flex items-center justify-center gap-x-2 mb-1">
                    <div class="text-2xl font-bold">${recapInfo.endTitle}</div>
                    <span class="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-800 border border-slate-700 text-slate-400">${modeName}</span>
                </div>
                <div class="${accentText} text-sm font-medium">${modeSubtitle}</div>
            </div>

            <!-- Big points + tier -->
            <div class="px-6 py-4 bg-slate-950 border-y border-slate-700 text-center">
                <div class="text-xs uppercase tracking-[1px] text-slate-500 mb-1">POINTS THIS SESSION</div>
                <div class="font-mono text-5xl font-bold tracking-tighter text-white">+${sessionPointsEarned}</div>
                
                <div class="mt-3 inline-flex items-center gap-x-2 px-3 py-1 rounded-2xl bg-slate-900 border border-slate-700">
                    <span class="font-semibold ${tier.tierClass} text-sm tracking-wide">${tier.tier}</span>
                    ${tier.crown ? '<span class="text-base">👑</span>' : ''}
                </div>
                ${tier.flavor ? `<div class="text-xs text-slate-400 mt-1.5">${tier.flavor}</div>` : ''}
            </div>

            <!-- Context line -->
            <div class="px-6 pt-3 pb-1 text-center">
                <div class="text-[11px] text-slate-500">${sessionLabel}</div>
            </div>

            <!-- Stats grid -->
            <div class="px-6 py-4 bg-slate-950 border-y border-slate-700">
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                        <div class="text-slate-400 text-xs mb-0.5">SOLVED</div>
                        <div class="font-semibold text-lg">${solved} <span class="text-slate-400">/ ${total}</span></div>
                        <div class="text-emerald-400 text-xs mt-0.5">${percent}% complete</div>
                    </div>
                    <div class="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                        <div class="text-slate-400 text-xs mb-0.5">PERFECT SOLVES</div>
                        <div class="font-semibold text-lg">${perfectSolvesThisSession} <span class="text-xs text-slate-500">(${solved > 0 ? Math.round((perfectSolvesThisSession / solved) * 100) : 0}%)</span></div>
                        <div class="text-xs mt-0.5 text-slate-400">no-help clears</div>
                    </div>
                    
                    <div class="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                        <div class="text-slate-400 text-xs mb-0.5">AVG / PUZZLE</div>
                        <div class="font-semibold text-lg">${solved > 0 ? Math.round(sessionPointsEarned / solved) : 0} <span class="text-xs text-slate-400">pts</span></div>
                    </div>
                    <div class="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                        <div class="text-slate-400 text-xs mb-0.5">HELPS USED</div>
                        <div class="font-semibold text-lg">${sessionRevealsUsed + sessionExtraHintsUsed} <span class="text-xs text-amber-400">(-${sessionRevealsUsed + sessionExtraHintsUsed * 2} pts)</span></div>
                        <div class="text-[10px] text-slate-500 mt-0.5">${sessionRevealsUsed} reveals • ${sessionExtraHintsUsed} hints</div>
                    </div>
                </div>

                <!-- Progress bar -->
                <div class="mt-4">
                    <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-2 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style="width: ${percent}%"></div>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div class="p-4 flex flex-col gap-2 bg-slate-900">
                <button onclick="shareScore();" 
                        class="w-full py-3.5 bg-white text-slate-950 font-semibold rounded-2xl flex items-center justify-center gap-x-2 active:scale-[0.985] transition-all">
                    <i class="fa-solid fa-share-alt"></i>
                    <span>Share This Run</span>
                </button>
                
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="document.getElementById('end-modal').remove(); showProgressModal();" 
                            class="py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-medium flex items-center justify-center gap-x-2 text-sm">
                        <i class="fa-solid fa-list-check"></i>
                        <span>Progress</span>
                    </button>
                    <button onclick="replayLastSessionConfig()" 
                            class="py-3 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-semibold flex items-center justify-center gap-x-2 text-sm text-white">
                        <i class="fa-solid fa-redo"></i>
                        <span>Play Again</span>
                    </button>
                </div>
                
                <button onclick="finishSessionAndReturn()" 
                        class="w-full py-2.5 text-sm text-slate-400 hover:text-white transition-colors">
                    Return to Menu
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Celebration for great runs
    if (tier.crown || tier.confettiBoost > 0) {
        setTimeout(() => launchSimpleConfetti(), 220);
        if (tier.confettiBoost >= 2) {
            setTimeout(() => launchSimpleConfetti(), 680);
        }
    }
}


function showDailyCompleteModal() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const dailyPuzzle = sessionPuzzles[0];
    const points = sessionPointsEarned || 0;
    const streak = gameState.dailyCurrentStreak || 1;
    const longest = gameState.dailyLongestStreak || streak;

    const performance = (perfectSolvesThisSession > 0 && sessionRevealsUsed === 0 && sessionExtraHintsUsed === 0)
        ? "Perfect daily! 🔥"
        : sessionRevealsUsed + sessionExtraHintsUsed <= 1
            ? "Excellent work!"
            : "Solid effort!";

    const modal = document.createElement("div");
    modal.id = "daily-complete-modal";
    modal.className = `fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4`;

    modal.innerHTML = `
        <div onclick="event.stopImmediatePropagation()" 
             class="bg-slate-900 w-full max-w-md rounded-3xl border border-emerald-700 overflow-hidden">
            
            <div class="px-6 pt-6 pb-4 text-center bg-gradient-to-b from-emerald-900/20 to-transparent">
                <div class="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-3">
                    <i class="fa-solid fa-calendar-check text-3xl text-emerald-400"></i>
                </div>
                <div class="text-2xl font-bold text-emerald-300">Daily Puzzle Complete!</div>
                <div class="text-emerald-400 text-sm mt-1">${performance}</div>
            </div>

            <div class="px-6 py-5 bg-slate-950 border-y border-slate-700">
                <div class="text-center mb-4">
                    <div class="text-xs text-slate-400">TODAY'S PUZZLE</div>
                    <div class="font-semibold text-lg mt-1">${escapeHtml(dailyPuzzle.question)}</div>
                    <div class="text-xs text-slate-500 mt-1">from ${escapeHtml(dailyPuzzle.category)}</div>
                </div>

                <div class="flex justify-center gap-8 text-center">
                    <div>
                        <div class="text-2xl font-bold text-emerald-400">+${points}</div>
                        <div class="text-xs text-slate-400">Points Today</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold">${streak}🔥</div>
                        <div class="text-xs text-slate-400">Day Streak</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-slate-300">${longest}</div>
                        <div class="text-xs text-slate-400">Best Streak</div>
                    </div>
                </div>
            </div>

            <div class="p-4 flex flex-col gap-2 bg-slate-900">
                <button onclick="shareDailyResult(); document.getElementById('daily-complete-modal').remove();" 
                        class="w-full py-3 bg-white text-slate-900 font-semibold rounded-2xl flex items-center justify-center gap-x-2">
                    <i class="fa-solid fa-share-alt"></i>
                    <span>Share Daily Result</span>
                </button>
                
                <button onclick="document.getElementById('daily-complete-modal').remove(); finishSessionAndReturn();" 
                        class="w-full py-3 text-sm text-slate-400 hover:text-white transition-colors">
                    Return to Menu
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}


function shareDailyResult() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    const dailyPuzzle = sessionPuzzles[0];
    const points = sessionPointsEarned || 0;
    const streak = gameState.dailyCurrentStreak || 1;

    const text = `🗓️ Daily Puzzle Complete!\n` +
                 `+${points} points on "${dailyPuzzle.question}"\n` +
                 `Current streak: ${streak} days 🔥\n\n` +
                 `Play today's Daily Puzzle at Puzzle of Fortune!`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Daily result copied to clipboard!");
        }).catch(() => fallbackShare(text));
    } else {
        fallbackShare(text);
    }
}

