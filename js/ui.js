// root/js/ui.js - Manages HTML Sidebar Elements and Updates

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js';
// NEW: Import AudioManager to check mute state for button appearance
import * as AudioManager from './audioManager.js';


// --- DOM Element References ---

// Top Sidebar
let topSidebarEl = null;
let playerColumnEl, portalColumnEl; // Keep column refs for structure/class
let playerHealthBarContainerEl, playerHealthBarFillEl; // Updated player health bar elements
let portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl; // Updated portal health bar elements (added H2 ref)
// Removed: healthLabelEl, healthTextEl, waveStatusEl, waveTimerEl, enemyCountEl
let timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl; // New timer elements

// Bottom Sidebar
let bottomSidebarEl;
let itemSelectionAreaEl;
let inventoryBoxesContainerEl, weaponSlotsContainerEl;
let actionButtonsAreaEl;
let toggleControlsButtonEl;
let actionButtons = {};
// NEW: Settings buttons
let toggleGridButtonEl = null;
let muteMusicButtonEl = null;
let muteSfxButtonEl = null;

// Overlay
let gameOverlay = null;
let epochOverlayEl = null;
// Removed: portalHealthDisplayEl

// --- Internal State ---
let playerRef = null;
let portalRef = null;
const itemSlotDivs = {};
let buttonIlluminationTimers = {};
const ILLUMINATION_DURATION = 150; // ms
const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL];
// Add a flag to track if UI init was successful
let isUIReady = false;

// --- Initialization ---
export function initOverlay() {
    gameOverlay = document.getElementById('game-overlay');
    if (!gameOverlay) {
        console.error("UI InitOverlay: Could not find core overlay elements!");
        return false;
    }
    return true;
}

export function initGameUI() {
    let success = true;
    // --- Find Top Sidebar Elements ---
    topSidebarEl = document.getElementById('top-sidebar'); // Get the main top sidebar
    playerColumnEl = document.getElementById('player-column'); // Player column (container)
    portalColumnEl = document.getElementById('portal-column'); // Portal column (container)

    playerHealthBarContainerEl = document.getElementById('player-health-bar-container'); // Player bar container
    playerHealthBarFillEl = document.getElementById('player-health-bar-fill'); // Player bar fill
    // Removed: healthLabelEl, healthTextEl

    portalColumnH2El = document.getElementById('portal-health-title'); // Portal title (now superimposed H2)
    portalHealthBarContainerEl = document.getElementById('portal-health-bar-container'); // Portal bar container
    portalHealthBarFillEl = document.getElementById('portal-health-bar-fill'); // Portal bar fill
    // Removed: waveStatusEl, waveTimerEl, enemyCountEl (which was repurposed)

    timerRowEl = document.getElementById('timer-row'); // Timer row container
    timerBarContainerEl = document.getElementById('timer-bar-container'); // Timer bar container
    timerBarFillEl = document.getElementById('timer-bar-fill'); // Timer bar fill
    timerTextOverlayEl = document.getElementById('timer-text-overlay'); // Timer text overlay

    // --- Find Bottom Sidebar Elements (Keep) ---
    bottomSidebarEl = document.getElementById('bottom-sidebar');
    itemSelectionAreaEl = document.getElementById('item-selection-area');
    inventoryBoxesContainerEl = document.getElementById('inventory-boxes-container');
    weaponSlotsContainerEl = document.getElementById('weapon-slots-container');
    actionButtonsAreaEl = document.getElementById('action-buttons-area');
    toggleControlsButtonEl = document.getElementById('toggle-controls-button');

    // NEW: Find Settings Buttons
    toggleGridButtonEl = document.getElementById('btn-toggle-grid');
    muteMusicButtonEl = document.getElementById('btn-mute-music');
    muteSfxButtonEl = document.getElementById('btn-mute-sfx');


    // Find Action Buttons (Keep)
    actionButtons.left = document.getElementById('btn-move-left');
    actionButtons.right = document.getElementById('btn-move-right');
    actionButtons.pause = document.getElementById('btn-pause');
    actionButtons.jump = document.getElementById('btn-jump');
    actionButtons.attack = document.getElementById('btn-attack');

    // NEW: Add settings buttons to actionButtons mapping for illumination
    actionButtons.toggleGrid = toggleGridButtonEl;
    actionButtons.muteMusic = muteMusicButtonEl;
    actionButtons.muteSfx = muteSfxButtonEl;

    // NEW: Find Epoch Overlay Element (Keep)
    epochOverlayEl = document.getElementById('epoch-overlay');

    // --- Verification ---
    // Update requiredElements list to include new settings buttons
    const requiredElements = [
        topSidebarEl, playerColumnEl, portalColumnEl,
        playerHealthBarContainerEl, playerHealthBarFillEl,
        portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl,
        timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl,
        bottomSidebarEl, itemSelectionAreaEl, inventoryBoxesContainerEl, weaponSlotsContainerEl,
        actionButtonsAreaEl, toggleControlsButtonEl,
        actionButtons.left, actionButtons.right, actionButtons.pause, actionButtons.jump, actionButtons.attack,
        actionButtons.toggleGrid, actionButtons.muteMusic, actionButtons.muteSfx, // NEW: Add settings buttons
        epochOverlayEl // NEW: Add epoch overlay element to the required list
    ];
    if (requiredElements.some(el => !el)) {
        console.error("UI InitGameUI: Could not find all expected game UI elements!");
        // Log specific missing elements if needed
        requiredElements.forEach(el => {
            if (!el) console.error(`Missing element: ${el?.id || el?.className || 'Unknown (null)'}`);
        });
        success = false;
    }
    // --- Clear previous dynamic content and listeners (Keep) ---
    if (inventoryBoxesContainerEl) inventoryBoxesContainerEl.innerHTML = 'Loading...';
    if (weaponSlotsContainerEl) weaponSlotsContainerEl.innerHTML = '';
    for (const key in itemSlotDivs) delete itemSlotDivs[key];
    for (const key in buttonIlluminationTimers) clearTimeout(buttonIlluminationTimers[key]);
    buttonIlluminationTimers = {}; // Reset timers
    // --- Create Item/Weapon Selection Boxes Dynamically (Keep) ---
    if (inventoryBoxesContainerEl && weaponSlotsContainerEl) {
        inventoryBoxesContainerEl.innerHTML = ''; // Clear loading text
        weaponSlotsContainerEl.innerHTML = ''; // Clear loading text
        // Create Material Boxes
        for (const materialType of Config.INVENTORY_MATERIALS) {
            createItemSlot(materialType, inventoryBoxesContainerEl, 'material');
        }
        // Create Weapon Boxes
        for (const weaponType of WEAPON_SLOTS_ORDER) {
            createItemSlot(weaponType, weaponSlotsContainerEl, 'weapon');
        }
         // Add unarmed slot? No, maybe select unarmed by clicking equipped item again?
         // createItemSlot(Config.WEAPON_TYPE_UNARMED, weaponSlotsContainerEl, 'weapon');
    } else {
        success = false;
    }
    // --- Add Event Listeners and Set Initial State (Keep setupActionButtons, toggleControlsButtonEl listener) ---
    if (success) {
        // setupActionButtons is called by main.js Input.init, so no need here.
        // setupActionButtons(); // Let Input.js handle button setup and add listeners

        toggleControlsButtonEl.addEventListener('click', toggleActionControls);
        // Set initial state for health/inventory on init
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false); // Set initial empty state
        // Use the new update function for portal info
        updatePortalInfo(0, Config.PORTAL_INITIAL_HEALTH); // Set initial portal health
        // Set initial state for timer bar
         updateWaveTimer(0, 1, "Loading..."); // Set initial timer state

        // NEW: Set initial state for settings buttons based on AudioManager state
         updateSettingsButtonStates();


        isUIReady = true; // Mark UI as ready if all steps succeeded
    } else {
        isUIReady = false; // Mark UI as not ready on failure
        console.error("UI: Failed to initialize some critical Game UI elements.");
    }
    return success;
}

// Helper to create and setup a single item/weapon slot
function createItemSlot(itemType, container, category) {
    const slotDiv = document.createElement('div');
    slotDiv.classList.add('item-box');
    slotDiv.dataset.item = itemType;
    slotDiv.classList.add('disabled'); // Start disabled
    const itemConfig = Config.ITEM_CONFIG[itemType];
    if (category === 'material') {
        slotDiv.style.backgroundColor = itemConfig?.color || '#444';
        slotDiv.title = `${itemType.toUpperCase()} (0)`;
        const countSpan = document.createElement('span');
        countSpan.classList.add('item-count');
        countSpan.textContent = ''; // Start empty
        slotDiv.appendChild(countSpan);
    } else if (category === 'weapon') {
        if (itemType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
        else if (itemType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑';
        else if (itemType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️';
        else slotDiv.textContent = '?'; // Fallback for unknown weapon type
        slotDiv.title = `${itemType.toUpperCase()} (Not Found)`;
        // Initial background color - maybe use a dimmer version if disabled?
        // slotDiv.style.backgroundColor = itemConfig?.color ? `${itemConfig.color}` : '#111';
        // Disabled class will handle opacity
    }
    slotDiv.addEventListener('click', () => {
        handleItemSlotClick(itemType, category);
    });
    container.appendChild(slotDiv);
    itemSlotDivs[itemType] = slotDiv;
}

// Helper to handle clicks on item/weapon slots
// Moved to Input.js or Main.js to manage interaction state
// For now, it can stay here and call player methods directly,
// but be aware this bypasses Input.js state for these clicks.
function handleItemSlotClick(itemType, category) {
     // Check if game is in a state where item selection is allowed (e.g., RUNNING, BUILDPHASE)
     // This check should ideally happen in main.js or a state manager before allowing UI interaction
     // For simplicity, let's assume it's okay to click as long as playerRef exists.
     if (!playerRef) {
        // console.log("UI Item Click: playerRef is null (game not running?)."); // Keep logs quieter
        return;
    }
    // Allow selecting unarmed slot even if playerRef is null? (If unarmed button added)
    // Or maybe just ignore clicks if playerRef is null (game not running)
     if (playerRef.getCurrentlySelectedItem() === itemType) {
         // Already selected, maybe switch to unarmed if clicked again?
         // Adding specific handling for weapon types - clicking an equipped weapon unequips it
         if (category === 'weapon' && itemType !== Config.WEAPON_TYPE_UNARMED) {
             playerRef.equipItem(Config.WEAPON_TYPE_UNARMED);
              // console.log(`UI Click: Unequipped ${itemType}`); // Keep logs quieter
         } else {
             // console.log(`UI Click: Already equipped ${itemType}.`); // Keep logs quieter
         }
         return; // Click handled (switched or already selected)
    }
    let canSelect = false;
    if (category === 'material') {
        canSelect = (playerRef.inventory[itemType] || 0) > 0;
    } else if (category === 'weapon') {
        canSelect = playerRef.hasWeapon(itemType);
    }
    // Add logic for unarmed if you have a dedicated unarmed slot
    // else if (itemType === Config.WEAPON_TYPE_UNARMED) { canSelect = true; }
    if (canSelect) {
        playerRef.equipItem(itemType); // Player equips it, UI will update next frame via main loop
        // console.log(`UI Click: Equipped ${itemType}.`); // Keep logs quieter
    } else {
        // console.log(`UI Click: Cannot select ${itemType}.`);
        const slotDiv = itemSlotDivs[itemType];
        if(slotDiv && typeof slotDiv.animate === 'function') {
            slotDiv.animate([
                { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' },
                { transform: 'translateX(-3px)' }, { transform: 'translateX(0px)' }
            ], { duration: 200, easing: 'ease-in-out' });
        }
    }
}


// Helper to setup action button listeners
// MOVED THIS FUNCTION TO Input.js
/*
function setupActionButtons() {
    // We need to map UI button actions to the keys used in Input.js state
    const buttonActionMap = {
        'btn-move-left': 'left',
        'btn-move-right': 'right',
        'btn-jump': 'jump',
        'btn-attack': 'attack',
        'btn-pause': 'pause'
        // NEW: Add mappings for settings buttons. These don't update Input.state,
        // they call specific toggle functions, which are handled in main.js listeners.
        // We add them to actionButtons map in initGameUI for illumination purposes.
        // 'btn-toggle-grid': 'toggleGrid',
        // 'btn-mute-music': 'muteMusic', // Use simple action names for illumination
        // 'btn-mute-sfx': 'muteSfx'
    };

    Object.keys(buttonActionMap).forEach(buttonId => {
        const button = document.getElementById(buttonId); // Get button by ID
        const action = buttonActionMap[buttonId]; // Get the corresponding action name
        if (!button) return;

        // Special handling for pause (single click)
        if (action === 'pause') {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                illuminateButton(action);
                // The actual pause logic is now handled by main.js through the exposed callback
                if (typeof window.pauseGameCallback === 'function') {
                    window.pauseGameCallback(); // Call the exposed pause function
                } else {
                    console.warn("UI: Pause callback (window.pauseGameCallback) not found!");
                }
            });
            return; // Skip holdable listeners for pause
        }

        // NEW: Special handling for settings buttons (single click, don't affect Input.state)
        // These listeners are now added in main.js init, calling the toggle functions.
        // The illumination is handled by main.js calling illuminateButton directly.
        // We leave this section commented out as it's handled elsewhere.
        /*
        if (['toggleGrid', 'muteMusic', 'muteSfx'].includes(action)) {
             button.addEventListener('click', (e) => {
                 e.preventDefault();
                 illuminateButton(action);
                 // Call the corresponding toggle function in main.js via window object
                 // if (action === 'toggleGrid' && typeof window.toggleGridDisplayCallback === 'function') window.toggleGridDisplayCallback();
                 // else if (action === 'muteMusic' && typeof window.toggleMusicMuteCallback === 'function') window.toggleMusicMuteCallback();
                 // else if (action === 'muteSfx' && typeof window.toggleSfxMuteCallback === 'function') window.toggleSfxMuteCallback();
                 // else console.warn(`UI: Callback for action '${action}' not found!`);
             });
             return; // Skip holdable listeners for settings
        }
        */


        // Holdable/Toggleable listeners for movement and attack
        // These listeners are now handled in Input.js's init
        /*
        const handlePress = (e) => {
            e.preventDefault(); // Prevent default touch behaviors
             // Ensure Input state is accessible and game is not paused
            // The check for playerRef or gameState is better done in main.js or player.update
            // UI buttons just signal the input intent.
            if (window.Input?.state) {
                 const inputState = window.Input.state;
                 if (action === 'attack') {
                      // Only trigger attack if not already attacking this frame (consumed by main loop)
                     if (!inputState.attack) { // Check the state flag
                         inputState.attack = true;
                         illuminateButton(action);
                     }
                 } else { // Movement actions
                      // Only set state and illuminate if not already pressed
                     if (!inputState[action]) { // Check the state flag
                          inputState[action] = true;
                          illuminateButton(action);
                     }
                 }
            }
        };
        const handleRelease = (e) => {
             e.preventDefault();
            if (window.Input?.state) {
                // Movement actions are set to false on release
                if (action !== 'attack') { // Attack is consumed in main loop
                    window.Input.state[action] = false;
                }
                // Note: If attack button is released while cooldown is active,
                // the state.attack flag might still be true until the main loop
                // consumes it in a subsequent frame. This is expected.
            }
        };

        // Add listeners
        button.addEventListener('mousedown', handlePress);
        button.addEventListener('mouseup', handleRelease);
        button.addEventListener('mouseleave', handleRelease); // Treat mouse leaving as a release
        button.addEventListener('touchstart', handlePress, { passive: false }); // Use passive: false for preventDefault
        button.addEventListener('touchend', handleRelease, { passive: false });
        button.addEventListener('touchcancel', handleRelease, { passive: false }); // Handle touches interrupted by OS
    });
}
*/

// Toggles the visibility of the action buttons area
export function toggleActionControls() {
    if (bottomSidebarEl && actionButtonsAreaEl && toggleControlsButtonEl) {
        bottomSidebarEl.classList.toggle('controls-hidden');
        const isHidden = bottomSidebarEl.classList.contains('controls-hidden');
        // Update the button text to reflect the new state
        toggleControlsButtonEl.textContent = isHidden ? '▲ TOUCH CONTROLS ▲' : '▼ TOUCH CONTROLS ▼';
        toggleControlsButtonEl.title = isHidden ? 'Show Controls' : 'Hide Controls';
    }
}
// Sets the reference to the player object
export function setPlayerReference(playerObject) {
    playerRef = playerObject;
    // Initial UI update when player is set (on game start)
    if (playerRef) {
         // Request an initial update for player UI elements
         // Use rAF to ensure it runs after any potential player initialization
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
        // Also reset inventory/weapon UI
        for(const key in itemSlotDivs){
            itemSlotDivs[key]?.classList.remove('active');
            itemSlotDivs[key]?.classList.add('disabled'); // Disable all slots
            const countSpan = itemSlotDivs[key]?.querySelector('.item-count');
            if (countSpan) countSpan.textContent = ''; // Clear counts
            // Weapon slots might keep their icon but be disabled
        }
    }
}
export function setPortalReference(portalObject) {
    portalRef = portalObject;
    if (portalRef) {
        // Use rAF for initial update after portal is set
        requestAnimationFrame(() => {
            updatePortalInfo(portalRef.currentHealth, portalRef.maxHealth);
        });
    } else {
        if (portalHealthBarFillEl) portalHealthBarFillEl.style.width = '0%';
        if (portalColumnH2El) portalColumnH2El.textContent = 'PORTAL'; // Reset title
    }
}
// Briefly illuminates a specific action button
export function illuminateButton(actionName) {
    // actionButtons map is populated in initGameUI with button IDs
    // Ensure the button exists in the map
    const button = actionButtons[actionName];
    if (!button) {
        // console.warn(`UI illuminateButton: Button mapping not found for action "${actionName}".`); // Keep logs quieter
        return; // Button element not found
    }

    // Prevent illumination if the button is currently disabled or hidden (e.g. controls-hidden state)
    // Note: The button element itself isn't disabled, its container is hidden.
    // Let's check if the bottom sidebar is hidden. Movement/attack/jump buttons are in actionButtonsAreaEl
    // Settings buttons might need separate logic if their parent isn't actionButtonsAreaEl.
    // Currently, all are within actionButtonsAreaEl, so check its visibility/opacity.
     // actionButtonsAreaEl has opacity/visibility transition, check computed style?
     // Or rely on the parent class controls-hidden
     if (bottomSidebarEl && bottomSidebarEl.classList.contains('controls-hidden') && actionName !== 'pause') {
         // Don't illuminate movement/attack/jump/settings if controls are hidden, EXCEPT PAUSE
         return;
     }


    if (buttonIlluminationTimers[actionName]) {
        clearTimeout(buttonIlluminationTimers[actionName]);
    }
    button.classList.add('illuminated');

    buttonIlluminationTimers[actionName] = setTimeout(() => {
        button.classList.remove('illuminated');
        delete buttonIlluminationTimers[actionName];
    }, ILLUMINATION_DURATION);
}

// NEW: Update the visual state (active/muted class) of settings buttons
export function updateSettingsButtonStates(isGridVisible, isMusicMuted, isSfxMuted) {
    if (toggleGridButtonEl) {
         // Use 'active' class for grid button when grid is visible
         toggleGridButtonEl.classList.toggle('active', isGridVisible);
         toggleGridButtonEl.title = isGridVisible ? 'Hide Grid' : 'Show Grid';
    }
    if (muteMusicButtonEl) {
         // Use 'muted' class for music button when music is muted
         muteMusicButtonEl.classList.toggle('muted', isMusicMuted);
         muteMusicButtonEl.title = isMusicMuted ? 'Unmute Music' : 'Toggle Music';
    }
    if (muteSfxButtonEl) {
         // Use 'muted' class for sfx button when sfx is muted
         muteSfxButtonEl.classList.toggle('muted', isSfxMuted);
         muteSfxButtonEl.title = isSfxMuted ? 'Unmute SFX' : 'Toggle SFX';
    }
}


// --- Update Functions ---

// Updates player health bar and inventory/weapon slots
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
    if (!playerHealthBarFillEl || !inventoryBoxesContainerEl || !weaponSlotsContainerEl) {
         console.error("UI UpdatePlayerInfo: Missing essential elements.");
         return;
    }
    // Update Health Bar (Top Sidebar)
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    playerHealthBarFillEl.style.width = `${healthPercent}%`;

    // Update Item/Weapon Selection Boxes (Bottom Sidebar)
    // Need the currently selected item type. Get it from playerRef if available.
    const selectedItem = playerRef ? playerRef.getCurrentlySelectedItem() : null;
    // Update Material Boxes
    for (const materialType of Config.INVENTORY_MATERIALS) {
        const slotDiv = itemSlotDivs[materialType];
        if (!slotDiv) continue;
        const count = inventory[materialType] || 0;
        const countSpan = slotDiv.querySelector('.item-count');
        if (countSpan) countSpan.textContent = count > 0 ? Math.min(count, 99) : ''; // Cap count for display
        const isDisabled = count === 0;
        slotDiv.classList.toggle('disabled', isDisabled);
        // Only mark as active if the playerRef exists and has this item selected
        slotDiv.classList.toggle('active', playerRef && selectedItem === materialType);
        slotDiv.title = `${materialType.toUpperCase()} (${count})`;
    }
    // Update Weapon Boxes
    const playerPossession = {
        [Config.WEAPON_TYPE_SWORD]: hasSword,
        [Config.WEAPON_TYPE_SPEAR]: hasSpear,
        [Config.WEAPON_TYPE_SHOVEL]: hasShovel,
    };
    for (const weaponType of WEAPON_SLOTS_ORDER) {
        const slotDiv = itemSlotDivs[weaponType];
        if (!slotDiv) continue;
        const possessed = playerPossession[weaponType];
        const isDisabled = !possessed;
        slotDiv.classList.toggle('disabled', isDisabled);
        slotDiv.classList.toggle('active', playerRef && possessed && selectedItem === weaponType); // Only mark as active if the playerRef exists and has this item selected AND possesses it
        slotDiv.title = possessed ? weaponType.toUpperCase() : `${weaponType.toUpperCase()} (Not Found)`;
    }
     // Handle Unarmed slot if it existed - would need logic here to mark it active if selectedItem is unarmed
     // if (itemSlotDivs[Config.WEAPON_TYPE_UNARMED]) { ... }
}


// Updates the portal health bar
export function updatePortalInfo(currentHealth, maxHealth) {
    // Update required elements list to use portalHealthBarFillEl and portalColumnH2El
     if (!portalHealthBarFillEl || !portalColumnH2El || !portalColumnEl) { // Add portalColumnEl check
         console.error("UI UpdatePortalInfo: Missing essential elements.");
         return;
    }
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    portalHealthBarFillEl.style.width = `${healthPercent}%`;

    // Update Portal title color based on health percentage
    const healthPercentRatio = (maxHealth > 0) ? (clampedHealth / maxHealth) : 0;
    if (portalColumnH2El.style) {
        if (healthPercentRatio > 0.5) portalColumnH2El.style.color = '#aaffaa'; // Greenish
        else if (healthPercentRatio > 0.2) portalColumnH2El.style.color = 'yellow'; // Yellowish
        else portalColumnH2El.style.color = 'red'; // Reddish
    }
    // Text content remains "PORTAL HEALTH" as defined in HTML
}

// NEW: Updates the wave timer bar and text based on wave info state
// Accepts the entire waveInfo object now
export function updateWaveTimer(waveInfo) {
    if (!timerBarFillEl || !timerTextOverlayEl || !timerRowEl) {
         console.error("UI UpdateWaveTimer: Missing essential elements.");
         return;
    }

    const currentTimer = waveInfo.timer;
    const maxTimer = waveInfo.maxTimer;
    const state = waveInfo.state; // Get the current state from waveInfo

    // Clamp currentTimer to be between 0 and maxTimer
    const clampedTimer = Math.max(0, Math.min(currentTimer, maxTimer));

    // Calculate fill percentage (counts down, so percentage decreases)
    const timerPercent = (maxTimer > 0) ? (clampedTimer / maxTimer) * 100 : 0;

    timerBarFillEl.style.width = `${timerPercent}%`;

    // --- Update Timer Text Overlay based on State ---
    let timerText = "";
    switch(state) {
        case 'PRE_WAVE': timerText = "FIRST WAVE IN"; break;
        case 'WAVE_COUNTDOWN': timerText = "WAVE ENDS IN"; break;
        case 'BUILDPHASE': timerText = "BUILD TIME"; break;
        case 'WARPPHASE': timerText = "WARPING..."; break;
        case 'GAME_OVER': timerText = "GAME OVER"; break;
        case 'VICTORY': timerText = "VICTORY!"; break;
        default: timerText = "TIME"; break;
    }
     // Optional: Append formatted time if state is timed
    if (state === 'PRE_WAVE' || state === 'WAVE_COUNTDOWN' || state === 'BUILDPHASE' || state === 'WARPPHASE') {
         const minutes = Math.floor(clampedTimer / 60);
         const seconds = Math.floor(clampedTimer % 60);
         const milliseconds = Math.floor((clampedTimer * 1000) % 1000);
         // Format seconds and milliseconds with leading zeros
         const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
         const formattedMilliseconds = milliseconds < 100 ? (milliseconds < 10 ? '00' + milliseconds : '0' + milliseconds) : milliseconds;

         // Only show milliseconds during active phases (WAVE, BUILD, WARP), round to nearest second otherwise
         if (state === 'WAVE_COUNTDOWN' || state === 'BUILDPHASE' || state === 'WARPPHASE') {
             // timerText = `${timerText}: ${minutes}:${formattedSeconds}.${formattedMilliseconds}`; // Removed milliseconds for simpler display
             timerText = `${timerText}: ${minutes}:${formattedSeconds}`;
         } else {
             timerText = `${timerText}: ${minutes}:${formattedSeconds}`;
         }
    }

    timerTextOverlayEl.textContent = timerText;

    // Optional: Change color of timer bar or text based on state or time remaining
    // Example:
    // if (state === 'WARPPHASE') {
    //      timerBarFillEl.style.backgroundColor = 'purple';
    // } else {
    //      // Reset to default green
    //      timerBarFillEl.style.backgroundColor = 'rgb(80, 180, 80)';
    // }
}

// Function to display the epoch text overlay (Keep)
// Clears any pending hide timer and sets a new one
export function showEpochText(epochYear) {
    if (!epochOverlayEl || typeof epochYear !== 'number' || isNaN(epochYear)) {
        console.warn("UI showEpochText: Element not found or invalid year.", epochOverlayEl, epochYear);
        return;
    }
    // Build the text string
    epochOverlayEl.textContent = `${epochYear} Million Years Ago`;
    // Clear any previous hide timer to prevent overlaps if waves transition quickly
    if (epochOverlayEl._hideTimer) {
        clearTimeout(epochOverlayEl._hideTimer);
    }
    // Show the element by making it visible and fading in
    epochOverlayEl.style.visibility = 'visible';
    epochOverlayEl.style.opacity = '1';
    // Set a timer to start the fade-out after the display duration
    epochOverlayEl._hideTimer = setTimeout(() => {
        epochOverlayEl.style.opacity = '0'; // Start fade-out
        // Set another timer to hide the element completely after the fade-out transition finishes
        // The transition duration is 0.5s in CSS
        epochOverlayEl._hideTimer = setTimeout(() => {
             epochOverlayEl.style.visibility = 'hidden';
        }, 500); // Match CSS transition duration
    }, Config.EPOCH_DISPLAY_DURATION * 1000); // Convert duration from seconds to milliseconds
}

// Add a getter for the initialization status (Keep)
export function isInitialized() {
    return isUIReady;
}