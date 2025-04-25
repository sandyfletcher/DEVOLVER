// -----------------------------------------------------------------------------
// root/js/ui.js - Manages HTML Sidebar Elements and Updates
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- Cache DOM Element References ---

// Top Sidebar
let playerColumnEl, portalColumnEl;
let healthLabelEl, healthBarContainerEl, healthBarFillEl, healthTextEl;
let waveStatusEl, waveTimerEl, enemyCountEl;

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
const ALL_SELECTABLE_ITEMS = [...Config.INVENTORY_MATERIALS, ...WEAPON_SLOTS_ORDER];

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
    enemyCountEl = document.getElementById('enemy-count');

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
    buttonIlluminationTimers = {};

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
    slotDiv.classList.add('disabled');

    const itemConfig = Config.ITEM_CONFIG[itemType];

    if (category === 'material') {
        slotDiv.style.backgroundColor = itemConfig?.color || '#444';
        slotDiv.title = `${itemType.toUpperCase()} (0)`;
        const countSpan = document.createElement('span');
        countSpan.classList.add('item-count');
        countSpan.textContent = '';
        slotDiv.appendChild(countSpan);
    } else if (category === 'weapon') {
        if (itemType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
        else if (itemType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑';
        else if (itemType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️';
        else slotDiv.textContent = '?';
        slotDiv.title = `${itemType.toUpperCase()} (Not Found)`;
        slotDiv.style.backgroundColor = itemConfig?.color ? `${itemConfig.color}40` : '#111';
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

    let canSelect = false;
    if (category === 'material') {
        canSelect = (playerRef.inventory[itemType] || 0) > 0;
    } else if (category === 'weapon') {
        canSelect = playerRef.hasWeapon(itemType);
    }

    if (canSelect) {
        playerRef.equipItem(itemType);
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
    ['left', 'right', 'jump'].forEach(action => {
        const button = actionButtons[action];
        if (!button) return;

        const handlePress = (e) => {
            e.preventDefault();
            if (window.Input && window.Input.state) {
                if (!window.Input.state[action]) illuminateButton(action);
                window.Input.state[action] = true;
            }
        };
        const handleRelease = (e) => {
             e.preventDefault();
             if (window.Input && window.Input.state) {
                 window.Input.state[action] = false;
            }
        };

        button.addEventListener('mousedown', handlePress);
        button.addEventListener('mouseup', handleRelease);
        button.addEventListener('mouseleave', handleRelease);
        button.addEventListener('touchstart', handlePress, { passive: false });
        button.addEventListener('touchend', handleRelease, { passive: false });
        button.addEventListener('touchcancel', handleRelease, { passive: false });
    });

    // Attack Button (Single Trigger)
    const attackButton = actionButtons.attack;
    if (attackButton) {
        const handleAttackPress = (e) => {
            e.preventDefault();
             if (window.Input && window.Input.state && !window.Input.state.attack) {
                 window.Input.state.attack = true;
                 illuminateButton('attack');
            }
        };
        attackButton.addEventListener('mousedown', handleAttackPress);
        attackButton.addEventListener('touchstart', handleAttackPress, { passive: false });
    }

    // Pause Button (Direct action)
    const pauseButton = actionButtons.pause;
    if (pauseButton) {
        pauseButton.addEventListener('click', (e) => {
            e.preventDefault();
             illuminateButton('pause');
            if (typeof window.pauseGameCallback === 'function') {
                window.pauseGameCallback();
            } else {
                console.warn("UI: Pause callback (window.pauseGameCallback) not found!");
            }
        });
    }
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
    if (playerRef && healthBarFillEl) {
         requestAnimationFrame(() => {
             updatePlayerInfo(
                 playerRef.getCurrentHealth(), playerRef.getMaxHealth(),
                 playerRef.getInventory(), playerRef.getSwordStatus(),
                 playerRef.getSpearStatus(), playerRef.getShovelStatus()
             );
         });
    } else if (!playerRef && healthBarFillEl) {
        // Clear UI if player is removed (restart)
        healthBarFillEl.style.width = '0%';
        healthTextEl.textContent = '---';
        for(const key in itemSlotDivs){
            itemSlotDivs[key]?.classList.remove('active');
            itemSlotDivs[key]?.classList.add('disabled');
            const countSpan = itemSlotDivs[key]?.querySelector('.item-count');
            if (countSpan) countSpan.textContent = '';
        }
    }
}

// Briefly illuminates a specific action button
export function illuminateButton(actionName) {
    const button = actionButtons[actionName];
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
export function updateWaveInfo(waveInfo = {}, livingEnemies = 0) {
    if (!waveStatusEl || !waveTimerEl || !enemyCountEl) return;

    let statusText = '';
    let timerText = '';
    let enemyText = '';

    if (waveInfo.isGameOver) {
        statusText = 'GAME OVER';
        timerText = `Survived ${waveInfo.mainWaveNumber > 0 ? waveInfo.mainWaveNumber - 1 : 0} Waves`;
        enemyText = '';
    } else if (waveInfo.allWavesCleared) {
        statusText = 'VICTORY!';
        timerText = 'All Waves Cleared!';
        enemyText = '';
    } else {
        statusText = `Wave ${waveInfo.mainWaveNumber || 1}`;
        if (waveInfo.timerLabel && waveInfo.timer > 0) {
            timerText = `${waveInfo.timerLabel} ${waveInfo.timer.toFixed(1)}s`;
        } else {
            timerText = waveInfo.progressText || '';
        }
        if (waveInfo.state === 'ACTIVE' || waveInfo.state === 'SPAWNING') {
            enemyText = `Enemies Remaining: ${livingEnemies}`;
        } else {
            enemyText = '';
        }
    }

    waveStatusEl.textContent = statusText;
    waveTimerEl.textContent = timerText;
    enemyCountEl.textContent = enemyText;
}

// Updates player health bar and inventory/weapon slots
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
    if (!healthBarFillEl || !healthTextEl || !inventoryBoxesContainerEl || !weaponSlotsContainerEl) return;
    if (!playerRef) {
        // Update health bar even if playerRef is missing temporarily
        const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
        const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
        if(healthBarFillEl) healthBarFillEl.style.width = `${healthPercent}%`;
        if(healthTextEl) healthTextEl.textContent = `${Math.round(clampedHealth)}/${maxHealth}`;
        return;
    }

    // Update Health Bar (Top Sidebar)
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    healthBarFillEl.style.width = `${healthPercent}%`;
    healthTextEl.textContent = `${Math.round(clampedHealth)}/${maxHealth}`;

    // Update Item/Weapon Selection Boxes (Bottom Sidebar)
    const selectedItem = playerRef.getCurrentlySelectedItem();

    // Update Material Boxes
    for (const materialType of Config.INVENTORY_MATERIALS) {
        const slotDiv = itemSlotDivs[materialType];
        if (!slotDiv) continue;
        const count = inventory[materialType] || 0;
        const countSpan = slotDiv.querySelector('.item-count');
        if (countSpan) countSpan.textContent = count > 0 ? Math.min(count, 999) : '';
        const isDisabled = count === 0;
        slotDiv.classList.toggle('disabled', isDisabled);
        slotDiv.classList.toggle('active', selectedItem === materialType);
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
        slotDiv.classList.toggle('active', possessed && selectedItem === weaponType);
        slotDiv.title = possessed ? weaponType.toUpperCase() : `${weaponType.toUpperCase()} (Not Found)`;
    }
}