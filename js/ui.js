// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar Elements and Updates
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- Cache DOM Element References ---
let waveStatusEl, waveTimerEl, enemyCountEl;
let healthLabelEl, healthBarContainerEl, healthBarFillEl, healthTextEl;
let inventoryBoxesEl;
let weaponSlotsEl;
let restartButtonEl;
let playerRef = null; // Store player reference

// --- Store references to dynamic slot divs ---
const weaponSlotDivs = {}; // Use object: { [WEAPON_TYPE_SWORD]: divElement, ... }
const inventorySlotDivs = {}; // Use object: { 'dirt': divElement, 'stone': divElement, ... }

const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL]; // Define order

// --- Initialize UI module references ---
export function init() {
    // Get static element references
    waveStatusEl = document.getElementById('wave-status');
    waveTimerEl = document.getElementById('wave-timer');
    enemyCountEl = document.getElementById('enemy-count');
    healthBarContainerEl = document.getElementById('health-bar-container');
    healthBarFillEl = document.getElementById('health-bar-fill');
    healthTextEl = document.getElementById('health-text');
    inventoryBoxesEl = document.getElementById('inventory-boxes');
    weaponSlotsEl = document.getElementById('weapon-slots');
    restartButtonEl = document.getElementById('restart-button');
    healthLabelEl = document.getElementById('health-label'); // Kept if needed later

    // Check if all static elements were found
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl || !healthBarContainerEl || !healthBarFillEl || !healthTextEl || !inventoryBoxesEl || !weaponSlotsEl || !restartButtonEl) {
        console.error("UI Init: Could not find all expected static UI elements!");
    }

    // Build fixed weapon slot UI once
    if (weaponSlotsEl) {
        weaponSlotsEl.innerHTML = ''; // Clear placeholder
        for (const weaponType of WEAPON_SLOTS_ORDER) {
            const slotDiv = document.createElement('div');
            slotDiv.classList.add('weapon-slot-box');
            slotDiv.dataset.weapon = weaponType; // Use data attributes
            slotDiv.title = weaponType.toUpperCase();

            // Assign initial icons
            if (weaponType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
            else if (weaponType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑';
            else if (weaponType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️';
            else slotDiv.textContent = '?';

            // Add initial disabled styling (will be updated later)
            slotDiv.classList.add('disabled');
            slotDiv.style.cursor = 'default';

            weaponSlotsEl.appendChild(slotDiv);
            weaponSlotDivs[weaponType] = slotDiv; // Store reference

            // Add click listener (using closure to capture weaponType)
            slotDiv.addEventListener('click', () => {
                // console.log(`--- CLICKED on ${weaponType} weapon slot! ---`);
                if (playerRef && playerRef.hasWeapon(weaponType)) { // Check possession *before* equipping
                    playerRef.equipItem(weaponType);
                } else if (!playerRef) {
                    console.error("UI Click: playerRef is null!");
                } else {
                    // console.log(`UI Click: Player cannot equip ${weaponType}. Possession check failed.`);
                }
            });
        }
    } else {
        console.error("UI Init: Could not find #weapon-slots element!");
    }

    // Clear inventory placeholder (slots created dynamically in update)
    if (inventoryBoxesEl) {
        inventoryBoxesEl.innerHTML = '';
    }
}

// --- Update Wave Information Display ---
export function updateWaveInfo(waveInfo = {}, livingEnemies = 0) {
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl) return;

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

/**
 * Updates the Player Status (Health, Inventory, Equipped Item) in the right sidebar.
 * @param {number} currentHealth - Player's current health.
 * @param {number} maxHealth - Player's max health.
 * @param {object} inventory - Player's inventory { itemType: count }.
 * @param {boolean} hasSword - Whether the player has the sword.
 * @param {boolean} hasSpear - Whether the player has the spear.
 * @param {boolean} hasShovel - Whether the player has the shovel.
 */
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
    if (!playerRef) {
        // console.warn("UI Update: playerRef is not set yet.");
        return; // Cannot update UI without player reference
    }

    // --- Update Health Bar ---
    if (healthBarFillEl && healthTextEl) {
        const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
        const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
        healthBarFillEl.style.width = `${healthPercent}%`;
        healthTextEl.textContent = `${Math.round(clampedHealth)}/${maxHealth}`;
    }

    const selectedItem = playerRef.getCurrentlySelectedItem();

    // --- Update Inventory Slots (Create/Update) ---
    if (inventoryBoxesEl) {
        // Keep track of which slots were updated to remove unused ones later if needed (optional)
        // const updatedMaterials = new Set();

        for (const materialType of Config.INVENTORY_MATERIALS) {
            // updatedMaterials.add(materialType);
            const count = inventory[materialType] || 0;
            let invSlotDiv = inventorySlotDivs[materialType]; // Try to get existing div

            // If div doesn't exist, create it
            if (!invSlotDiv) {
                invSlotDiv = document.createElement('div');
                invSlotDiv.classList.add('inventory-item-box');
                invSlotDiv.dataset.material = materialType; // Store material type

                const itemConfig = Config.ITEM_CONFIG[materialType];
                const bgColor = itemConfig?.color || '#444';
                invSlotDiv.style.backgroundColor = bgColor;

                const countSpan = document.createElement('span');
                countSpan.classList.add('inventory-item-count');
                invSlotDiv.appendChild(countSpan);

                // Add click listener only once during creation
                invSlotDiv.addEventListener('click', () => {
                    // Check current count from playerRef *at time of click*
                    const currentCount = playerRef?.inventory[materialType] || 0;
                    if (playerRef && currentCount > 0) {
                        playerRef.equipItem(materialType);
                    } else {
                        // console.log(`Cannot equip ${materialType}, count is 0 or playerRef missing.`);
                    }
                });

                inventoryBoxesEl.appendChild(invSlotDiv);
                inventorySlotDivs[materialType] = invSlotDiv; // Store new reference
            }

            // Update content and style based on current state
            const countSpan = invSlotDiv.querySelector('.inventory-item-count');
            const maxDisplayCount = 999;
            const displayCount = Math.min(count, maxDisplayCount);
            countSpan.textContent = displayCount > 0 ? displayCount : '';
            invSlotDiv.title = `${materialType.toUpperCase()} (Count: ${count})`;

            // Apply 'disabled' style if count is 0
            if (count === 0) {
                invSlotDiv.classList.add('disabled'); // Add a CSS class for styling 0-count items
                invSlotDiv.style.cursor = 'default';
                 invSlotDiv.style.opacity = '0.5'; // Example disabled style
            } else {
                invSlotDiv.classList.remove('disabled');
                invSlotDiv.style.cursor = 'pointer';
                invSlotDiv.style.opacity = '1';
            }

            // Apply 'active' class if this material is selected
            if (selectedItem === materialType) {
                invSlotDiv.classList.add('active');
            } else {
                invSlotDiv.classList.remove('active');
            }
        }
         // Optional: Remove divs for materials that are no longer in Config.INVENTORY_MATERIALS
         // for (const matKey in inventorySlotDivs) {
         //    if (!updatedMaterials.has(matKey)) {
         //       inventorySlotDivs[matKey].remove();
         //       delete inventorySlotDivs[matKey];
         //    }
         // }
    }

    // --- Update Weapon Slots (Possession & Active State) ---
    const playerPossession = { // Helper object for clarity
        [Config.WEAPON_TYPE_SWORD]: hasSword,
        [Config.WEAPON_TYPE_SPEAR]: hasSpear,
        [Config.WEAPON_TYPE_SHOVEL]: hasShovel,
    };

    for (const weaponType of WEAPON_SLOTS_ORDER) {
        const slotDiv = weaponSlotDivs[weaponType];
        if (!slotDiv) continue; // Skip if div doesn't exist

        const possessed = playerPossession[weaponType];

        if (possessed) {
            slotDiv.classList.remove('disabled');
            slotDiv.style.opacity = '1';
            slotDiv.style.cursor = 'pointer';
            slotDiv.title = weaponType.toUpperCase();
            // Icon is set during init, no need to reset textContent here

            if (selectedItem === weaponType) {
                slotDiv.classList.add('active');
            } else {
                slotDiv.classList.remove('active');
            }
        } else {
            // Not possessed - ensure disabled state
            slotDiv.classList.add('disabled');
            slotDiv.classList.remove('active'); // Ensure not active
            slotDiv.style.opacity = '0.4';
            slotDiv.style.cursor = 'default';
            slotDiv.title = `${weaponType.toUpperCase()} (Not Found)`;
            // Maybe clear textContent if you prefer no icon when disabled?
            // slotDiv.textContent = '';
        }
    }
}

/**
 * Stores a reference to the player object.
 * @param {Player} playerObject - The main player instance.
 */
export function setPlayerReference(playerObject) {
    playerRef = playerObject;
    // console.log("UI: Player reference set.");
}

// --- Game Over Handling ---
export function updateGameOverState(isGameOver, wavesSurvived = 0) {
    if (restartButtonEl) {
        restartButtonEl.style.display = isGameOver ? 'inline-block' : 'none';
    }
    // if (isGameOver) { console.log(`UI: Displaying Game Over elements - Waves: ${wavesSurvived}`); }
}