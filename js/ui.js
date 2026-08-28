/** UI rendering, modals, toasts */


function updateAchievementsButton() {
    const btnText = document.getElementById('achievements-btn-text');
    if (!btnText) return;

    const unlocked = Object.keys(gameState.achievements || {}).length;
    const total = achievements.length;
    btnText.textContent = `Achievements (${unlocked}/${total})`;
}

let pageScrollLocks = 0;
function lockPageScroll() {
    pageScrollLocks++;
    document.body.classList.add('scroll-locked');
}
function unlockPageScroll() {
    pageScrollLocks = Math.max(0, pageScrollLocks - 1);
    if (pageScrollLocks === 0) document.body.classList.remove('scroll-locked');
}

function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function shouldAutofocusTiles() {
    if (window.matchMedia('(pointer: coarse)').matches) return false;
    if (window.matchMedia('(max-width: 640px)').matches) return false;
    return true;
}

function puzzleLockedThisSession() {
    const sessionPuzzles = window.currentSessionPuzzles || puzzles;
    if (!sessionPuzzles || currentPuzzleIndex < 0 || currentPuzzleIndex >= sessionPuzzles.length) return false;
    const puzzle = sessionPuzzles[currentPuzzleIndex];
    return !!(sessionSolved[puzzle.id] || fullRevealUsed || timeUpUsed);
}

function countPuzzlesInCategory(value) {
    if (!Array.isArray(puzzles)) return 0;
    if (value === 'Mixed Bag') return puzzles.length;
    return puzzles.filter((p) => p.category === value).length;
}

function attachFortuneOverlay(overlay) {
    overlay.classList.add('fortune-overlay');
    dismissToasts();
    lockPageScroll();
    const onKey = (e) => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('app-dialog')) return;
        e.preventDefault();
        overlay.remove();
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    const nativeRemove = overlay.remove.bind(overlay);
    overlay.remove = () => {
        document.removeEventListener('keydown', onKey);
        unlockPageScroll();
        nativeRemove();
    };
    return overlay;
}


function updateHeaderScore(showLastSession = false) {
    const scoreEl = document.getElementById('header-score');
    const suffixEl = document.getElementById('header-score-suffix');
    if (!scoreEl) return;

    const badge = scoreEl.closest('.score-badge');
    const lastRun = !window.currentSessionPuzzles && lastSessionPoints > 0;
    if (badge) badge.classList.toggle('is-last-run', lastRun);

    if (lastRun) {
        scoreEl.textContent = `+${lastSessionPoints}`;
        scoreEl.style.color = '';
        if (suffixEl) {
            suffixEl.textContent = 'last';
            suffixEl.className = 'score-suffix';
        }
    } else {
        scoreEl.textContent = gameState.score;
        scoreEl.style.color = '';
        if (suffixEl) {
            suffixEl.textContent = '';
            suffixEl.className = 'score-suffix';
        }
    }
}


function showAchievementUnlock(ach) {
    // Remove any existing unlock banner first
    const existing = document.getElementById('achievement-unlock-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'achievement-unlock-banner';
    banner.className = 'flex items-start gap-3 opacity-0';

    banner.innerHTML = `
        <div class="text-2xl mt-0.5">${ach.icon}</div>
        <div class="flex-1 min-w-0">
            <div class="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--fortune-gold)] mb-0.5">Unlocked</div>
            <div class="text-white font-semibold leading-tight">${ach.name}</div>
        </div>
        <button type="button" class="fortune-close !min-h-0 !min-w-0 !text-lg" onclick="this.closest('#achievement-unlock-banner').remove()">×</button>
    `;

    document.body.appendChild(banner);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        banner.style.transition = 'opacity 0.2s ease';
        banner.style.opacity = '1';
    });

    // Auto-dismiss after 5.5 seconds
    setTimeout(() => {
        if (banner && banner.parentNode) {
            banner.style.transition = 'opacity 0.2s ease';
            banner.style.opacity = '0';
            setTimeout(() => {
                if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
            }, 350);
        }
    }, 3200);
}


function updateDailyUI() {
    const badge = document.getElementById('daily-streak-badge');
    const resetText = document.getElementById('daily-reset-text');
    if (!badge || !resetText) return;

    const today = getTodayDateString();
    const isCompletedToday = gameState.dailyLastDate === today;

    const strip = document.getElementById('daily-today-strip');
    if (gameState.dailyCurrentStreak > 0) {
        badge.textContent = `${gameState.dailyCurrentStreak} day streak`;
        badge.classList.add('is-on');
        badge.style.display = '';
    } else {
        badge.textContent = '';
        badge.classList.remove('is-on');
        badge.style.display = '';
    }

    if (strip) {
        strip.classList.toggle('is-done', isCompletedToday);
        strip.classList.toggle('is-open', !isCompletedToday);
    }

    const dailyBtn = document.getElementById('daily-btn');
    const dailyLabel = document.getElementById('daily-btn-label');
    if (dailyBtn) dailyBtn.classList.toggle('is-done', isCompletedToday);
    if (dailyLabel) dailyLabel.textContent = isCompletedToday ? 'Come back tomorrow' : 'Daily Puzzle';

    if (isCompletedToday) {
        resetText.textContent = 'Solved today · streak saved';
    } else {
        try {
            const daily = getDailyPuzzle();
            resetText.textContent = `Today · ${daily.category} · still open`;
        } catch (e) {
            resetText.textContent = '';
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
        el.textContent = 'Solved';
        el.className = 'points-pill is-done';
        return;
    }

    const potential = computePointsEarned(puzzle, currentRevealsUsed, extraHintUsed, fullRevealUsed);
    if (fullRevealUsed) {
        el.textContent = '+0';
        el.className = 'points-pill is-zero';
        return;
    }
    el.textContent = `+${potential} if you solve now`;
    el.className = 'points-pill';
}


function createPuzzleDisplay(puzzle) {
    const container = document.getElementById('puzzle-display');
    container.innerHTML = '';
    container.className = 'puzzle-container';

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
            spacer.className = 'puzzle-tile space';
            spacer.setAttribute('aria-hidden', 'true');
            container.appendChild(spacer);
        } else {
            if (!currentWordDiv) {
                currentWordDiv = document.createElement('div');
                currentWordDiv.className = 'word-group';
                currentWordDiv.style.gap = '4px';
                currentWordDiv.style.marginRight = '8px';
            }
            
            if (item.type === 'punctuation') {
                const punct = document.createElement('span');
                punct.className = 'punctuation';
                punct.textContent = item.char;
                if (item.char === ',') punct.classList.add('is-comma');
                else if (item.char === "'") punct.classList.add('is-apos');
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

    const letterCount = charData.filter((c) => c.type === 'letter').length;
    if (letterCount > 28) container.dataset.size = 'xs';
    else if (letterCount > 20) container.dataset.size = 'sm';
    else if (letterCount > 12) container.dataset.size = 'md';
    else delete container.dataset.size;

    setupInteractiveInputs(container);
    return charData;
}


function setupInteractiveInputs(container) {
    const inputs = Array.from(container.querySelectorAll('input.puzzle-tile'));
    if (inputs.length === 0) return;
    if (shouldAutofocusTiles()) {
        setTimeout(() => {
            const firstEmpty = inputs.find(inp => !inp.value);
            if (firstEmpty && document.activeElement.tagName !== 'INPUT') firstEmpty.focus();
        }, 60);
    }
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
                e.target.classList.remove('is-typed');
                return;
            }
            // Keep a single uppercase character
            e.target.value = e.target.value.slice(-1).toUpperCase();
            e.target.classList.toggle('is-typed', !!e.target.value);
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

            if (e.key === 'Backspace') {
                if (input.value) {
                    input.value = '';
                    input.classList.remove('is-typed');
                    e.preventDefault();
                    return;
                }
                if (index > 0) {
                    const prevInput = inputs[index - 1];
                    prevInput.value = '';
                    prevInput.classList.remove('is-typed');
                    prevInput.focus();
                    e.preventDefault();
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
        circle.className = `success-burst ${accent.iconBg}`;
        iconEl.className = `fa-solid fa-check-circle ${accent.iconColor} text-4xl`;
    }
    if (titleEl) {
        titleEl.className = `heading-font text-2xl ${accent.title}`;
    }
    if (pointsEl) {
        pointsEl.className = `success-points mt-1 ${accent.points}`;
    }

    let pointsText;
    if (fullRevealUsed) {
        pointsText = `+0 points (full answer revealed)`;
    } else {
        pointsText = `+${pointsEarned} points`;
    }
    if (pointsEl) {
        pointsEl.textContent = fullRevealUsed ? pointsText : `+${pointsEarned}`;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    dismissToasts();
    lockPageScroll();
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
            if (e.key === 'Escape') {
                e.preventDefault();
                hideSuccessModal();
                return;
            }
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
    unlockPageScroll();
    updateNextButton();
}


function launchSimpleConfetti() {
    if (prefersReducedMotion()) return;
    const colors = ['#E8C547', '#F5D76E', '#FFF6D6', '#34d399'];
    for (let i = 0; i < 16; i++) {
        setTimeout(() => {
            const conf = document.createElement('div');
            conf.style.position = 'fixed';
            conf.style.left = Math.random() * 100 + 'vw';
            conf.style.top = '-10px';
            conf.style.width = '7px';
            conf.style.height = '7px';
            conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            conf.style.background = colors[Math.floor(Math.random() * colors.length)];
            conf.style.zIndex = '9999';
            conf.style.pointerEvents = 'none';
            conf.style.opacity = Math.random() + 0.55;
            conf.style.transition = 'transform 1.05s linear, opacity 1.05s linear';
            document.body.appendChild(conf);
            const angle = Math.random() * 60 + 30;
            const velocity = Math.random() * 80 + 120;
            setTimeout(() => {
                conf.style.transform = `translateY(${velocity}px) rotate(${angle * 3}deg)`;
                conf.style.opacity = '0';
            }, 50);
            setTimeout(() => conf.remove(), 1300);
        }, i * 6);
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
        listHTML = `<div class="p-6 text-center text-slate-400 text-sm">Solve your first puzzle to fill this list.</div>`;
    } else {
        displayPuzzles.forEach((p, idx) => {
            const solved = hasActiveSession 
                ? !!sessionSolved[p.id]
                : !!gameState.solved[p.id];
            const qShort = escapeHtml(p.question.substring(0, 55)) + (p.question.length > 55 ? '...' : '');
            listHTML += `
                <div onclick="jumpToPuzzle(${p.id}); document.getElementById('progress-modal').remove();" 
                     class="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-800/80 min-h-[52px] ${solved ? 'bg-[rgba(232,197,71,0.08)]' : ''}">
                    <div class="min-w-0 pr-2">
                        <span class="font-mono text-xs text-slate-500">#${idx + 1}</span>
                        <span class="ml-2 text-sm">${qShort}</span>
                    </div>
                    ${solved ? '<span class="text-[var(--fortune-gold)] text-xs font-semibold whitespace-nowrap"><i class="fa-solid fa-check mr-1"></i>Solved</span>' : ''}
                </div>
            `;
        });
    }

    const modalHTML = `
        <div id="progress-modal" class="fortune-overlay" style="z-index:60">
            <div onclick="event.stopImmediatePropagation()" 
                 class="fortune-modal w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <div class="fortune-modal-head">
                    <div>
                        <div class="fortune-modal-title">${hasActiveSession ? 'This session' : 'Progress'}</div>
                        <div class="text-[var(--fortune-gold)] text-sm mt-0.5">
                            ${hasActiveSession 
                                ? `${getSolvedCount()} / ${displayPuzzles.length} solved · ${gameState.score} pts`
                                : `${displayPuzzles.length} solved · ${gameState.score} pts`}
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('progress-modal').remove()" class="fortune-close">&times;</button>
                </div>
                <div class="px-4 pb-2 overflow-auto flex-1 space-y-1 text-sm">
                    ${listHTML}
                </div>
                <div class="p-4 border-t border-slate-800 flex gap-3">
                    <button type="button" onclick="shareScore(); document.getElementById('progress-modal').remove()" class="btn-gold flex-1 text-sm">Share score</button>
                    <button type="button" onclick="resetProgress(); document.getElementById('progress-modal').remove()" class="btn-nav btn-giveup px-4">Reset</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachFortuneOverlay(document.getElementById('progress-modal'));
}


// ============================================================
// NEW: Game Setup Modal + helpers (clean hub + focused setup)
// ============================================================

function showGameSetupModal() {
    const setupModal = document.createElement('div');
    setupModal.className = 'fortune-overlay';
    setupModal.style.zIndex = '80';

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
            const spicy = key === 'challenge' || key === 'no_mistakes';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `mode-card ${isActive ? 'is-selected' : ''} ${spicy ? 'is-spicy' : ''}`;
            const mult = m.pointMultiplier === 1 ? '1×' : `${m.pointMultiplier}×`;
            btn.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <div class="font-semibold text-sm">${m.name}</div>
                        <div class="text-[10px] text-slate-400 leading-tight truncate">${m.description.split('.')[0]}</div>
                    </div>
                    <span class="mode-mult">${mult}</span>
                </div>
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
            const count = countPuzzlesInCategory(cat.value);

            card.className = `setup-card ${isActive ? 'is-selected' : ''}`;
            card.innerHTML = `
                <div class="flex items-start gap-1.5">
                    <span class="text-base leading-none mt-0.5">${cat.icon}</span>
                    <div class="flex-1 min-w-0 leading-tight">
                        <div class="font-medium text-[13px]">${cat.label}</div>
                        <div class="count">${cat.hint ? cat.hint + ' · ' : ''}${count} puzzles</div>
                    </div>
                </div>
            `;

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
        <div class="fortune-modal w-full max-w-md max-h-[92vh] flex flex-col">
            <div class="fortune-modal-head">
                <div class="fortune-modal-title">New Session</div>
                <button type="button" class="fortune-close" onclick="event.target.closest('.fortune-overlay').remove()">&times;</button>
            </div>
            <div class="px-5 overflow-auto flex-1">
            <div class="mb-3">
                <label class="setup-label">Player name (optional)</label>
                <input id="setup-player-name" type="text" placeholder="Your name" value="${escapeHtml(gameState.playerName || '')}"
                       class="w-full px-4 py-2 bg-slate-900/70 border border-slate-700 rounded-2xl text-sm focus:outline-none focus:border-[var(--fortune-gold)]">
            </div>

            <div class="mb-3">
                <label class="setup-label">Category</label>
                <div id="setup-category-grid" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5"></div>
            </div>

            <div class="mb-3">
                <label class="setup-label">Length</label>
                <div id="setup-length-buttons" class="segmented"></div>
            </div>

            <div class="mb-3">
                <label class="setup-label">Mode</label>
                <div id="setup-mode-buttons" class="grid grid-cols-2 gap-1.5"></div>
                <div class="text-[10px] text-slate-400 mt-1 min-h-[14px]" id="setup-mode-hint"></div>
            </div>
            </div>
            <div class="px-5 pb-4 pt-2 border-t border-slate-800">
            <div class="setup-summary mb-2">
                <div class="hidden sm:block text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">You'll play</div>
                <div id="setup-summary" class="text-sm sm:text-base"></div>
            </div>
            <button type="button" id="setup-launch-btn" class="btn-gold w-full text-base">
                <i class="fa-solid fa-play text-xs"></i>
                <span>Start Session</span>
            </button>
            <button type="button" onclick="event.target.closest('.fortune-overlay').remove()" class="btn-ghost w-full mt-1">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(setupModal);
    attachFortuneOverlay(setupModal);

    // Post-insert wiring
    const lengthContainer = setupModal.querySelector('#setup-length-buttons');
    const modeContainer = setupModal.querySelector('#setup-mode-buttons');
    const categoryGrid = setupModal.querySelector('#setup-category-grid');
    const summaryEl = setupModal.querySelector('#setup-summary');
    const launchBtn = setupModal.querySelector('#setup-launch-btn');

    const lengths = [5, 10, 20, 40, 999];
    if (![5, 10, 20, 40, 999].includes(currentSetup.numQuestions)) {
        currentSetup.numQuestions = currentSetup.numQuestions >= 80 ? 999 : 40;
    }
    lengths.forEach(len => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = len === 999 ? 'All' : String(len);
        if (len === currentSetup.numQuestions) b.classList.add('is-selected');
        b.addEventListener('click', () => {
            currentSetup.numQuestions = len;
            lengthContainer.querySelectorAll('button').forEach((bb) => bb.classList.remove('is-selected'));
            b.classList.add('is-selected');
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
    modal.innerHTML = `
        <div class="fortune-modal w-full sm:max-w-md max-h-[85vh] overflow-auto">
            <div class="fortune-modal-head">
                <div>
                    <div class="fortune-modal-title">How to Play</div>
                    <div class="text-xs text-slate-400 mt-0.5">Five beats. Then spin the board.</div>
                </div>
                <button type="button" class="fortune-close" onclick="event.target.closest('.fortune-overlay').remove()">&times;</button>
            </div>
            <div class="px-5 pb-5 space-y-3.5 text-sm text-slate-300">
                <div>
                    <div class="font-semibold text-[var(--fortune-gold)] mb-0.5">Type the phrase</div>
                    <div>Read the clue, fill the tiles, hit Submit or Enter. Accents and leading “The” still count.</div>
                </div>
                <div>
                    <div class="font-semibold text-[var(--fortune-gold)] mb-0.5">Hints cost points</div>
                    <div>Reveal letter −1 · Extra clue −2 · Give up scores 0.</div>
                </div>
                <div>
                    <div class="font-semibold text-[var(--fortune-gold)] mb-0.5">Modes change the heat</div>
                    <div>Challenge 1.5× (no helps). No Mistakes 2×. Time Attack is 60s a puzzle. Marathon ends on a miss.</div>
                </div>
                <div>
                    <div class="font-semibold text-[var(--fortune-gold)] mb-0.5">Daily streak</div>
                    <div>One puzzle a day. Come back tomorrow to keep the gold streak alive.</div>
                </div>
                <div>
                    <div class="font-semibold text-[var(--fortune-gold)] mb-0.5">Your run is saved</div>
                    <div>Score, solves, and achievements stay in this browser.</div>
                </div>
                <button type="button" onclick="event.target.closest('.fortune-overlay').remove()" class="btn-gold w-full mt-2">Got it</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    attachFortuneOverlay(modal);
}


function showAchievementsModal() {
    const modal = document.createElement('div');

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
        <div class="fortune-modal w-full sm:max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopImmediatePropagation()">
            <div class="fortune-modal-head">
                <div>
                    <div class="fortune-modal-title">Achievements</div>
                    <div class="text-sm text-slate-400 mt-0.5">
                        ${unlockedCount} / ${total} unlocked
                        ${unlockedCount === 0 ? ' · solve your first puzzle' : ` · ${progressPercent}%`}
                    </div>
                </div>
                <button type="button" class="fortune-close" onclick="event.target.closest('.fortune-overlay').remove()">&times;</button>
            </div>
            <div class="px-5">
            <div class="gold-bar mb-4"><span style="width: ${progressPercent}%"></span></div>
            </div>
            <div class="px-5 pb-2 overflow-auto flex-1 pr-3 space-y-5 text-sm">
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
                        <div class="gold-bar"><span style="width: ${pct}%"></span></div>
                    </div>
                `;
            }

            html += `
                <div class="ach-row ${unlocked ? 'is-unlocked' : 'is-locked'}">
                    <div class="text-2xl mt-0.5">${ach.icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold ${unlocked ? 'text-[var(--fortune-gold-hi)]' : 'text-slate-300'}">${ach.name}</div>
                        <div class="text-xs text-slate-400 mt-0.5">${ach.desc}</div>
                        ${progressHTML}
                    </div>
                    <div class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${unlocked ? 'bg-[rgba(232,197,71,0.2)] text-[var(--fortune-gold)]' : 'bg-slate-800 text-slate-500'}">
                        ${unlocked ? 'Unlocked' : 'Locked'}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += `
            </div>

            <button type="button" onclick="event.target.closest('.fortune-overlay').remove()" 
                    class="mx-5 mb-5 mt-3 btn-nav w-[calc(100%-2.5rem)]">
                Close
            </button>
        </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);
    attachFortuneOverlay(modal);
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
                <div class="gold-bar"><span style="width: ${barWidth}%"></span></div>
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

    modal.innerHTML = `
        <div class="fortune-modal w-full sm:max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div class="fortune-modal-head">
                <div>
                    <div class="fortune-modal-title">Statistics</div>
                    <div class="text-xs text-slate-400">Your fortune so far</div>
                </div>
                <button type="button" class="fortune-close" onclick="event.target.closest('.fortune-overlay').remove()">&times;</button>
            </div>

            <div class="flex-1 overflow-auto space-y-6 px-5 pr-4 pb-2">

            <div class="stat-hero">
                <div class="stat-hero-card is-gold">
                    <div class="text-[10px] uppercase tracking-widest text-slate-400">Streak</div>
                    <div class="text-2xl font-bold tabular-nums mt-1">${gameState.dailyCurrentStreak || 0}</div>
                </div>
                <div class="stat-hero-card is-gold">
                    <div class="text-[10px] uppercase tracking-widest text-slate-400">Solved</div>
                    <div class="text-2xl font-bold tabular-nums mt-1">${totalSolved}</div>
                </div>
                <div class="stat-hero-card is-gold">
                    <div class="text-[10px] uppercase tracking-widest text-slate-400">Perfect</div>
                    <div class="text-2xl font-bold tabular-nums mt-1">${perfectPercent}<span class="text-sm font-semibold">%</span></div>
                </div>
            </div>

            <!-- Lifetime -->
            <div>
                <div class="setup-label">Lifetime</div>
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

            <div>
                <div class="setup-label">Overall</div>
                <div class="rounded-2xl p-4 border border-slate-800 text-sm text-slate-300 bg-[rgba(17,24,39,0.6)]">
                    ${totalSolved === 0
                        ? 'Solve your first puzzle to start this ledger.'
                        : `Keep the streak alive — longest run is ${gameState.dailyLongestStreak || 0} day${(gameState.dailyLongestStreak || 0) === 1 ? '' : 's'}.`}
                </div>
            </div>

            </div>

            <button type="button" onclick="event.target.closest('.fortune-overlay').remove()" 
                    class="m-5 btn-nav">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    attachFortuneOverlay(modal);
}


function dismissToasts() {
    document.querySelectorAll('.toast').forEach((el) => el.remove());
}

function showToast(message, duration = 1600) {
    dismissToasts();
    const toast = document.createElement('div');
    toast.className = 'toast';
    const playing = document.getElementById('game-screen') && !document.getElementById('game-screen').classList.contains('hidden');
    if (playing) toast.classList.add('toast-play');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.18s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 180);
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

        dismissToasts();
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


function copyShareText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied.");
        }).catch(() => {
            fallbackShare(text);
        });
    } else {
        fallbackShare(text);
    }
}

function shareScore() {
    const hasSession = !!window.currentSessionPuzzles;
    let text;
    if (hasSession) {
        const solved = getSolvedCount();
        const total = window.currentSessionPuzzles.length;
        const modeName = (GAME_MODES[currentGameMode] || GAME_MODES.normal).name;
        const cat = selectedCategory || 'Session';
        text = `Puzzle of Fortune · ${cat} · ${modeName}\n+${sessionPointsEarned} pts · ${solved}/${total} solved`;
    } else {
        const solved = typeof getLifetimeSolvedCount === 'function' ? getLifetimeSolvedCount() : getSolvedCount();
        text = `Puzzle of Fortune\n${gameState.score} pts · ${solved} solved`;
    }
    copyShareText(text);
}


function fallbackShare(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand("copy");
        showToast("Copied.");
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
             class="fortune-modal w-full max-w-md overflow-hidden ${accentBorder}">
            
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

            <div class="p-4 flex flex-col gap-2">
                <button type="button" onclick="shareScore();" class="btn-gold w-full">
                    <i class="fa-solid fa-share-alt text-xs"></i>
                    <span>Share this run</span>
                </button>
                <div class="grid grid-cols-2 gap-2">
                    <button type="button" onclick="replayLastSessionConfig()" class="btn-nav">
                        <i class="fa-solid fa-redo text-[10px]"></i>
                        <span>Play again</span>
                    </button>
                    <button type="button" onclick="finishSessionAndReturn()" class="btn-nav">
                        Home
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    attachFortuneOverlay(modal);

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

    modal.innerHTML = `
        <div onclick="event.stopImmediatePropagation()" class="fortune-modal w-full max-w-md overflow-hidden">
            <div class="px-6 pt-6 pb-3 text-center">
                <div class="success-burst mx-auto mb-3">
                    <i class="fa-solid fa-calendar-check text-3xl text-[var(--fortune-gold)]"></i>
                </div>
                <div class="heading-font text-2xl">Daily complete</div>
                <div class="text-slate-400 text-sm mt-1">${performance}</div>
            </div>

            <div class="px-6 py-4 text-center">
                <div class="text-[10px] uppercase tracking-[0.16em] text-slate-500">Streak</div>
                <div class="streak-prize">${streak}</div>
                <div class="text-sm text-[var(--fortune-gold)] mt-1">${streak === 1 ? 'day' : 'days'} · best ${longest}</div>
                <div class="text-sm text-slate-400 mt-3">Come back tomorrow for a new phrase.</div>
            </div>

            <div class="px-6 pb-2 text-center">
                <div class="text-[10px] uppercase tracking-widest text-slate-500">Today</div>
                <div class="success-phrase text-lg mt-1">${escapeHtml(dailyPuzzle.question)}</div>
                <div class="text-xs text-slate-500 mt-1">+${points} pts · ${escapeHtml(dailyPuzzle.category)}</div>
            </div>

            <div class="p-4 flex flex-col gap-2">
                <button type="button" onclick="shareDailyResult(); document.getElementById('daily-complete-modal').remove();" class="btn-gold w-full">
                    <i class="fa-solid fa-share-alt text-xs"></i>
                    <span>Share daily</span>
                </button>
                <button type="button" onclick="document.getElementById('daily-complete-modal').remove(); finishSessionAndReturn();" class="btn-nav">
                    Home
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    attachFortuneOverlay(modal);
}


function shareDailyResult() {
    const points = sessionPointsEarned || 0;
    const streak = gameState.dailyCurrentStreak || 1;
    const pretty = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    copyShareText(`Puzzle of Fortune Daily · ${pretty}\n+${points} pts · ${streak}-day streak`);
}

function showDailyAlreadyDone() {
    const existing = document.getElementById('daily-done-modal');
    if (existing) existing.remove();

    const streak = gameState.dailyCurrentStreak || 0;
    const modal = document.createElement('div');
    modal.id = 'daily-done-modal';
    modal.innerHTML = `
        <div onclick="event.stopImmediatePropagation()" class="fortune-modal w-full max-w-sm overflow-hidden">
            <div class="px-6 pt-6 pb-2 text-center">
                <div class="success-burst mx-auto mb-3">
                    <i class="fa-solid fa-calendar-check text-3xl text-[var(--fortune-gold)]"></i>
                </div>
                <div class="heading-font text-2xl">Already in the bag</div>
                <div class="streak-prize mt-3">${streak || '✓'}</div>
                <div class="text-sm text-[var(--fortune-gold)] mt-1">${streak === 1 ? '1-day streak' : `${streak}-day streak`}</div>
                <div class="text-sm text-slate-400 mt-3">Come back tomorrow for a new phrase.</div>
            </div>
            <div class="p-4">
                <button type="button" onclick="document.getElementById('daily-done-modal').remove()" class="btn-gold w-full">Nice</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    attachFortuneOverlay(modal);
}

