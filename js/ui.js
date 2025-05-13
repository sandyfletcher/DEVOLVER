// root/js/ui.js - Manages HTML Sidebar Elements and Updates

import * as Config from './utils/config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';

// --- DOM Element References ---

// Top Sidebar
let topSidebarEl = null;
let playerColumnEl, portalColumnEl;
let playerHealthBarContainerEl, playerHealthBarFillEl;
let portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl;
let timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl;

// Bottom Sidebar
let bottomSidebarEl;
let itemSelectionAreaEl;
let inventoryBoxesContainerEl, weaponSlotsContainerEl;

// --- REMOVED Action Buttons References ---
// let actionButtonsAreaEl;
// let toggleControlsButtonEl;
// export let actionButtons = {}; // REMOVED

// --- NEW Settings Menu References ---
let settingsBtnToggleGrid = null;
let settingsBtnMuteMusic = null;
let settingsBtnMuteSfx = null;
let settingsValueGrid = null;
let settingsValueMusic = null;
let settingsValueSfx = null;

// Overlay
let bootOverlayEl = null;
let epochOverlayEl = null;

// --- Internal State ---
let playerRef = null;
let portalRef = null;
const itemSlotDivs = {};
// --- REMOVED Illumination Timer ---
// let buttonIlluminationTimers = {};
// const ILLUMINATION_DURATION = 150;

const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL];
let isUIReady = false;

// --- Initialization ---

export function initOverlay() {
    bootOverlayEl = document.getElementById('boot-overlay');
    if (!bootOverlayEl) {
        console.error("UI InitOverlay: Could not find core boot overlay element!");
        return false;
    }
    return true;
}

export function initGameUI() {
    let success = true;

    // --- Find Top Sidebar Elements ---
    topSidebarEl = document.getElementById('top-sidebar');
    playerColumnEl = document.getElementById('player-column');
    portalColumnEl = document.getElementById('portal-column');
    playerHealthBarContainerEl = document.getElementById('player-health-bar-container');
    playerHealthBarFillEl = document.getElementById('player-health-bar-fill');
    portalColumnH2El = document.getElementById('portal-health-title');
    portalHealthBarContainerEl = document.getElementById('portal-health-bar-container');
    portalHealthBarFillEl = document.getElementById('portal-health-bar-fill');
    timerRowEl = document.getElementById('timer-row');
    timerBarContainerEl = document.getElementById('timer-bar-container');
    timerBarFillEl = document.getElementById('timer-bar-fill');
    timerTextOverlayEl = document.getElementById('timer-text-overlay');

    // --- Find Bottom Sidebar Elements ---
    bottomSidebarEl = document.getElementById('bottom-sidebar');
    itemSelectionAreaEl = document.getElementById('item-selection-area');
    inventoryBoxesContainerEl = document.getElementById('inventory-boxes-container');
    weaponSlotsContainerEl = document.getElementById('weapon-slots-container');

    // --- REMOVED Finding Action Button Elements ---
    // actionButtonsAreaEl = document.getElementById('action-buttons-area');
    // toggleControlsButtonEl = document.getElementById('toggle-controls-button');
    // actionButtons.left = document.getElementById('btn-move-left');
    // ... etc ...

    // --- NEW: Find Settings Menu Elements ---
    settingsBtnToggleGrid = document.getElementById('settings-btn-toggle-grid');
    settingsBtnMuteMusic = document.getElementById('settings-btn-mute-music');
    settingsBtnMuteSfx = document.getElementById('settings-btn-mute-sfx');
    settingsValueGrid = document.getElementById('settings-value-grid');
    settingsValueMusic = document.getElementById('settings-value-music');
    settingsValueSfx = document.getElementById('settings-value-sfx');

    // Find Epoch Overlay Element
    epochOverlayEl = document.getElementById('epoch-overlay');

    // --- Verification ---
    const requiredElements = [
        topSidebarEl, playerColumnEl, portalColumnEl,
        playerHealthBarContainerEl, playerHealthBarFillEl,
        portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl,
        timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl,
        bottomSidebarEl, itemSelectionAreaEl, inventoryBoxesContainerEl, weaponSlotsContainerEl,
        // REMOVED: actionButtonsAreaEl, toggleControlsButtonEl, actionButtons...
        // NEW: Check settings elements
        settingsBtnToggleGrid, settingsBtnMuteMusic, settingsBtnMuteSfx,
        settingsValueGrid, settingsValueMusic, settingsValueSfx,
        epochOverlayEl
    ];

    if (requiredElements.some(el => !el)) {
        console.error("UI InitGameUI: Could not find all expected game UI elements!");
        const elementNames = [
            'topSidebarEl', 'playerColumnEl', 'portalColumnEl',
            'playerHealthBarContainerEl', 'playerHealthBarFillEl',
            'portalColumnH2El', 'portalHealthBarContainerEl', 'portalHealthBarFillEl',
            'timerRowEl', 'timerBarContainerEl', 'timerBarFillEl', 'timerTextOverlayEl',
            'bottomSidebarEl', 'itemSelectionAreaEl', 'inventoryBoxesContainerEl', 'weaponSlotsContainerEl',
            // NEW: Check settings elements
            'settingsBtnToggleGrid', 'settingsBtnMuteMusic', 'settingsBtnMuteSfx',
            'settingsValueGrid', 'settingsValueMusic', 'settingsValueSfx',
            'epochOverlayEl'
        ];
        requiredElements.forEach((el, index) => {
            if (!el) console.error(`Missing UI element: ${elementNames[index]}`);
        });
        success = false;
    }

    // --- Clear previous dynamic content and listeners ---
    if (inventoryBoxesContainerEl) inventoryBoxesContainerEl.innerHTML = 'Loading...';
    if (weaponSlotsContainerEl) weaponSlotsContainerEl.innerHTML = '';

    for (const key in itemSlotDivs) {
        delete itemSlotDivs[key];
    }
    // REMOVED: Clear buttonIlluminationTimers

    // --- Create Item/Weapon Selection Boxes Dynamically ---
    if (inventoryBoxesContainerEl && weaponSlotsContainerEl) {
        inventoryBoxesContainerEl.innerHTML = '';
        weaponSlotsContainerEl.innerHTML = '';

        for (const materialType of Config.INVENTORY_MATERIALS) {
            createItemSlot(materialType, inventoryBoxesContainerEl, 'material');
        }
        for (const weaponType of WEAPON_SLOTS_ORDER) {
            createItemSlot(weaponType, weaponSlotsContainerEl, 'weapon');
        }
    } else {
        success = false;
    }

    // --- Set Initial States and Add Event Listeners ---
    if (success) {
        // --- REMOVED: Toggle controls button listener ---
        // if(toggleControlsButtonEl) { ... }

        // --- NEW: Add Event Listeners for Settings Buttons ---
        settingsBtnToggleGrid.addEventListener('click', () => {
            if (typeof window.toggleGridDisplay === 'function') {
                window.toggleGridDisplay();
            } else {
                console.error("UI Error: toggleGridDisplay function not found on window.");
            }
        });
        settingsBtnMuteMusic.addEventListener('click', () => {
            if (typeof window.toggleMusicMute === 'function') {
                window.toggleMusicMute();
            } else {
                console.error("UI Error: toggleMusicMute function not found on window.");
            }
        });
        settingsBtnMuteSfx.addEventListener('click', () => {
            if (typeof window.toggleSfxMute === 'function') {
                window.toggleSfxMute();
            } else {
                console.error("UI Error: toggleSfxMute function not found on window.");
            }
        });

        // Initial states
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false);
        updatePortalInfo(0, Config.PORTAL_INITIAL_HEALTH);
        updateWaveTimer({ state: 'LOADING', timer: 0, maxTimer: 1, progressText: "Loading...", mainWaveNumber: 0 });

        // Initial settings button states are set by main.js after AudioManager.init

        isUIReady = true;
    } else {
        isUIReady = false;
        console.error("UI: Failed to initialize some critical Game UI elements.");
    }

    return success;
}

// Helper to create and setup a single item/weapon slot div (no changes needed here)
function createItemSlot(itemType, container, category) {
    // ... (keep existing implementation) ...
     // Ensure container element exists before trying to append
     if (!container) {
        console.error(`UI createItemSlot: Container element is null for type "${itemType}".`);
        return;
    }

    const slotDiv = document.createElement('div');
    slotDiv.classList.add('item-box');
    slotDiv.dataset.item = itemType; // Store item type
    slotDiv.dataset.category = category; // Store category (material/weapon)
    slotDiv.classList.add('disabled'); // Start disabled by default, updatePlayerInfo will enable

    const itemConfig = Config.ITEM_CONFIG[itemType];
    let titleText = itemType.toUpperCase(); // Base title for hover

    if (category === 'material') {
        slotDiv.style.backgroundColor = itemConfig?.color || '#444'; // Use config color or default

        const countSpan = document.createElement('span'); // Span for count overlay
        countSpan.classList.add('item-count');
        countSpan.textContent = ''; // Start empty text
        slotDiv.appendChild(countSpan); // Add count span first for z-index behavior

        titleText += ' (0)'; // Initial title for materials includes count

        // --- NEW: Add quadrants for dirt and vegetation ---
        if (itemType === 'dirt' || itemType === 'vegetation') {
            slotDiv.classList.add('material-quadrant-box'); // Special class for styling parent
            const quadrantContainer = document.createElement('div');
            quadrantContainer.classList.add('quadrant-container');

            // Define specific classes for easier targeting if needed, though direct child selectors work
            const quadrantClasses = ['quadrant-tl', 'quadrant-tr', 'quadrant-bl', 'quadrant-br'];
            quadrantClasses.forEach(qClassSuffix => {
                const quadrantDiv = document.createElement('div');
                quadrantDiv.classList.add('quadrant', qClassSuffix); // e.g. quadrant quadrant-tl
                quadrantContainer.appendChild(quadrantDiv);
            });
            // Quadrant container will be visually behind the countSpan due to z-index in CSS
            slotDiv.insertBefore(quadrantContainer, countSpan); // Insert before, effectively behind due to z-index
        }
        // --- END NEW ---

    } else if (category === 'weapon') {
        // Add specific text content (icons) for weapons
        if (itemType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
        else if (itemType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑';
        else if (itemType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️';
        else if (itemType === Config.WEAPON_TYPE_UNARMED) slotDiv.textContent = '👊';
        else slotDiv.textContent = '?'; // Fallback icon

        titleText += ' (Not Found)'; // Placeholder, will be updated by updatePlayerInfo
    }

    slotDiv.title = titleText; // Set initial title attribute

    slotDiv.addEventListener('click', () => {
        handleItemSlotClick(itemType, category);
    });

    container.appendChild(slotDiv);
    itemSlotDivs[itemType] = slotDiv;
}

// Helper function to handle clicks on item/weapon slots (no changes needed here)
function handleItemSlotClick(itemType, category) {
    // ... (keep existing implementation) ...
     // Ensure playerRef exists and UI is ready before allowing interaction
     if (!playerRef || !isUIReady) {
        // console.log("UI Item Click: Interaction ignored (playerRef null or UI not ready).");
        // Optional: Add visual feedback (e.g., shake) to the element that was clicked even if action wasn't performed
        const slotDiv = itemSlotDivs[itemType];
        if(slotDiv && typeof slotDiv.animate === 'function') {
            slotDiv.animate([
                { transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }
            ], { duration: 100, easing: 'ease-in-out' });
        }
        return; // Do nothing if player is not available or UI not ready
    }

    let success = false; // Flag to indicate if the player action (select/craft) was successful

    // Delegate the action logic to the Player instance methods
    if (category === 'material') {
        // Attempt to set the active inventory material
        success = playerRef.setActiveInventoryMaterial(itemType);
    } else if (category === 'weapon') {
        // Attempt to set the active weapon (this method now handles equip/craft/unequip)
        success = playerRef.setActiveWeapon(itemType);
    }

    // Optional: Add visual feedback for success/failure based on the player action result
    const slotDiv = itemSlotDivs[itemType];
    if(slotDiv && typeof slotDiv.animate === 'function') {
        if (!success) {
            // Visual shake for failed interaction (e.g., cannot craft, cannot select empty material)
            // This provides feedback even if the slot was visually enabled (e.g. 'Click to Craft' but then materials were used just before click)
            slotDiv.animate([
                { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' },
                { transform: 'translateX(-3px)' }, { transform: 'translateX(0px)' }
            ], { duration: 200, easing: 'ease-in-out' });
        } else {
            // Visual feedback for successful interaction (e.g., pulse)
            slotDiv.animate([
                { transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }
            ], { duration: 150, easing: 'ease-out' });
        }
    }
}

// --- REMOVED toggleActionControls function ---
// export function toggleActionControls() { ... }

// Sets the reference to the player object (reset logic is fine)
export function setPlayerReference(playerObject) {
    // ... (keep existing implementation) ...
    playerRef = playerObject;
    // When player reference is set (on game start) or cleared (on game end), update UI
    if (playerRef) {
        // Request an initial update for player UI elements using current player data
        requestAnimationFrame(() => {
            updatePlayerInfo(
                playerRef.getCurrentHealth(), playerRef.getMaxHealth(),
                playerRef.getInventory(), playerRef.hasWeapon(Config.WEAPON_TYPE_SWORD),
                playerRef.hasWeapon(Config.WEAPON_TYPE_SPEAR), playerRef.hasWeapon(Config.WEAPON_TYPE_SHOVEL)
            );
        });
    } else {
        // Clear UI if player is removed (restart or game over)
        if (playerHealthBarFillEl) playerHealthBarFillEl.style.width = '0%';
        // Also reset inventory/weapon UI to initial disabled state
        // Loop through all known item slots and reset their state
        for(const key in itemSlotDivs){
            const slotDiv = itemSlotDivs[key];
            if(!slotDiv) continue; // Skip if element not found
            slotDiv.classList.remove('active'); // Remove active state
            slotDiv.classList.add('disabled'); // Re-disable all slots

            // Reset material counts
            if (slotDiv.dataset.category === 'material') {
                const countSpan = slotDiv.querySelector('.item-count');
                if (countSpan) countSpan.textContent = ''; // Clear counts
                slotDiv.title = `${key.toUpperCase()} (0)`; // Reset material title
            } else if (slotDiv.dataset.category === 'weapon') {
                // Reset weapon titles to 'Not Found' or initial crafting requirement
                // Need to determine the correct initial title based on craftability
                const isCraftable = Config.CRAFTING_RECIPES[key] !== undefined;
                if(isCraftable) {
                    const recipe = Config.CRAFTING_RECIPES[key];
                    let titleText = `${key.toUpperCase()} (Need: `;
                    titleText += recipe.map(ing => `${ing.amount} ${ing.type}`).join(', ');
                    titleText += ')';
                    slotDiv.title = titleText;
                } else {
                    slotDiv.title = `${key.toUpperCase()} (Not Found)`;
                }
            }
        }
    }
}

// Sets the reference to the portal object (no changes needed)
export function setPortalReference(portalObject) {
    // ... (keep existing implementation) ...
    portalRef = portalObject;
    // When portal reference is set (on game start) or cleared (on game end), update UI
    if (portalRef) {
        // Use rAF for initial update after portal is set
        requestAnimationFrame(() => {
            updatePortalInfo(portalRef.currentHealth, portalRef.maxHealth);
        });
    } else {
        // Clear UI if portal is removed (game over)
        if (portalHealthBarFillEl) portalHealthBarFillEl.style.width = '0%';
        if (portalColumnH2El) portalColumnH2El.style.color = 'white'; // Reset title color
        // Text content remains "PORTAL" as defined in HTML
    }
}

// --- REMOVED illuminateButton function ---
// export function illuminateButton(actionName) { ... }

// Updates the visual state (active/muted class) of settings buttons
// *** MODIFIED to target new elements and update text spans ***
export function updateSettingsButtonStates(isGridVisible, isMusicMuted, isSfxMuted) {
    // Ensure elements exist before modifying their classes/titles
    if (settingsBtnToggleGrid && settingsValueGrid) {
        settingsBtnToggleGrid.classList.toggle('active', isGridVisible);
        settingsBtnToggleGrid.title = isGridVisible ? 'Hide Grid Overlay' : 'Show Grid Overlay';
        settingsValueGrid.textContent = isGridVisible ? 'ON' : 'OFF';
        // Optionally change text color based on state
        settingsValueGrid.style.color = isGridVisible ? 'lime' : '#ccc';
    }
    if (settingsBtnMuteMusic && settingsValueMusic) {
        settingsBtnMuteMusic.classList.toggle('muted', isMusicMuted);
        settingsBtnMuteMusic.title = isMusicMuted ? 'Unmute Music' : 'Mute Music';
        settingsValueMusic.textContent = isMusicMuted ? 'MUTED' : 'ON';
        settingsValueMusic.style.color = isMusicMuted ? 'red' : 'lime';
    }
    if (settingsBtnMuteSfx && settingsValueSfx) {
        settingsBtnMuteSfx.classList.toggle('muted', isSfxMuted);
        settingsBtnMuteSfx.title = isSfxMuted ? 'Unmute SFX' : 'Mute SFX';
        settingsValueSfx.textContent = isSfxMuted ? 'MUTED' : 'ON';
        settingsValueSfx.style.color = isSfxMuted ? 'red' : 'lime';
    }
}

// --- Update Functions (Called by main.js game loop) ---

// Updates player health bar and inventory/weapon slots (no significant changes needed here, logic was already correct)
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
    // ... (keep existing implementation) ...
     // Ensure essential UI elements exist before proceeding
     if (!playerHealthBarFillEl || !inventoryBoxesContainerEl || !weaponSlotsContainerEl) {
        console.error("UI UpdatePlayerInfo: Missing essential elements.");
        if(playerHealthBarFillEl){
            const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
            const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
            playerHealthBarFillEl.style.width = `${healthPercent}%`;
        }
        return;
    }
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    playerHealthBarFillEl.style.width = `${healthPercent}%`;


    const selectedItem = playerRef ? playerRef.getCurrentlySelectedItem() : null;
    const getPartialCollectionFn = playerRef ? playerRef.getPartialCollection.bind(playerRef) : () => 0;


    for (const materialType of Config.INVENTORY_MATERIALS) {
        const slotDiv = itemSlotDivs[materialType];
        if (!slotDiv) continue;

        const count = inventory[materialType] || 0;
        const countSpan = slotDiv.querySelector('.item-count');
        if (countSpan) countSpan.textContent = count > 0 ? Math.min(count, 99) : '';

        let isDisabled;
        let currentTitle = `${materialType.toUpperCase()} (${count})`;

        if (materialType === 'dirt' || materialType === 'vegetation') {
            const partialCount = getPartialCollectionFn(materialType);
            isDisabled = (count === 0 && partialCount === 0);
            currentTitle = `${materialType.toUpperCase()} (${count} full, ${partialCount}/4 collected)`;

            const quadrants = slotDiv.querySelectorAll('.quadrant-container .quadrant');
            // Assuming quadrants are ordered TL, TR, BL, BR in the DOM by createItemSlot
            if (quadrants.length === 4) { // Ensure we have 4 quadrant elements
                 quadrants[0].classList.toggle('filled', partialCount >= 1);
                 quadrants[1].classList.toggle('filled', partialCount >= 2);
                 quadrants[2].classList.toggle('filled', partialCount >= 3);
                 quadrants[3].classList.toggle('filled', partialCount >= 4); // Should not happen as it resets to 0 + 1 full
            }
        } else {
            isDisabled = (count === 0);
        }

        slotDiv.classList.toggle('disabled', isDisabled);
        slotDiv.classList.toggle('active', playerRef && selectedItem === materialType && !isDisabled);
        slotDiv.title = currentTitle;
    }

    // Update Weapon Boxes
    // Use the passed boolean flags for weapon possession
    const playerPossession = {
        [Config.WEAPON_TYPE_SWORD]: hasSword,
        [Config.WEAPON_TYPE_SPEAR]: hasSpear,
        [Config.WEAPON_TYPE_SHOVEL]: hasShovel,
    };

    for (const weaponType of WEAPON_SLOTS_ORDER) {
        const slotDiv = itemSlotDivs[weaponType];
        // Ensure the corresponding slot div exists
        if (!slotDiv) {
            // console.warn(`UI updatePlayerInfo: Weapon slot div not found for type "${weaponType}".`);
            continue; // Skip if the element wasn't created
        }

        const possessed = playerPossession[weaponType]; // Check if player possesses this weapon
        const recipe = Config.CRAFTING_RECIPES[weaponType]; // Get the crafting recipe (might be undefined)
        const isCraftable = recipe !== undefined; // Is there a recipe defined for this weapon?

        let canInteract = false; // Can this slot be interacted with (equipped or crafted)?
        let titleText = weaponType.toUpperCase(); // Base title text

        if (possessed) {
            // Player has the weapon. The slot is interactive (can be equipped or unequipped by clicking).
            canInteract = true;
            titleText += ' (Owned)'; // Indicate it's owned
        } else if (isCraftable) {
            // Player does NOT have the weapon, but it's craftable.
            // Check if they have *all* required materials needed to CRAFT it.
            let canAfford = true;
            if (playerRef) { // Only check affordability if player exists (inventory access)
                for (const ingredient of recipe) {
                    const requiredType = ingredient.type;
                    const requiredAmount = ingredient.amount;
                    const possessedAmount = inventory[requiredType] || 0; // Get count from passed inventory
                    if (possessedAmount < requiredAmount) {
                        canAfford = false;
                        break; // Stop checking if one ingredient is missing
                    }
                }
            } else {
                canAfford = false; // Cannot afford if no player/inventory
            }

            if (canAfford) {
                // Player does NOT have the weapon but CAN craft it. The slot is interactive (click to craft).
                canInteract = true;
                titleText += ' (Click to Craft)'; // Indicate it's craftable
            } else {
                // Player does NOT have the weapon and CANNOT craft it yet. The slot is NOT interactive.
                canInteract = false;
                titleText += ' (Need: '; // Show recipe needed
                // Build recipe string: e.g., "Need: 5 Stone, 2 Wood"
                titleText += recipe.map(ing => `${ing.amount} ${ing.type.charAt(0).toUpperCase() + ing.type.slice(1)}`).join(', '); // Capitalize material names
                titleText += ')';
            }
        } else {
            // Weapon is neither possessed nor craftable (e.g., Shovel if lost). The slot is NOT interactive.
            canInteract = false;
            titleText += ' (Unavailable)'; // Indicate it's unavailable
        }

        // The 'disabled' class indicates whether the slot is *interactable*.
        // It is disabled if the player CANNOT do anything with this slot.
        slotDiv.classList.toggle('disabled', !canInteract);

        // The 'active' class indicates whether the item represented by this slot is the currently selected item.
        // Only mark as active if playerRef exists (game is running) AND the player's selected item matches this slot's type.
        slotDiv.classList.toggle('active', playerRef && selectedItem === weaponType);

        // Update the title attribute for the hover tooltip
        slotDiv.title = titleText;
    }
}

// Updates the portal health bar and its title color (no changes needed)
export function updatePortalInfo(currentHealth, maxHealth) {
    // ... (keep existing implementation) ...
    // Ensure essential UI elements exist before proceeding
    if (!portalHealthBarFillEl || !portalColumnH2El || !portalColumnEl) {
        console.error("UI UpdatePortalInfo: Missing essential elements.");
        // Still try to update health bar if available
        if(portalHealthBarFillEl){
            const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
            const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
            portalHealthBarFillEl.style.width = `${healthPercent}%`;
        }
        return; // Cannot update title if elements are missing
    }

    // Update Health Bar
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    portalHealthBarFillEl.style.width = `${healthPercent}%`;

    // Update Portal title color based on health percentage (using clamped health ratio)
    const healthPercentRatio = (maxHealth > 0) ? (clampedHealth / maxHealth) : 0;
    if (portalColumnH2El.style) {
        if (healthPercentRatio > 0.5) portalColumnH2El.style.color = '#aaffaa'; // Greenish (Healthy)
        else if (healthPercentRatio > 0.2) portalColumnH2El.style.color = 'yellow'; // Yellowish (Damaged)
        else portalColumnH2El.style.color = 'red'; // Reddish (Critical)
    }
}

// Updates the wave timer bar and text (no changes needed)
export function updateWaveTimer(waveInfo) {
    // ... (keep existing implementation) ...
    // Ensure essential UI elements exist
    if (!timerBarFillEl || !timerTextOverlayEl || !timerRowEl) {
        console.error("UI UpdateWaveTimer: Missing essential elements.");
        return;
    }

    // Destructure relevant properties from the waveInfo object
    const { state, timer: currentTimer, maxTimer, mainWaveNumber } = waveInfo;

    // Clamp currentTimer to be between 0 and maxTimer for robust display
    const clampedTimer = Math.max(0, Math.min(currentTimer, maxTimer));

    // Calculate fill percentage for the timer bar (counts down)
    // Handle maxTimer = 0 or 1 case to prevent division by zero and show full/empty bar correctly
    const timerPercent = (maxTimer > 1) ? (clampedTimer / maxTimer) * 100 : (clampedTimer > 0 ? 100 : 0);
    timerBarFillEl.style.width = `${timerPercent}%`;

    // --- Update Timer Text Overlay based on WaveManager State ---
    let timerText = "";
    let displayTimerValue = true; // Flag to control if we append the numerical timer

    switch(state) {
        case 'PRE_WAVE':
            timerText = "FIRST WAVE IN";
            break;
        case 'WAVE_COUNTDOWN':
            const livingEnemies = EnemyManager.getLivingEnemyCount(); // Get current living enemy count
            if (livingEnemies > 0) {
                timerText = `WAVE ${mainWaveNumber} (${livingEnemies} LEFT)`;
            } else {
                if (clampedTimer <= 5 && livingEnemies === 0) {
                    timerText = "INTERMISSION SOON!";
                } else {
                    timerText = `WAVE ${mainWaveNumber} (CLEARING)`;
                }
            }
            break;
        case 'BUILDPHASE':
            timerText = `BUILD TIME (WAVE ${mainWaveNumber} NEXT)`;
            break;
        case 'WARPPHASE': // Renamed from WARP_ANIMATING
            let animStatus = "";
            if (WorldManager && typeof WorldManager.areAgingAnimationsComplete === 'function' && typeof WorldManager.areGravityAnimationsComplete === 'function' && (!WorldManager.areAgingAnimationsComplete() || !WorldManager.areGravityAnimationsComplete())) {
                 animStatus = " (MORPHING...)";
            }
            timerText = `WARPING TO WAVE ${mainWaveNumber}${animStatus}`;
            displayTimerValue = true;
            break;
        case 'GAME_OVER':
            timerText = "GAME OVER";
            displayTimerValue = false;
            break;
        case 'VICTORY':
            timerText = "VICTORY!";
            displayTimerValue = false;
            break;
        case 'LOADING':
        default:
            timerText = "LOADING...";
            displayTimerValue = false;
            break;
    }

    if (displayTimerValue) {
        const minutes = Math.floor(clampedTimer / 60);
        const seconds = Math.floor(clampedTimer % 60);
        const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
        timerText = `${timerText}: ${minutes}:${formattedSeconds}`;
    }

    timerTextOverlayEl.textContent = timerText;
}

// Function to display the epoch text overlay (no changes needed)
export function showEpochText(epochMessage) {
    // ... (keep existing implementation) ...
     // Ensure the epoch overlay element exists
     if (!epochOverlayEl) {
        console.warn("UI showEpochText: Element not found.", epochOverlayEl);
        return;
    }
    // Ensure epochMessage is a string, default to a placeholder if not
    const textToDisplay = (typeof epochMessage === 'string' && epochMessage.trim() !== "") ? epochMessage : 'Wave Starting';

    // Set the text content
    epochOverlayEl.textContent = textToDisplay;

    // Clear any previous hide timer to prevent overlaps if waves transition quickly
    if (epochOverlayEl._hideTimer) {
        clearTimeout(epochOverlayEl._hideTimer);
        epochOverlayEl._hideTimer = null; // Clear the reference after clearing
    }

    // Show the element by making it visible and fading in (controlled by CSS transitions)
    epochOverlayEl.style.visibility = 'visible';
    epochOverlayEl.style.opacity = '1';

    // Set a timer to start the fade-out after the display duration from Config
    const displayDurationMs = Config.EPOCH_DISPLAY_DURATION * 1000;
    epochOverlayEl._hideTimer = setTimeout(() => {
        epochOverlayEl.style.opacity = '0'; // Start fade-out

        // Set another timer to hide the element completely after the fade-out transition finishes
        // The transition duration is 0.5s in the CSS for opacity
        const transitionDurationMs = 500; // Match the CSS transition duration
        epochOverlayEl._hideTimer = setTimeout(() => {
            epochOverlayEl.style.visibility = 'hidden';
            epochOverlayEl._hideTimer = null; // Clear the reference after hiding
        }, transitionDurationMs);

    }, displayDurationMs); // Delay before starting fade-out
}

// Add a getter to check if the main game UI initialization was successful
export function isInitialized() {
    return isUIReady;
}