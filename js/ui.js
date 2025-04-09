// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar, Canvas Setup, and Drawing Operations
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- Cache DOM Element References for Performance ---
let waveStatusEl, waveTimerEl, enemyCountEl;
let healthLabelEl, healthBarContainerEl, healthBarFillEl, healthTextEl;
let inventoryBoxesEl;
let weaponSlotsEl;
let gameOverOverlayEl, gameOverWaveEl, playAgainBtnEl; // Game Over (assuming overlay structure later)
let restartButtonEl;
let playerRef = null; // Store player reference for weapon switching
let itemManagerRef = null; // Store item manager reference if needed

// --- Configuration for UI elements ---
const INVENTORY_MATERIALS = ['wood', 'stone', 'metal']; // Materials to display
const WEAPON_SLOTS = ['sword']; // Weapons to display slots for

// --- Initialize UI module references ---
export function init() {
    waveStatusEl = document.getElementById('wave-status');
    waveTimerEl = document.getElementById('wave-timer');
    enemyCountEl = document.getElementById('enemy-count');
    healthLabelEl = document.getElementById('health-label'); // Keep label ref if needed elsewhere
    healthBarContainerEl = document.getElementById('health-bar-container');
    healthBarFillEl = document.getElementById('health-bar-fill');
    healthTextEl = document.getElementById('health-text');
    inventoryBoxesEl = document.getElementById('inventory-boxes'); // UPDATED
    weaponSlotsEl = document.getElementById('weapon-slots'); // NEW
    restartButtonEl = document.getElementById('restart-button');
// check for proper loading
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl || !healthLabelEl || !healthBarContainerEl || !healthBarFillEl|| !healthTextEl || !restartButtonEl) {
        console.error("UI Init: Could not find all expected UI elements in the DOM!");
    }
}

// --- Update Wave Information Display ---
export function updateWaveInfo(waveInfo = {}, livingEnemies = 0) {
    if (!waveStatusEl || !waveTimerEl) return; // not found
    let statusText = '';
    let timerText = '';
    let enemyText = '';
    if (waveInfo.isGameOver) {
        statusText = 'GAME OVER';
// pass final wave number to game over screen separately
        timerText = `Survived ${waveInfo.mainWaveNumber > 0 ? waveInfo.mainWaveNumber -1 : 0} Waves`; // Show completed waves
    } else if (waveInfo.allWavesCleared) {
        statusText = 'VICTORY!';
        timerText = 'All Waves Cleared!';
    } else {
// gameplay states:
        statusText = `Wave ${waveInfo.mainWaveNumber || 1}`; // Show current main wave
        if (waveInfo.timerLabel && waveInfo.timer > 0) {
            timerText = `${waveInfo.timerLabel} ${waveInfo.timer.toFixed(1)}s`;
        } else {
             timerText = waveInfo.progressText || ''; // Show spawning progress or clear message
        }
        if (waveInfo.state === 'ACTIVE' || waveInfo.state === 'SPAWNING') {
            enemyText = `Enemies Remaining: ${livingEnemies}`;
        } else {
             enemyText = ''; // No count during intermissions
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
    if (inventoryBoxesEl) {
            let inventoryHTML = '';
            for (const materialType of INVENTORY_MATERIALS) {
            const count = inventory[materialType] || 0;
            const maxDisplayCount = 999;
            const displayCount = Math.min(count, maxDisplayCount);
// Fetch color from ITEM_CONFIG (requires basic configs added earlier)
            const itemConfig = Config.ITEM_CONFIG[materialType];
            const bgColor = itemConfig?.color || '#444'; // Fallback color

            inventoryHTML += `
                <div class="inventory-item-box" style="background-color: ${bgColor};" title="${materialType.toUpperCase()}">
                    <span class="inventory-item-count">${displayCount}</span>
                </div>
            `;
        }
        inventoryBoxesEl.innerHTML = inventoryHTML;
    }
    // Update Weapon Slots (Initial Structure)
    if (weaponSlotsEl && playerRef) { // Check if playerRef is set
        weaponSlotsEl.innerHTML = ''; // Clear previous slots

        for (const weaponType of WEAPON_SLOTS) {
            const slotDiv = document.createElement('div');
            slotDiv.classList.add('weapon-slot-box');
            slotDiv.dataset.weapon = weaponType; // Store weapon type
            slotDiv.title = weaponType.toUpperCase(); // Tooltip

            let hasWeapon = false;
            if (weaponType === 'sword' && playerRef.hasSword) {
                hasWeapon = true;
                slotDiv.textContent = '⚔️'; // Simple representation for now
            }
            // Add else if for other weapons later

            if (hasWeapon) {
                slotDiv.addEventListener('click', () => playerRef.equipWeapon(weaponType));
                if (playerRef.selectedWeapon === weaponType) {
                     slotDiv.classList.add('active'); // Add yellow border if active
                }
            }
            weaponSlotsEl.appendChild(slotDiv);
        }
    }
}

/**
 * Stores a reference to the player object. Needed for weapon switching callbacks.
 * @param {Player} playerObject - The main player instance.
 */
export function setPlayerReference(playerObject) {
        playerRef = playerObject;
        // console.log("UI: Player reference set.");
        // Initial update might be needed if player loaded before UI init
        // updatePlayerInfo(playerRef.getCurrentHealth(), playerRef.getMaxHealth(), playerRef.getInventory(), playerRef.getSwordStatus());
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