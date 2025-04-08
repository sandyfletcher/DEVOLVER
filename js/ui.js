// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar, Canvas Setup, and Drawing Operations
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- DOM Element References ---
// Cache elements for performance
let waveStatusEl, waveTimerEl, enemyCountEl;
let healthLabelEl, healthBarContainerEl, healthBarFillEl, healthTextEl;
let inventoryListEl;
let swordStatusEl;
// Game Over elements (assuming an overlay structure later)
let gameOverOverlayEl, gameOverWaveEl, playAgainBtnEl;
// Add restart button reference
let restartButtonEl;

/**
 * Initializes the UI module by getting references to the HTML elements.
 * Call this once when the game starts.
 */
export function init() {
    waveStatusEl = document.getElementById('wave-status');
    waveTimerEl = document.getElementById('wave-timer');
    enemyCountEl = document.getElementById('enemy-count');
    healthLabelEl = document.getElementById('health-label'); // Keep label ref if needed elsewhere
    healthBarContainerEl = document.getElementById('health-bar-container');
    healthBarFillEl = document.getElementById('health-bar-fill');
    healthTextEl = document.getElementById('health-text');
    inventoryListEl = document.getElementById('inventory-list');
    swordStatusEl = document.getElementById('sword-status'); // Sword status element
    restartButtonEl = document.getElementById('restart-button');

    if (!waveStatusEl || !waveTimerEl || !enemyCountEl || !healthLabelEl || !healthBarContainerEl || !healthBarFillEl|| !healthTextEl || !inventoryListEl || !swordStatusEl || !restartButtonEl) {
        console.warn("UI Init: Could not find all expected UI elements in the DOM!");
    }
    // console.log("UI Module Initialized (HTML Mode)");
}

/**
 * Updates the Wave Information displayed in the left sidebar.
 * @param {object} waveInfo - Object from WaveManager.getWaveInfo().
 * @param {number} livingEnemies - Current number of living enemies.
 */
export function updateWaveInfo(waveInfo = {}, livingEnemies = 0) {
    if (!waveStatusEl || !waveTimerEl) return; // Elements not found

    let statusText = '';
    let timerText = '';
    let enemyText = '';

    if (waveInfo.isGameOver) {
        statusText = 'GAME OVER';
        // You might want to pass the final wave number reached to game over screen separately
        timerText = `Survived ${waveInfo.mainWaveNumber > 0 ? waveInfo.mainWaveNumber -1 : 0} Waves`; // Show completed waves
    } else if (waveInfo.allWavesCleared) {
        statusText = 'VICTORY!';
        timerText = 'All Waves Cleared!';
    } else {
        // Active Gameplay States
        statusText = `Wave ${waveInfo.mainWaveNumber || 1}`; // Show current main wave

        if (waveInfo.timerLabel && waveInfo.timer > 0) {
            timerText = `${waveInfo.timerLabel} ${waveInfo.timer.toFixed(1)}s`;
        } else {
             timerText = waveInfo.progressText || ''; // Show spawning progress or clear message
        }

        if (waveInfo.state === 'ACTIVE' || waveInfo.state === 'SPAWNING') {
            enemyText = `Enemies Remaining: ${livingEnemies}`;
        } else {
             enemyText = ''; // No enemy count during intermission/pre-wave
        }
    }

    waveStatusEl.textContent = statusText;
    waveTimerEl.textContent = timerText;
    if (enemyCountEl) {
        enemyCountEl.textContent = enemyText;
    }
}

/**
 * Updates the Player Status (Health, Inventory, Sword) in the right sidebar.
 * @param {number} currentHealth - Player's current health.
 * @param {number} maxHealth - Player's max health (used for drawing boxes).
 * @param {object} inventory - Player's inventory object { itemType: count }.
 * @param {boolean} hasSword - Whether the player currently has the sword.
 */
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword) {
        // Update Health Bar
        if (healthBarFillEl && healthTextEl) {
            // Clamp health between 0 and maxHealth
            const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
            // Calculate percentage, handle maxHealth being 0
            const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    
            healthBarFillEl.style.width = `${healthPercent}%`;
            healthTextEl.textContent = `${Math.round(clampedHealth)}/${maxHealth}`; // Show rounded current health
             }
                // Update Inventory List
    if (inventoryListEl) {
        let inventoryHTML = '';
        const items = Object.keys(inventory);
        if (items.length === 0) {
            inventoryHTML = '(Empty)';
        } else {
            items.forEach(itemType => {
                if (inventory[itemType] > 0) {
                    // Capitalize item type for display
                    const displayName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
                    inventoryHTML += `<li>${displayName}: ${inventory[itemType]}</li>`;
                }
            });
             if (inventoryHTML === '') inventoryHTML = '(Empty)'; // Handle case where items exist but count is 0
        }
        inventoryListEl.innerHTML = inventoryHTML;
    }
     // Update Sword Status
     if (swordStatusEl) {
         swordStatusEl.textContent = hasSword ? "Sword: Acquired!" : "Sword: Not Found";
         swordStatusEl.style.color = hasSword ? "#aaffaa" : "#ffaaaa"; // Green if has sword, red otherwise
     }
}

// --- Game Over Handling ---

export function updateGameOverState(isGameOver, wavesSurvived = 0) {
    if (restartButtonEl) {
        restartButtonEl.style.display = isGameOver ? 'inline-block' : 'none';
    }
    if (isGameOver) {
        console.log(`UI: Displaying Game Over elements - Waves: ${wavesSurvived}`);

    }
}