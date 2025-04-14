// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar Elements and Updates
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- Cache DOM Element References ---

// Initialized Early (Overlay + Containers)
let gameOverlay = null; // Found by initOverlay
let appContainer = null; // Technically found in main.js, but useful if ui needs it
// References to overlay content sections (optional, found by initOverlay)
// let overlayTitleContent, overlayPauseContent, overlayGameOverContent;

// Initialized Later (Game UI Elements - found by initGameUI)
let waveStatusEl, waveTimerEl, enemyCountEl;
let healthLabelEl, healthBarContainerEl, healthBarFillEl, healthTextEl;
let inventoryBoxesEl; // Container for inventory items
let weaponSlotsEl;    // Container for weapon slots
// No need for restartButtonEl here, it's on the overlay now.

// --- Internal State ---
let playerRef = null; // Store player reference
// Store references to dynamically created/managed slots
const weaponSlotDivs = {}; // Use object: { [WEAPON_TYPE_SWORD]: divElement, ... }
const inventorySlotDivs = {}; // Use object: { 'dirt': divElement, 'stone': divElement, ... }

const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL]; // Define order

// --- Initialization ---

/**
 * Initializes references to overlay elements. Called early during main page load.
 * @returns {boolean} True if successful, false otherwise.
 */
export function initOverlay() {
    // console.log("UI: Initializing Overlay Elements...");
    gameOverlay = document.getElementById('game-overlay');
    // Optionally get references to overlay content sections if needed elsewhere in UI
    // overlayTitleContent = document.getElementById('overlay-title-content');
    // overlayPauseContent = document.getElementById('overlay-pause-content');
    // overlayGameOverContent = document.getElementById('overlay-gameover-content');

    if (!gameOverlay /* || !overlayTitleContent || ... */) {
        console.error("UI InitOverlay: Could not find core overlay elements!");
        return false;
    }
    // console.log("UI: Overlay Elements Initialized.");
    return true;
}

/**
 * Initializes references to game-specific UI elements (sidebars, etc.)
 * AND creates the static parts of the game UI (like weapon slots).
 * Called when the game actually starts (e.g., startGame in main.js).
 * @returns {boolean} True if successful, false otherwise.
 */
export function initGameUI() {
    // console.log("UI: Initializing Game UI Elements...");
    let success = true;

    // --- Find Game-Specific Elements ---
    waveStatusEl = document.getElementById('wave-status');
    waveTimerEl = document.getElementById('wave-timer');
    enemyCountEl = document.getElementById('enemy-count');
    healthBarContainerEl = document.getElementById('health-bar-container');
    healthBarFillEl = document.getElementById('health-bar-fill');
    healthTextEl = document.getElementById('health-text');
    inventoryBoxesEl = document.getElementById('inventory-boxes'); // Container
    weaponSlotsEl = document.getElementById('weapon-slots');       // Container
    healthLabelEl = document.getElementById('health-label');

    // --- Verification ---
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl || !healthBarContainerEl ||
        !healthBarFillEl || !healthTextEl || !inventoryBoxesEl || !weaponSlotsEl) {
        console.warn("UI InitGameUI: Could not find all expected game UI elements!");
        success = false;

        // Log specifics
        if (!weaponSlotsEl) console.error("UI InitGameUI: Failed to find #weapon-slots container");
        if (!inventoryBoxesEl) console.error("UI InitGameUI: Failed to find #inventory-boxes container");
        // Add more specific logs if needed
    }

    // --- Create Static UI Parts (like weapon slots) ---
    // Clear previous slots if any (e.g., from a restart)
    if (weaponSlotsEl) {
        weaponSlotsEl.innerHTML = ''; // Clear placeholder/previous content
        // Clear stored references from previous game instance
        for (const key in weaponSlotDivs) delete weaponSlotDivs[key];

        for (const weaponType of WEAPON_SLOTS_ORDER) {
            const slotDiv = document.createElement('div');
            slotDiv.classList.add('weapon-slot-box');
            slotDiv.dataset.weapon = weaponType;
            slotDiv.title = weaponType.toUpperCase();

            // Assign initial icons/content
            if (weaponType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
            else if (weaponType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑'; // Consider better spear icon maybe
            else if (weaponType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️';
            else slotDiv.textContent = '?';

            slotDiv.classList.add('disabled'); // Start disabled
            slotDiv.style.cursor = 'default';

            weaponSlotsEl.appendChild(slotDiv);
            weaponSlotDivs[weaponType] = slotDiv; // Store reference for updates

            // Add click listener - checks playerRef *inside* the handler
            slotDiv.addEventListener('click', () => {
                if (playerRef && playerRef.hasWeapon(weaponType)) {
                    playerRef.equipItem(weaponType); // Use equipItem which handles logic
                } else if (!playerRef) {
                    console.error("UI Weapon Click: playerRef is null!");
                } else {
                     console.log(`UI Weapon Click: Player cannot equip ${weaponType}. Not possessed.`);
                     // Maybe add a visual cue like shaking the icon?
                }
            });
        }
    } else {
         // This case should be caught by the verification above, but double-check
         console.error("UI InitGameUI: Could not create weapon slots - #weapon-slots container missing.");
         success = false;
    }

    // --- Clear Inventory Placeholder & References ---
    if (inventoryBoxesEl) {
        inventoryBoxesEl.innerHTML = '';
        // Clear stored references from previous game instance
        for (const key in inventorySlotDivs) delete inventorySlotDivs[key];
    } else {
        console.error("UI InitGameUI: Could not clear inventory - #inventory-boxes container missing.");
        success = false;
    }

    if (success) {
        // console.log("UI: Game UI Elements Initialized.");
    } else {
        console.error("UI: Failed to initialize some critical Game UI elements.");
    }
    return success;
}

// --- Player Reference ---
export function setPlayerReference(playerObject) {
    playerRef = playerObject;
    // console.log("UI: Player reference set.");
}

// --- Update Functions (Mostly Unchanged, but rely on elements found in initGameUI) ---

export function updateWaveInfo(waveInfo = {}, livingEnemies = 0) {
    // Check elements exist before using
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl) {
        // console.warn("UI: Cannot update wave info, elements not found.");
        return;
    }
    // ... (rest of the logic remains the same) ...
    let statusText = '';
    let timerText = '';
    let enemyText = '';

    if (waveInfo.isGameOver) {
        statusText = 'GAME OVER';
        timerText = `Survived ${waveInfo.mainWaveNumber > 0 ? waveInfo.mainWaveNumber - 1 : 0} Waves`;
    } else if (waveInfo.allWavesCleared) {
        statusText = 'VICTORY!';
        timerText = 'All Waves Cleared!';
    } else {
        statusText = `Wave ${waveInfo.mainWaveNumber || 1}`;
        if (waveInfo.timerLabel && waveInfo.timer > 0) {
            timerText = `${waveInfo.timerLabel} ${waveInfo.timer.toFixed(1)}s`;
        } else {
            timerText = waveInfo.progressText || '';
        }
        if (waveInfo.state === 'ACTIVE' || waveInfo.state === 'SPAWNING') {
            enemyText = `Enemies Remaining: ${livingEnemies}`;
        }
    }

    waveStatusEl.textContent = statusText;
    waveTimerEl.textContent = timerText;
    enemyCountEl.textContent = enemyText;
}

export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
    // Check required elements exist
    if (!healthBarFillEl || !healthTextEl || !inventoryBoxesEl || !weaponSlotsEl) {
         // console.warn("UI: Cannot update player info, critical elements missing.");
         return;
    }
    if (!playerRef) {
        // console.warn("UI Update: playerRef is not set yet.");
        return;
    }

    // --- Update Health Bar ---
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    healthBarFillEl.style.width = `${healthPercent}%`;
    healthTextEl.textContent = `${Math.round(clampedHealth)}/${maxHealth}`;

    const selectedItem = playerRef.getCurrentlySelectedItem();

    // --- Update Inventory Slots (Create/Update) ---
    // (Logic remains largely the same as provided in your file, ensuring elements exist now)
    for (const materialType of Config.INVENTORY_MATERIALS) {
        const count = inventory[materialType] || 0;
        let invSlotDiv = inventorySlotDivs[materialType];

        if (!invSlotDiv) {
            invSlotDiv = document.createElement('div');
            invSlotDiv.classList.add('inventory-item-box');
            invSlotDiv.dataset.material = materialType;

            const itemConfig = Config.ITEM_CONFIG[materialType];
            invSlotDiv.style.backgroundColor = itemConfig?.color || '#444';

            const countSpan = document.createElement('span');
            countSpan.classList.add('inventory-item-count');
            invSlotDiv.appendChild(countSpan);

            invSlotDiv.addEventListener('click', () => {
                const currentCount = playerRef?.inventory[materialType] || 0;
                if (playerRef && currentCount > 0) {
                    playerRef.equipItem(materialType);
                }
            });

            inventoryBoxesEl.appendChild(invSlotDiv);
            inventorySlotDivs[materialType] = invSlotDiv;
        }

        const countSpan = invSlotDiv.querySelector('.inventory-item-count');
        countSpan.textContent = count > 0 ? Math.min(count, 999) : ''; // Max display count
        invSlotDiv.title = `${materialType.toUpperCase()} (Count: ${count})`;

        if (count === 0) {
            invSlotDiv.classList.add('disabled');
            invSlotDiv.style.cursor = 'default';
            invSlotDiv.style.opacity = '0.5';
        } else {
            invSlotDiv.classList.remove('disabled');
            invSlotDiv.style.cursor = 'pointer';
            invSlotDiv.style.opacity = '1';
        }

        invSlotDiv.classList.toggle('active', selectedItem === materialType);
    }

    // --- Update Weapon Slots (Possession & Active State) ---
    const playerPossession = {
        [Config.WEAPON_TYPE_SWORD]: hasSword,
        [Config.WEAPON_TYPE_SPEAR]: hasSpear,
        [Config.WEAPON_TYPE_SHOVEL]: hasShovel,
    };

    for (const weaponType of WEAPON_SLOTS_ORDER) {
        const slotDiv = weaponSlotDivs[weaponType];
        if (!slotDiv) {
             console.warn(`UI Update: Weapon slot div not found for ${weaponType}`);
             continue;
        }

        const possessed = playerPossession[weaponType];

        slotDiv.classList.toggle('disabled', !possessed);
        slotDiv.classList.toggle('active', possessed && selectedItem === weaponType);
        slotDiv.style.cursor = possessed ? 'pointer' : 'default';
        slotDiv.style.opacity = possessed ? '1' : '0.4';
        slotDiv.title = possessed ? weaponType.toUpperCase() : `${weaponType.toUpperCase()} (Not Found)`;
        // Icon textContent should remain as set during initGameUI
    }
}


/**
 * Handles showing/hiding the correct UI elements based on game over state.
 * NOTE: This is now mostly handled by the Overlay system in main.js.
 * This function might become obsolete or only handle minor sidebar tweaks.
 * @param {boolean} isGameOver - True if the game is over.
 * @param {number} [wavesSurvived=0] - The number of waves survived (optional).
 */
export function updateGameOverState(isGameOver, wavesSurvived = 0) {
    // Example: If you had a specific "Game Over" message area in a sidebar
    // const gameOverMessageEl = document.getElementById('sidebar-gameover-message');
    // if (gameOverMessageEl) {
    //     gameOverMessageEl.style.display = isGameOver ? 'block' : 'none';
    //     if (isGameOver) gameOverMessageEl.textContent = `Game Over! Waves: ${wavesSurvived}`;
    // }

    // The overlay restart button is handled in main.js by showing/hiding the overlay itself.
    console.log("UI: updateGameOverState called (now likely handled by overlay). State:", isGameOver);
}

// --- Add functions to update other UI elements as needed ---