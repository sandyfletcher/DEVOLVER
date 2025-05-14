// root/js/ui.js - Manages HTML Sidebar Elements and Updates

import * as Config from './utils/config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';

// Top UI Overlay (replaces top-sidebar)
let topUiOverlayEl = null;
let playerColumnEl, portalColumnEl;
let playerHealthBarContainerEl, playerHealthBarFillEl;
let portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl;
let timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl;
// Bottom UI Overlay (replaces bottom-sidebar)
let bottomUiOverlayEl;
let itemSelectionAreaEl;
let inventoryBoxesContainerEl, weaponSlotsContainerEl;
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
const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL];
let isUIReady = false;
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
    // --- Find Top UI Overlay Elements ---
    topUiOverlayEl = document.getElementById('top-ui-overlay'); // New
    // Elements within top-ui-overlay (their IDs remain the same)
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
    // --- Find Bottom UI Overlay Elements ---
    bottomUiOverlayEl = document.getElementById('bottom-ui-overlay'); // New
    // Elements within bottom-ui-overlay (their IDs remain the same)
    itemSelectionAreaEl = document.getElementById('item-selection-area');
    inventoryBoxesContainerEl = document.getElementById('inventory-boxes-container');
    weaponSlotsContainerEl = document.getElementById('weapon-slots-container');
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
        topUiOverlayEl, // Check new parent
        playerColumnEl, portalColumnEl,
        playerHealthBarContainerEl, playerHealthBarFillEl,
        portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl,
        timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl,
        bottomUiOverlayEl, // Check new parent
        itemSelectionAreaEl, inventoryBoxesContainerEl, weaponSlotsContainerEl,
        settingsBtnToggleGrid, settingsBtnMuteMusic, settingsBtnMuteSfx,
        settingsValueGrid, settingsValueMusic, settingsValueSfx,
        epochOverlayEl
    ];
    if (requiredElements.some(el => !el)) {
        console.error("UI InitGameUI: Could not find all expected game UI elements!");
        const elementNames = [
            'topUiOverlayEl', 
            'playerColumnEl', 'portalColumnEl',
            'playerHealthBarContainerEl', 'playerHealthBarFillEl',
            'portalColumnH2El', 'portalHealthBarContainerEl', 'portalHealthBarFillEl',
            'timerRowEl', 'timerBarContainerEl', 'timerBarFillEl', 'timerTextOverlayEl',
            'bottomUiOverlayEl', 
            'itemSelectionAreaEl', 'inventoryBoxesContainerEl', 'weaponSlotsContainerEl',
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
    // --- Create Item/Weapon Selection Boxes Dynamically ---
    if (inventoryBoxesContainerEl && weaponSlotsContainerEl) {
        inventoryBoxesContainerEl.innerHTML = '';
        weaponSlotsContainerEl.innerHTML = '';
        // Create 15 Material Slots
        for (let i = 0; i < 15; i++) {
            if (i < Config.INVENTORY_MATERIALS.length) {
                createItemSlot(Config.INVENTORY_MATERIALS[i], inventoryBoxesContainerEl, 'material');
            } else {
                // Create a placeholder slot
                createItemSlot(`placeholder_material_${i - Config.INVENTORY_MATERIALS.length}`, inventoryBoxesContainerEl, 'material-placeholder');
            }
        }
        for (let i = 0; i < 15; i++) { // Create 15 Weapon Slots
            if (i < WEAPON_SLOTS_ORDER.length) {
                createItemSlot(WEAPON_SLOTS_ORDER[i], weaponSlotsContainerEl, 'weapon');
            } else {
                // Create a placeholder slot
                createItemSlot(`placeholder_weapon_${i - WEAPON_SLOTS_ORDER.length}`, weaponSlotsContainerEl, 'weapon-placeholder');
            }
        }
    } else { 
        success = false;
    }
    if (success) {     // --- Set Initial States and Add Event Listeners ---
        settingsBtnToggleGrid.addEventListener('click', () => { // Add Event Listeners for Settings Buttons
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
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false); // Initial states
        updatePortalInfo(0, Config.PORTAL_INITIAL_HEALTH);
        updateWaveTimer({ state: 'LOADING', timer: 0, maxTimer: 1, progressText: "Loading...", mainWaveNumber: 0 });
        isUIReady = true;
    } else {
        isUIReady = false;
        console.error("UI: Failed to initialize some critical Game UI elements.");
    }
    return success;
}
function createItemSlot(itemType, container, category) { // Helper to create and setup a single item/weapon slot div
     if (!container) {
        console.error(`UI createItemSlot: Container element is null for type "${itemType}".`);
        return;
    }
    const slotDiv = document.createElement('div');
    slotDiv.classList.add('item-box');
    slotDiv.dataset.item = itemType; 
    slotDiv.dataset.category = category; 
    slotDiv.classList.add('disabled'); 
    const itemConfig = Config.ITEM_CONFIG[itemType];
    let titleText = itemType.toUpperCase(); 
    if (category === 'material') {
        slotDiv.style.backgroundColor = itemConfig?.color || '#444'; 
        const countSpan = document.createElement('span'); 
        countSpan.classList.add('item-count');
        countSpan.textContent = ''; 
        slotDiv.appendChild(countSpan); 
        titleText += ' (0)'; 
        if (itemType === 'dirt' || itemType === 'vegetation') {
            slotDiv.classList.add('material-quadrant-box'); 
            const quadrantContainer = document.createElement('div');
            quadrantContainer.classList.add('quadrant-container');

            const quadrantClasses = ['quadrant-tl', 'quadrant-tr', 'quadrant-bl', 'quadrant-br'];
            quadrantClasses.forEach(qClassSuffix => {
                const quadrantDiv = document.createElement('div');
                quadrantDiv.classList.add('quadrant', qClassSuffix); 
                quadrantContainer.appendChild(quadrantDiv);
            });
            slotDiv.insertBefore(quadrantContainer, countSpan); 
        }
    } else if (category === 'weapon') {
        if (itemType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
        else if (itemType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑';
        else if (itemType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️';
        else if (itemType === Config.WEAPON_TYPE_UNARMED) slotDiv.textContent = '👊';
        else slotDiv.textContent = '?'; 
        titleText += ' (Unavailable)'; 
    } else if (category.includes('-placeholder')) {
        slotDiv.textContent = ''; 
        slotDiv.style.backgroundColor = '#2a2a2a'; 
        slotDiv.classList.add('placeholder-slot'); 
        titleText = 'Empty Slot';
    }
    slotDiv.title = titleText; 
    if (!category.includes('-placeholder')) {
        slotDiv.addEventListener('click', () => {
            handleItemSlotClick(itemType, category);
        });
    }
    container.appendChild(slotDiv);
    itemSlotDivs[itemType] = slotDiv;
}
// Helper function to handle clicks on item/weapon slots
function handleItemSlotClick(itemType, category) {
    if (category.includes('-placeholder')) {
        return;
    }
     if (!playerRef || !isUIReady) {
        const slotDiv = itemSlotDivs[itemType];
        if(slotDiv && typeof slotDiv.animate === 'function') {
            slotDiv.animate([
                { transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }
            ], { duration: 100, easing: 'ease-in-out' });
        }
        return; 
    }
    let success = false; 
    if (category === 'material') {
        success = playerRef.setActiveInventoryMaterial(itemType);
    } else if (category === 'weapon') {
        success = playerRef.setActiveWeapon(itemType);
    }
    const slotDiv = itemSlotDivs[itemType];
    if(slotDiv && typeof slotDiv.animate === 'function') {
        if (!success) {
            slotDiv.animate([
                { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' },
                { transform: 'translateX(-3px)' }, { transform: 'translateX(0px)' }
            ], { duration: 200, easing: 'ease-in-out' });
        } else {
            slotDiv.animate([
                { transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }
            ], { duration: 150, easing: 'ease-out' });
        }
    }
}
export function setPlayerReference(playerObject) { // Sets the reference to the player object
    playerRef = playerObject;
    if (playerRef) {
        requestAnimationFrame(() => {
            updatePlayerInfo(
                playerRef.getCurrentHealth(), playerRef.getMaxHealth(),
                playerRef.getInventory(), playerRef.hasWeapon(Config.WEAPON_TYPE_SWORD),
                playerRef.hasWeapon(Config.WEAPON_TYPE_SPEAR), playerRef.hasWeapon(Config.WEAPON_TYPE_SHOVEL)
            );
        });
    } else {
        if (playerHealthBarFillEl) playerHealthBarFillEl.style.width = '0%';
        for(const key in itemSlotDivs){
            const slotDiv = itemSlotDivs[key];
            if(!slotDiv) continue; 
            slotDiv.classList.remove('active'); 
            slotDiv.classList.add('disabled'); 
            if(slotDiv.classList.contains('placeholder-slot')) { 
                 slotDiv.title = 'Empty Slot';
            }
            if (slotDiv.dataset.category === 'material') {
                const countSpan = slotDiv.querySelector('.item-count');
                if (countSpan) countSpan.textContent = ''; 
                slotDiv.title = `${key.toUpperCase()} (0)`; 
            } else if (slotDiv.dataset.category === 'weapon') {
                slotDiv.title = `${key.toUpperCase()} (Unavailable)`;
            }
        }
    }
}
export function setPortalReference(portalObject) { // Sets the reference to the portal object
    portalRef = portalObject;
    if (portalRef) {
        requestAnimationFrame(() => {
            updatePortalInfo(portalRef.currentHealth, portalRef.maxHealth);
        });
    } else {
        if (portalHealthBarFillEl) portalHealthBarFillEl.style.width = '0%';
        if (portalColumnH2El) portalColumnH2El.style.color = 'white'; 
    }
}
export function updateSettingsButtonStates(isGridVisible, isMusicMuted, isSfxMuted) { // Updates the visual state of settings buttons
    if (settingsBtnToggleGrid && settingsValueGrid) {
        settingsBtnToggleGrid.classList.toggle('active', isGridVisible);
        settingsBtnToggleGrid.title = isGridVisible ? 'Hide Grid Overlay' : 'Show Grid Overlay';
        settingsValueGrid.textContent = isGridVisible ? 'ON' : 'OFF';
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
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) { // Updates player health bar and inventory/weapon slots
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
        if (!slotDiv || slotDiv.classList.contains('placeholder-slot')) { 
            continue;
        }
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
            if (quadrants.length === 4) { 
                 quadrants[0].classList.toggle('filled', partialCount >= 1);
                 quadrants[1].classList.toggle('filled', partialCount >= 2);
                 quadrants[2].classList.toggle('filled', partialCount >= 3);
                 quadrants[3].classList.toggle('filled', partialCount >= 4); 
            }
        } else {
            isDisabled = (count === 0);
        }
        slotDiv.classList.toggle('disabled', isDisabled);
        slotDiv.classList.toggle('active', playerRef && selectedItem === materialType && !isDisabled);
        slotDiv.title = currentTitle;
    }
    const playerPossession = {
        [Config.WEAPON_TYPE_SHOVEL]: hasShovel,
        [Config.WEAPON_TYPE_SPEAR]: hasSpear,
        [Config.WEAPON_TYPE_SWORD]: hasSword,
    };
    for (const weaponType of WEAPON_SLOTS_ORDER) {
        const slotDiv = itemSlotDivs[weaponType];
        if (!slotDiv || slotDiv.classList.contains('placeholder-slot')) { 
            continue; 
        }
        const possessed = playerPossession[weaponType]; 
        const recipe = Config.CRAFTING_RECIPES[weaponType]; 
        const isCraftable = recipe !== undefined; 
        let canInteract = false; 
        let titleText = weaponType.toUpperCase(); 
        if (possessed) {
            canInteract = true;
            titleText += ' (Owned)'; 
        } else if (isCraftable) {
            let canAfford = true;
            if (playerRef) { 
                for (const ingredient of recipe) {
                    const requiredType = ingredient.type;
                    const requiredAmount = ingredient.amount;
                    const possessedAmount = inventory[requiredType] || 0; 
                    if (possessedAmount < requiredAmount) {
                        canAfford = false;
                        break; 
                    }
                }
            } else {
                canAfford = false; 
            }
            if (canAfford) {
                canInteract = true;
                titleText += ' (Click to Craft)'; 
            } else {
                canInteract = false;
                titleText += ' (Need: '; 
                titleText += recipe.map(ing => `${ing.amount} ${ing.type.charAt(0).toUpperCase() + ing.type.slice(1)}`).join(', '); 
                titleText += ')';
            }
        } else {
            canInteract = false;
            titleText += ' (Unavailable)'; 
        }
        slotDiv.classList.toggle('disabled', !canInteract);
        slotDiv.classList.toggle('active', playerRef && selectedItem === weaponType);
        slotDiv.title = titleText;
    }
}
export function updatePortalInfo(currentHealth, maxHealth) { // Updates the portal health bar and its title color
    if (!portalHealthBarFillEl || !portalColumnH2El || !portalColumnEl) {
        console.error("UI UpdatePortalInfo: Missing essential elements.");
        if(portalHealthBarFillEl){
            const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
            const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
            portalHealthBarFillEl.style.width = `${healthPercent}%`;
        }
        return; 
    }
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    portalHealthBarFillEl.style.width = `${healthPercent}%`;
    const healthPercentRatio = (maxHealth > 0) ? (clampedHealth / maxHealth) : 0;
    if (portalColumnH2El.style) {
        if (healthPercentRatio > 0.5) portalColumnH2El.style.color = '#aaffaa'; 
        else if (healthPercentRatio > 0.2) portalColumnH2El.style.color = 'yellow'; 
        else portalColumnH2El.style.color = 'red'; 
    }
}
export function updateWaveTimer(waveInfo) { // Updates the wave timer bar and text
    if (!timerBarFillEl || !timerTextOverlayEl || !timerRowEl) {
        console.error("UI UpdateWaveTimer: Missing essential elements.");
        return;
    }
    const { state, timer: currentTimer, maxTimer, mainWaveNumber } = waveInfo;
    const clampedTimer = Math.max(0, Math.min(currentTimer, maxTimer));
    const timerPercent = (maxTimer > 1) ? (clampedTimer / maxTimer) * 100 : (clampedTimer > 0 ? 100 : 0);
    timerBarFillEl.style.width = `${timerPercent}%`;
    let timerText = "";
    let displayTimerValue = true; 
    switch(state) {
        case 'PRE_WAVE':
            timerText = "FIRST WAVE IN";
            break;
        case 'WAVE_COUNTDOWN':
            const livingEnemies = EnemyManager.getLivingEnemyCount(); 
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
        case 'WARPPHASE': 
        case 'WARP_ANIMATING': // Keep WARP_ANIMATING for compatibility if waveManager sends it
            let animStatus = "";
            if (WorldManager && typeof WorldManager.areAgingAnimationsComplete === 'function' && typeof WorldManager.areGravityAnimationsComplete === 'function' && (!WorldManager.areAgingAnimationsComplete() || !WorldManager.areGravityAnimationsComplete())) {
                 animStatus = " (MORPHING...)";
            }
            timerText = `WARPING TO WAVE ${mainWaveNumber}${animStatus}`;
            displayTimerValue = true; // Show timer as it's now a build phase countdown
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
    if (displayTimerValue && state !== 'WARP_ANIMATING' && state !== 'WARPPHASE') { // Don't show raw timer for warp animation, just text
        const minutes = Math.floor(clampedTimer / 60);
        const seconds = Math.floor(clampedTimer % 60);
        const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
        timerText = `${timerText}: ${minutes}:${formattedSeconds}`;
    }
    timerTextOverlayEl.textContent = timerText;
}
export function showEpochText(epochMessage) { // Function to display the epoch text overlay
     if (!epochOverlayEl) {
        console.warn("UI showEpochText: Element not found.", epochOverlayEl);
        return;
    }
    const textToDisplay = (typeof epochMessage === 'string' && epochMessage.trim() !== "") ? epochMessage : 'Wave Starting';
    epochOverlayEl.textContent = textToDisplay;
    if (epochOverlayEl._hideTimer) {
        clearTimeout(epochOverlayEl._hideTimer);
        epochOverlayEl._hideTimer = null; 
    }
    epochOverlayEl.style.visibility = 'visible';
    epochOverlayEl.style.opacity = '1';
    const displayDurationMs = Config.EPOCH_DISPLAY_DURATION * 1000;
    epochOverlayEl._hideTimer = setTimeout(() => {
        epochOverlayEl.style.opacity = '0'; 
        const transitionDurationMs = 500; 
        epochOverlayEl._hideTimer = setTimeout(() => {
            epochOverlayEl.style.visibility = 'hidden';
            epochOverlayEl._hideTimer = null; 
        }, transitionDurationMs);
    }, displayDurationMs); 
}
export function isInitialized() { // Add a getter to check if the main game UI initialization was successful
    return isUIReady;
}