// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar Elements and Updates
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js'; // <-- ADD THIS IMPORT
// import * as WaveManager from './waveManager.js'; // No longer needed here, get info via player ref/main loop

// --- Cache DOM Element References ---

// Top Sidebar
let playerColumnEl, portalColumnEl;
let healthLabelEl, healthBarContainerEl, healthBarFillEl, healthTextEl;
let waveStatusEl, waveTimerEl, enemyCountEl; // Keep enemyCountEl for display

// Bottom Sidebar
let bottomSidebarEl;
let itemSelectionAreaEl;
let inventoryBoxesContainerEl, weaponSlotsContainerEl;
let actionButtonsAreaEl;
let toggleControlsButtonEl;
let actionButtons = {}; // { left: btnEl, right: btnEl, ... }

// Overlay
let gameOverlay = null;

// --- Internal State ---
let playerRef = null;
const itemSlotDivs = {}; // Unified store: { 'dirt': div, 'sword': div, ... }
let buttonIlluminationTimers = {};
const ILLUMINATION_DURATION = 150; // ms

const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL];
const ALL_SELECTABLE_ITEMS = [...Config.INVENTORY_MATERIALS, ...WEAPON_SLOTS_ORDER]; // Unused currently, can remove?

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
    playerColumnEl = document.getElementById('player-column');
    portalColumnEl = document.getElementById('portal-column');
    healthBarContainerEl = document.getElementById('health-bar-container');
    healthBarFillEl = document.getElementById('health-bar-fill');
    healthTextEl = document.getElementById('health-text');
    healthLabelEl = document.getElementById('health-label');
    waveStatusEl = document.getElementById('wave-status');
    waveTimerEl = document.getElementById('wave-timer');
    enemyCountEl = document.getElementById('enemy-count'); // Keep for enemy count display

    // --- Find Bottom Sidebar Elements ---
    bottomSidebarEl = document.getElementById('bottom-sidebar');
    itemSelectionAreaEl = document.getElementById('item-selection-area');
    inventoryBoxesContainerEl = document.getElementById('inventory-boxes-container');
    weaponSlotsContainerEl = document.getElementById('weapon-slots-container');
    actionButtonsAreaEl = document.getElementById('action-buttons-area');
    toggleControlsButtonEl = document.getElementById('toggle-controls-button');

    // Find Action Buttons
    actionButtons.left = document.getElementById('btn-move-left');
    actionButtons.right = document.getElementById('btn-move-right');
    actionButtons.pause = document.getElementById('btn-pause');
    actionButtons.jump = document.getElementById('btn-jump');
    actionButtons.attack = document.getElementById('btn-attack');

    // --- Verification ---
    const requiredElements = [
        playerColumnEl, portalColumnEl, healthBarContainerEl, healthBarFillEl, healthTextEl, healthLabelEl,
        waveStatusEl, waveTimerEl, enemyCountEl, bottomSidebarEl, itemSelectionAreaEl,
        inventoryBoxesContainerEl, weaponSlotsContainerEl, actionButtonsAreaEl, toggleControlsButtonEl,
        actionButtons.left, actionButtons.right, actionButtons.pause, actionButtons.jump, actionButtons.attack
    ];

    if (requiredElements.some(el => !el)) {
        console.error("UI InitGameUI: Could not find all expected game UI elements!");
        // Log specific missing elements if needed
        success = false;
    }

    // --- Clear previous dynamic content and listeners ---
    if (inventoryBoxesContainerEl) inventoryBoxesContainerEl.innerHTML = 'Loading...';
    if (weaponSlotsContainerEl) weaponSlotsContainerEl.innerHTML = '';
    for (const key in itemSlotDivs) delete itemSlotDivs[key];
    for (const key in buttonIlluminationTimers) clearTimeout(buttonIlluminationTimers[key]);
    buttonIlluminationTimers = {}; // Reset timers

    // --- Create Item/Weapon Selection Boxes Dynamically ---
    if (inventoryBoxesContainerEl && weaponSlotsContainerEl) {
        inventoryBoxesContainerEl.innerHTML = ''; // Clear loading text
        weaponSlotsContainerEl.innerHTML = '';    // Clear loading text

        // Create Material Boxes
        for (const materialType of Config.INVENTORY_MATERIALS) {
            createItemSlot(materialType, inventoryBoxesContainerEl, 'material');
        }
        // Create Weapon Boxes
        for (const weaponType of WEAPON_SLOTS_ORDER) {
            createItemSlot(weaponType, weaponSlotsContainerEl, 'weapon');
        }
    } else {
        success = false;
    }

    // --- Add Event Listeners and Set Initial State ---
    if (success) {
        setupActionButtons();
        toggleControlsButtonEl.addEventListener('click', toggleActionControls);

        // Set initial state for health/inventory on init
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false); // Set initial empty state
        updateWaveInfo(); // Set initial loading state for wave info
    }

    if (!success) {
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
        else slotDiv.textContent = '?';
        slotDiv.title = `${itemType.toUpperCase()} (Not Found)`;
        slotDiv.style.backgroundColor = itemConfig?.color ? `${itemConfig.color}40` : '#111'; // Slightly transparent initially? Or make it disabled style
    }

    slotDiv.addEventListener('click', () => {
        handleItemSlotClick(itemType, category);
    });

    container.appendChild(slotDiv);
    itemSlotDivs[itemType] = slotDiv;
}

// Helper to handle clicks on item/weapon slots
function handleItemSlotClick(itemType, category) {
     if (!playerRef) {
        console.error("UI Item Click: playerRef is null!");
        return;
    }

    // Allow selecting unarmed slot even if playerRef is null? (If unarmed button added)
    // Or maybe just ignore clicks if playerRef is null (game not running)
     if (playerRef.getCurrentlySelectedItem() === itemType) {
         // Already selected, maybe switch to unarmed if clicked again?
         if (itemType !== Config.WEAPON_TYPE_UNARMED) { // Prevent double clicking unarmed
             playerRef.equipItem(Config.WEAPON_TYPE_UNARMED);
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
function setupActionButtons() {
    // Movement Buttons (Holdable)
    // We need to map UI button actions to the keys used in Input.js state
    const buttonActionMap = {
        'btn-move-left': 'left',
        'btn-move-right': 'right',
        'btn-jump': 'jump',
        'btn-attack': 'attack',
        'btn-pause': 'pause'
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
                if (typeof window.pauseGameCallback === 'function') {
                    window.pauseGameCallback(); // Call the exposed pause function
                } else {
                    console.warn("UI: Pause callback (window.pauseGameCallback) not found!");
                }
            });
            return; // Skip holdable listeners for pause
        }

        // Holdable/Toggleable listeners for movement and attack
        const handlePress = (e) => {
            e.preventDefault(); // Prevent default touch behaviors
             // Ensure Input state is accessible and not game over/paused
            if (window.Input?.state && typeof window.pauseGameCallback !== 'function') { // Check for pause callback existence implies game state? Or add a specific check?
                 // Better: Add a check for main game state or use playerRef status
                 // For now, rely on main.js/player update ignoring input if paused/dead
                const inputState = window.Input.state;
                if (action === 'attack') {
                     // Only trigger attack if not already attacking this frame
                     if (!inputState[action]) {
                         inputState[action] = true;
                         illuminateButton(action);
                     }
                 } else { // Movement actions
                      // Only set state and illuminate if not already pressed
                      if (!inputState[action]) {
                          inputState[action] = true;
                          illuminateButton(action);
                      }
                 }
            } else {
                 // console.log("Input state not accessible or game paused/over.");
            }
        };
        const handleRelease = (e) => {
             e.preventDefault();
            if (window.Input?.state) {
                // Movement actions are set to false on release
                if (action !== 'attack') { // Attack is consumed in main loop
                    window.Input.state[action] = false;
                }
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


// Toggles the visibility of the action buttons area
function toggleActionControls() {
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
    if (playerRef && healthBarFillEl) {
         // Request an initial update for player UI elements
         requestAnimationFrame(() => {
             updatePlayerInfo(
                 playerRef.getCurrentHealth(), playerRef.getMaxHealth(),
                 playerRef.getInventory(), playerRef.hasWeapon(Config.WEAPON_TYPE_SWORD),
                 playerRef.hasWeapon(Config.WEAPON_TYPE_SPEAR), playerRef.hasWeapon(Config.WEAPON_TYPE_SHOVEL)
             );
         });
    } else if (!playerRef && healthBarFillEl) {
        // Clear UI if player is removed (restart or game over)
        healthBarFillEl.style.width = '0%';
        healthTextEl.textContent = '---';
        // Also reset inventory/weapon UI
        for(const key in itemSlotDivs){
            itemSlotDivs[key]?.classList.remove('active');
            itemSlotDivs[key]?.classList.add('disabled'); // Disable all slots
            const countSpan = itemSlotDivs[key]?.querySelector('.item-count');
            if (countSpan) countSpan.textContent = ''; // Clear counts
            // Reset weapon text/title? (Currently just sets disabled class)
        }
    }
}

// Briefly illuminates a specific action button
export function illuminateButton(actionName) {
    // Map internal action name to button ID
    const actionButtonMap = {
         'left': document.getElementById('btn-move-left'),
         'right': document.getElementById('btn-move-right'),
         'jump': document.getElementById('btn-jump'),
         'attack': document.getElementById('btn-attack'),
         'pause': document.getElementById('btn-pause')
    };
    const button = actionButtonMap[actionName];
    if (!button) return;

    if (buttonIlluminationTimers[actionName]) {
        clearTimeout(buttonIlluminationTimers[actionName]);
    }
    button.classList.add('illuminated');

    buttonIlluminationTimers[actionName] = setTimeout(() => {
        button.classList.remove('illuminated');
        delete buttonIlluminationTimers[actionName];
    }, ILLUMINATION_DURATION);
}

// --- Update Functions ---

// Updates the wave information display
// Receives full waveInfo object from waveManager.getWaveInfo()
export function updateWaveInfo(waveInfo = {}) {
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl) {
        console.error("UI UpdateWaveInfo: Missing essential elements.");
        return;
    }

    // Default/loading state if no info is provided yet
    if (!waveInfo.state) {
         waveStatusEl.textContent = 'Loading...';
         waveTimerEl.textContent = '';
         enemyCountEl.textContent = '';
         return;
    }

    // Always show the wave number label
    waveStatusEl.textContent = `Wave ${waveInfo.mainWaveNumber || '-'}`;
    waveTimerEl.textContent = ''; // Default empty
    enemyCountEl.textContent = ''; // Default empty

    // Update based on state
    switch (waveInfo.state) {
        case 'PRE_WAVE':
            waveStatusEl.textContent = `Next Wave: ${waveInfo.mainWaveNumber || 1}`;
            waveTimerEl.textContent = `${waveInfo.timerLabel} ${Math.max(0, waveInfo.timer).toFixed(1)}s`;
            break;
        case 'WAVE_COUNTDOWN':
            waveStatusEl.textContent = `Wave ${waveInfo.mainWaveNumber}`;
            waveTimerEl.textContent = `${waveInfo.timerLabel} ${Math.max(0, waveInfo.timer).toFixed(1)}s`; // Show countdown
            if (waveInfo.progressText) {
                 enemyCountEl.textContent = waveInfo.progressText; // Show spawning progress or 'spawning complete'
            }
            // Show living enemy count below progress text if needed? Or integrate into progressText
             const livingEnemies = EnemyManager.getLivingEnemyCount(); // Get live count directly
             if (livingEnemies > 0) {
                 // Append living count, maybe on a new line? Or just use the progress text
                 // Let's append to progressText for simplicity for now.
                 enemyCountEl.textContent += livingEnemies > 0 ? ` (Alive: ${livingEnemies})` : '';
             } else if (!waveInfo.progressText || livingEnemies === 0) {
                 // If no specific spawning progress text, just show living count
                 enemyCountEl.textContent = `Enemies Alive: ${livingEnemies}`;
             }


            break;
        case 'INTERMISSION':
            waveStatusEl.textContent = `Wave ${waveInfo.mainWaveNumber} Complete`; // Show previous wave number
            waveTimerEl.textContent = `${waveInfo.timerLabel} ${Math.max(0, waveInfo.timer).toFixed(1)}s`; // Show intermission timer
            break;
        case 'GAME_OVER':
            waveStatusEl.textContent = 'GAME OVER';
            // Timer text can show waves survived, handled in main.js overlay
            // enemyCountEl can be empty
            break;
        case 'VICTORY':
            waveStatusEl.textContent = 'VICTORY!';
            waveTimerEl.textContent = `Cleared All ${waveInfo.mainWaveNumber} Waves!`;
            // enemyCountEl can be empty
            break;
        default:
             // Handle other potential states or unknown states
             waveStatusEl.textContent = `Wave ${waveInfo.mainWaveNumber || '-'}`;
             waveTimerEl.textContent = waveInfo.timerLabel || '';
             enemyCountEl.textContent = waveInfo.progressText || '';
             break;
    }
}

// Updates player health bar and inventory/weapon slots
// Receives info directly, decouples from playerRef needing to be set first for this call
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
    if (!healthBarFillEl || !healthTextEl || !inventoryBoxesContainerEl || !weaponSlotsContainerEl) {
         console.error("UI UpdatePlayerInfo: Missing essential elements.");
         return;
    }

    // Update Health Bar (Top Sidebar)
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    healthBarFillEl.style.width = `${healthPercent}%`;
    healthTextEl.textContent = `${Math.round(clampedHealth)}/${maxHealth}`;

    // Update Item/Weapon Selection Boxes (Bottom Sidebar)
    // Need the currently selected item type. Get it from playerRef if available.
    const selectedItem = playerRef ? playerRef.getCurrentlySelectedItem() : null;

    // Update Material Boxes
    for (const materialType of Config.INVENTORY_MATERIALS) {
        const slotDiv = itemSlotDivs[materialType];
        if (!slotDiv) continue;
        const count = inventory[materialType] || 0;
        const countSpan = slotDiv.querySelector('.item-count');
        if (countSpan) countSpan.textContent = count > 0 ? Math.min(count, 999) : ''; // Show count if > 0
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
         // Only mark as active if the playerRef exists and has this item selected AND possesses it
        slotDiv.classList.toggle('active', playerRef && possessed && selectedItem === weaponType);
        slotDiv.title = possessed ? weaponType.toUpperCase() : `${weaponType.toUpperCase()} (Not Found)`;
    }
}