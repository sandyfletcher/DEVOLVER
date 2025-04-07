// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar, Canvas Setup, and Drawing Operations
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- DOM Element References ---
// Cache elements for performance
let waveStatusEl, waveTimerEl, enemyCountEl;
let healthBoxesEl;
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
    enemyCountEl = document.getElementById('enemy-count'); // Optional element
    healthBoxesEl = document.getElementById('health-boxes');
    inventoryListEl = document.getElementById('inventory-list');
    swordStatusEl = document.getElementById('sword-status'); // Sword status element
    restartButtonEl = document.getElementById('restart-button');

    if (!waveStatusEl || !waveTimerEl || !healthBoxesEl || !inventoryListEl || !swordStatusEl || !restartButtonEl) {
        console.warn("UI Init: Could not find all expected UI elements in the DOM!");
    }
    console.log("UI Module Initialized (HTML Mode)");
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

    switch (waveInfo.state) {
        case 'PRE_WAVE':
            statusText = 'Get Ready...';
            timerText = `First Wave In: ${waveInfo.timer > 0 ? waveInfo.timer.toFixed(1) : '0.0'}s`;
            break;
        case 'SPAWNING':
            statusText = `Wave ${waveInfo.number} - Spawning`;
             // timerText = `Spawning... (${waveInfo.enemiesSpawned}/${waveInfo.enemiesToSpawn})`; // Example detail
             enemyText = `Enemies Remaining: ${livingEnemies}`; // Show living count
            break;
        case 'ACTIVE':
            statusText = `Wave ${waveInfo.number} - Active`;
            enemyText = `Enemies Remaining: ${livingEnemies}`;
            break;
        case 'INTERMISSION':
            statusText = `Wave ${waveInfo.number} Cleared!`;
            timerText = `Next Wave In: ${waveInfo.timer > 0 ? waveInfo.timer.toFixed(1) : '0.0'}s`;
            break;
        case 'GAME_OVER':
            statusText = 'GAME OVER';
            timerText = `Survived ${waveInfo.number} Waves`;
             enemyText = ''; // Clear enemy count
            break;
        default:
            statusText = 'Loading...';
    }

    waveStatusEl.textContent = statusText;
    waveTimerEl.textContent = timerText;
    if (enemyCountEl) { // Update optional enemy count display
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
    // Update Health Boxes
    if (healthBoxesEl) {
        let healthHTML = '';
        // Use PLAYER_MAX_HEALTH from config for total boxes
        for (let i = 0; i < Config.PLAYER_MAX_HEALTH; i++) {
            const boxClass = (i < currentHealth) ? 'full' : 'empty';
            // Use div elements for boxes
            healthHTML += `<div class="health-box ${boxClass}"></div>`;
        }
        healthBoxesEl.innerHTML = healthHTML;
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
/**
 * Updates the UI state based on whether the game is over.
 * @param {boolean} isGameOver - True if the game is over, false otherwise.
 * @param {number} [wavesSurvived=0] - Final wave number if game is over.
 */
export function updateGameOverState(isGameOver, wavesSurvived = 0) {
    if (restartButtonEl) {
        restartButtonEl.style.display = isGameOver ? 'inline-block' : 'none';
    }

    if (isGameOver) {
        // Optional: Update other UI elements to reflect game over state if needed
        // (e.g., clear timer, show final stats) - waveInfo update already covers some of this.
        console.log(`UI: Displaying Game Over elements - Waves: ${wavesSurvived}`);
    // } else {
        // Optional: Ensure any specific game over overlays are hidden
    }
}