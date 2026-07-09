// Tailwind script
function initializeTailwind() {
    document.documentElement.style.setProperty('--accent', '#c8102e');

    // Inject sexier, subtle dark scrollbars (great on mobile + in modals)
    if (!document.getElementById('polish-scrollbars')) {
        const style = document.createElement('style');
        style.id = 'polish-scrollbars';
        style.textContent = `
            /* Firefox */
            * {
                scrollbar-width: thin;
                scrollbar-color: #475569 #1e2937;
            }

            /* WebKit (Chrome, Safari, Edge) */
            ::-webkit-scrollbar {
                width: 5px;
                height: 5px;
            }
            ::-webkit-scrollbar-track {
                background: #1e2937;
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb {
                background: #475569;
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #64748b;
            }

            /* Stronger / more visible inside our dark modals and scroll containers */
            .modal, .overflow-auto, [class*="max-h-"][class*="overflow"] {
                scrollbar-color: #64748b #0f172a;
            }
            .modal::-webkit-scrollbar-thumb,
            .overflow-auto::-webkit-scrollbar-thumb {
                background: #64748b;
            }
        `;
        document.head.appendChild(style);
    }
}

 

/** Bootstrap */

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Only register when served over http(s) — file:// cannot use SW
    const protocol = location.protocol;
    if (protocol !== 'http:' && protocol !== 'https:') return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(
            (reg) => console.log('%c[Puzzle of Fortune] SW registered', 'color:#64748b', reg.scope),
            (err) => console.warn('[Puzzle of Fortune] SW registration failed', err)
        );
    });
}

function initializeGame() {
    initializeTailwind();
    loadGameState();
    updateHeaderScore();
    updateAchievementsButton();
    updateDailyUI();

    // Always start with a valid mode before building the UI
    if (!currentGameMode || !GAME_MODES[currentGameMode]) {
        currentGameMode = 'normal';
    }

    initModeSelector();

    // Defaults are now handled inside the Game Setup modal when the user opens it.
    // selectedNumQuestions / currentGameMode are still set to sensible values for any legacy paths.
    selectedNumQuestions = 10;
    currentGameMode = 'normal';

    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    
    console.log('%c[Puzzle of Fortune] Ready', 'color:#64748b');
}

registerServiceWorker();
window.onload = initializeGame;
