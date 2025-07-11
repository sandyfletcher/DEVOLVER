// -----------------------------------------------------------------------------
// root/js/uiManager.js - Manages HTML Sidebar Elements and Updates
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';
import * as DebugLogger from './utils/debugLogger.js';

let topUiOverlayEl = null;
let playerColumnEl, portalColumnEl;
let playerHealthBarContainerEl, playerHealthBarFillEl;
let portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl;
let timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl;
let bottomUiOverlayEl;
let itemSelectionAreaEl;
let inventoryBoxesContainerEl, weaponSlotsContainerEl;
let settingsBtnToggleGrid = null;
let settingsBtnMuteMusic = null;
let settingsBtnMuteSfx = null;
let settingsValueGrid = null;
let settingsValueMusic = null;
let settingsValueSfx = null;
let bootOverlayEl = null;
let epochOverlayEl = null;
let epochHideTimer = null;
let pauseMenuEpochTextEl = null;
let playerRef = null;
let portalRef = null;
const itemSlotDivs = {};
const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SHOVEL, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_BOW];
let isUIReady = false;
let isMyaTransitionActive = false;
let myaTransitionFrom = 0;
let myaTransitionTo = 0;
let myaTransitionTimer = 0;
let myaTransitionDuration = 0;
let myaTransitionCurrentDisplayValue = 0;

// Add this for timing logs
let myaAnimStartTime = 0;

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
    topUiOverlayEl = document.getElementById('top-ui-overlay');
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
    bottomUiOverlayEl = document.getElementById('bottom-ui-overlay');
    itemSelectionAreaEl = document.getElementById('item-selection-area');
    inventoryBoxesContainerEl = document.getElementById('inventory-boxes-container');
    weaponSlotsContainerEl = document.getElementById('weapon-slots-container');
    settingsBtnToggleGrid = document.getElementById('settings-btn-toggle-grid');
    settingsBtnMuteMusic = document.getElementById('settings-btn-mute-music');
    settingsBtnMuteSfx = document.getElementById('settings-btn-mute-sfx');
    settingsValueGrid = document.getElementById('settings-value-grid');
    settingsValueMusic = document.getElementById('settings-value-music');
    settingsValueSfx = document.getElementById('settings-value-sfx');
    epochOverlayEl = document.getElementById('epoch-overlay');
    pauseMenuEpochTextEl = document.getElementById('pause-menu-epoch-text');
    const requiredElements = [ // verification
        topUiOverlayEl, playerColumnEl, portalColumnEl, playerHealthBarContainerEl, playerHealthBarFillEl, 
        portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl, timerRowEl, timerBarContainerEl, 
        timerBarFillEl, timerTextOverlayEl, bottomUiOverlayEl,itemSelectionAreaEl, inventoryBoxesContainerEl, 
        weaponSlotsContainerEl, settingsBtnToggleGrid, settingsBtnMuteMusic, settingsBtnMuteSfx, epochOverlayEl, pauseMenuEpochTextEl
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
            'epochOverlayEl',
            'pauseMenuEpochTextEl'
        ];
        requiredElements.forEach((el, index) => {
            if (!el) console.error(`Missing UI element: ${elementNames[index]}`);
        });
        success = false;
    }
    if (inventoryBoxesContainerEl) inventoryBoxesContainerEl.innerHTML = 'Loading...'; // clear previous dynamic content and listeners
    if (weaponSlotsContainerEl) weaponSlotsContainerEl.innerHTML = '';
    for (const key in itemSlotDivs) {
        delete itemSlotDivs[key];
    }
    if (inventoryBoxesContainerEl && weaponSlotsContainerEl) { // create item/weapon selection boxes dynamically
        inventoryBoxesContainerEl.innerHTML = '';
        weaponSlotsContainerEl.innerHTML = '';
        for (let i = 0; i < 15; i++) { // create 15 material slots
            const materialType = Config.INVENTORY_MATERIALS[i];
            if (materialType && materialType !== 'arrows') { // Exclude arrows from material bar
                createItemSlot(materialType, inventoryBoxesContainerEl, 'material');
            } else {
                createItemSlot(`placeholder_material_${i}`, inventoryBoxesContainerEl, 'material-placeholder'); // create placeholder slot
            }
        }
        for (let i = 0; i < 15; i++) { // create 15 weapon slots
            if (i < WEAPON_SLOTS_ORDER.length) {
                createItemSlot(WEAPON_SLOTS_ORDER[i], weaponSlotsContainerEl, 'weapon');
            } else {
                createItemSlot(`placeholder_weapon_${i - WEAPON_SLOTS_ORDER.length}`, weaponSlotsContainerEl, 'weapon-placeholder'); // create placeholder slot
            }
        }
    } else { 
        success = false;
    }
    if (success) { // set initial states and add event listeners
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
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false, false); // initial state
        updatePortalInfo(0, Config.PORTAL_INITIAL_HEALTH);
        updateWaveTimer({ state: 'LOADING', timer: 0, maxTimer: 1, progressText: "Loading...", mainWaveNumber: 0 });
        updatePauseMenuEpochText(""); // initialize pause menu epoch text as empty
        isUIReady = true;
    } else {
        isUIReady = false;
        console.error("UI: Failed to initialize some critical Game UI elements.");
    }
    return success;
}
function createItemSlot(itemType, container, category) { // create and setup a single item/weapon slot div
     if (!container) {
        console.error(`UI createItemSlot: Container element is null for type "${itemType}".`);
        return;
    }
    const slotDiv = document.createElement('div');
    slotDiv.classList.add('item-box');
    slotDiv.dataset.item = itemType; 
    slotDiv.dataset.category = category; 
    slotDiv.classList.add('disabled'); 
    let titleText = itemType.toUpperCase(); 
    if (category === 'material') {
        const blockTypeForMaterial = Config.MATERIAL_TO_BLOCK_TYPE[itemType];
        const blockProps = Config.BLOCK_PROPERTIES[blockTypeForMaterial];
        slotDiv.style.backgroundColor = blockProps?.color || '#444';
        const countSpan = document.createElement('span'); 
        countSpan.classList.add('item-count'); // For materials
        countSpan.textContent = ''; 
        slotDiv.appendChild(countSpan); 
        titleText += ' (0)'; 
        // Fractional materials now get a special class for the slash effect
        if (itemType === 'dirt' || itemType === 'vegetation' || itemType === 'rock') {
            slotDiv.classList.add('material-half-box'); 
        }
    } else if (category === 'weapon') {
        const weaponStats = Config.WEAPON_STATS[itemType];
        slotDiv.textContent = weaponStats?.symbol || '?'; // Use the new symbol property
        
        const statusSymbolSpan = document.createElement('span'); // For weapons
        statusSymbolSpan.classList.add('weapon-status-symbol');
        statusSymbolSpan.textContent = 'X'; // Default symbol
        slotDiv.appendChild(statusSymbolSpan);

        if (itemType === Config.WEAPON_TYPE_BOW) {
            const ammoCountSpan = document.createElement('span');
            ammoCountSpan.classList.add('item-count'); // Reuse class for styling
            ammoCountSpan.textContent = '';
            slotDiv.appendChild(ammoCountSpan);
        }

        titleText = (weaponStats?.displayName || itemType.toUpperCase()) + ' (Unavailable)'; // Use displayName for title
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
function handleItemSlotClick(itemType, category) { // handle clicks on item/weapon slots
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
export function setPlayerReference(playerObject) { // set reference to player object
    playerRef = playerObject;
    if (playerRef) {
        requestAnimationFrame(() => {
            updatePlayerInfo(
                playerRef.getCurrentHealth(), playerRef.getMaxHealth(),
                playerRef.getInventory(), playerRef.hasWeapon(Config.WEAPON_TYPE_SWORD),
                playerRef.hasWeapon(Config.WEAPON_TYPE_SPEAR), playerRef.hasWeapon(Config.WEAPON_TYPE_SHOVEL),
                playerRef.hasWeapon(Config.WEAPON_TYPE_BOW)
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
                const weaponStats = Config.WEAPON_STATS[key];
                slotDiv.title = `${weaponStats?.displayName || key.toUpperCase()} (Unavailable)`;
                const statusSymbolSpan = slotDiv.querySelector('.weapon-status-symbol'); // Update symbol
                if (statusSymbolSpan) statusSymbolSpan.textContent = 'X';
                if (key === Config.WEAPON_TYPE_BOW) {
                    const ammoCountSpan = slotDiv.querySelector('.item-count');
                    if(ammoCountSpan) ammoCountSpan.textContent = '';
                }
            }
        }
    }
}
export function setPortalReference(portalObject) { // set reference to portal object
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
export function updateSettingsButtonStates(isGridVisible, isMusicMuted, isSfxMuted) {
    if (settingsBtnToggleGrid) {
        settingsBtnToggleGrid.classList.toggle('settings-row__button--state-good', isGridVisible);
        settingsBtnToggleGrid.textContent = isGridVisible ? 'GRID: ON' : 'GRID: OFF';
        settingsBtnToggleGrid.title = isGridVisible ? 'Hide Grid Overlay' : 'Show Grid Overlay';

    }
    if (settingsBtnMuteMusic) {
        settingsBtnMuteMusic.classList.toggle('settings-row__button--state-bad', isMusicMuted);
        settingsBtnMuteMusic.textContent = isMusicMuted ? 'MUSIC: OFF' : 'MUSIC: ON';
        settingsBtnMuteMusic.title = isMusicMuted ? 'Unmute Music' : 'Mute Music';
    }
    if (settingsBtnMuteSfx) {
        settingsBtnMuteSfx.classList.toggle('settings-row__button--state-bad', isSfxMuted);
        settingsBtnMuteSfx.textContent = isSfxMuted ? 'SFX: OFF' : 'SFX: ON';
        settingsBtnMuteSfx.title = isSfxMuted ? 'Unmute SFX' : 'Mute SFX';
    }
}
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel, hasBow) {
    if (!playerHealthBarFillEl || !inventoryBoxesContainerEl || !weaponSlotsContainerEl) {
    console.error("UI UpdatePlayerInfo: Missing essential elements.");
    // if playerHealthBarFillEl exists despite other missing elements, try to update it
    if (playerHealthBarFillEl) {
        const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
        const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
        playerHealthBarFillEl.style.width = `${healthPercent}%`;
    }
    return; // still return if critical elements are missing
}
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    playerHealthBarFillEl.style.width = `${healthPercent}%`;
    const selectedItem = playerRef ? playerRef.getCurrentlySelectedItem() : null;
    const getPartialCollectionFn = playerRef ? playerRef.getPartialCollection.bind(playerRef) : () => 0;
    for (const materialType of Config.INVENTORY_MATERIALS) {
        if (materialType === 'arrows') continue; // Skip arrows in the material bar

        const slotDiv = itemSlotDivs[materialType];
        if (!slotDiv || slotDiv.classList.contains('placeholder-slot')) { 
            continue;
        }
        const count = inventory[materialType] || 0;
        const countSpan = slotDiv.querySelector('.item-count');
        if (countSpan) countSpan.textContent = count > 0 ? Math.min(count, 999) : ''; // CHANGED to 999
        let isDisabled;
        let currentTitle = `${materialType.toUpperCase()} (${count})`;

        // UPDATED: Logic for fractional materials
        if (materialType === 'dirt' || materialType === 'vegetation' || materialType === 'rock') {
            const partialCount = getPartialCollectionFn(materialType);
            isDisabled = (count === 0 && partialCount === 0);
            currentTitle = `${materialType.toUpperCase()} (${count} full, ${partialCount}/2 collected)`;
            slotDiv.classList.toggle('half-collected', partialCount === 1);
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
        [Config.WEAPON_TYPE_BOW]: hasBow,
    };
    for (const weaponType of WEAPON_SLOTS_ORDER) {
        const slotDiv = itemSlotDivs[weaponType];
        if (!slotDiv || slotDiv.classList.contains('placeholder-slot')) { 
            continue; 
        }
        const possessed = playerPossession[weaponType]; 
        const weaponStats = Config.WEAPON_STATS[weaponType];
        const recipe = weaponStats?.recipe;
        
        let canInteract = false; 
        let symbolText = '';
        let titleSuffix = '';
        let ammoCount = 0;

        const statusSymbolSpan = slotDiv.querySelector('.weapon-status-symbol');
        const ammoCountSpan = slotDiv.querySelector('.item-count');

        if (weaponType === Config.WEAPON_TYPE_BOW && possessed) {
            ammoCount = inventory['arrows'] || 0;
            const ammoRecipe = weaponStats.ammoRecipe;
            let canAffordAmmo = true;
            if (playerRef && ammoRecipe) {
                for(const ing of ammoRecipe) {
                    if ((inventory[ing.type] || 0) < ing.amount) {
                        canAffordAmmo = false;
                        break;
                    }
                }
            } else {
                canAffordAmmo = false;
            }

            canInteract = true;
            if (ammoCount > 0) {
                symbolText = '$';
                if (statusSymbolSpan) statusSymbolSpan.style.display = 'none';
                titleSuffix = ` (Arrows: ${ammoCount}) - Click to craft 1 more`;
            } else {
                if (statusSymbolSpan) statusSymbolSpan.style.display = 'block';
                symbolText = canAffordAmmo ? '$' : 'X';
                titleSuffix = ' (Click to craft 1 arrow)';
            }
            
            if (!canAffordAmmo) {
                titleSuffix += ` (Need ${ammoRecipe.map(i => `${i.amount} ${i.type}`).join(', ')})`;
            }

        } else if (possessed) {
            symbolText = '✓';
            titleSuffix = ' (Owned)';
            canInteract = true; 
            if (statusSymbolSpan) statusSymbolSpan.style.display = 'block';
        } else if (recipe && recipe.length > 0) {
            if (statusSymbolSpan) statusSymbolSpan.style.display = 'block';
            let canAfford = true;
            if (playerRef) { 
                for (const ingredient of recipe) {
                    if ((inventory[ingredient.type] || 0) < ingredient.amount) {
                        canAfford = false;
                        break; 
                    }
                }
            } else {
                canAfford = false; 
            }

            if (canAfford) {
                symbolText = '$';
                titleSuffix = ' (Click to Craft)';
                canInteract = true; 
            } else {
                symbolText = 'X';
                titleSuffix = ' (Need: '; 
                titleSuffix += recipe.map(ing => `${ing.amount} ${ing.type.charAt(0).toUpperCase() + ing.type.slice(1)}`).join(', '); 
                titleSuffix += ')';
                canInteract = false;
            }
        } else { 
            if (statusSymbolSpan) statusSymbolSpan.style.display = 'block';
            symbolText = '↑'; 
            titleSuffix = ' (Cannot Craft)';
            canInteract = false;
        }
        
        if (statusSymbolSpan) {
            statusSymbolSpan.textContent = symbolText;
        }

        if (weaponType === Config.WEAPON_TYPE_BOW && ammoCountSpan) {
            ammoCountSpan.textContent = ammoCount > 0 ? Math.min(ammoCount, 999) : '';
        }

        slotDiv.title = (weaponStats?.displayName || weaponType.toUpperCase()) + titleSuffix;
        slotDiv.classList.toggle('disabled', !canInteract);
        slotDiv.classList.toggle('active', playerRef && selectedItem === weaponType && canInteract);
    }
}
export function updatePortalInfo(currentHealth, maxHealth) {
    if (!portalHealthBarFillEl || !portalColumnH2El || !portalColumnEl) {
        console.error("UI UpdatePortalInfo: Missing essential elements.");
        if (portalHealthBarFillEl) { // Attempt to update if at least the fill element exists
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
export function updateWaveTimer(waveInfo) { // updates timer bar and text
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
        case 'WARP_ANIMATING':
            displayTimerValue = false; // don't show raw timer for warp
            timerText = ""; // clear text, epoch overlay will show MYA
            if (timerBarFillEl) timerBarFillEl.style.width = '100%'; // bar full during warp
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
function formatMya(myaValue) { // helper to format MYA values
    if (typeof myaValue !== 'number' || isNaN(myaValue)) return "Time Unknown";
    if (myaValue === 0) return "Present Day";
    return `${Math.round(myaValue)} Million Years Ago`;
}
export function showEpochText(valueOrString) {
    if (!epochOverlayEl) {
        console.warn("UI showEpochText: Element not found.", epochOverlayEl);
        return;
    }
    if (isMyaTransitionActive) {
        return;
    }
    const textToDisplay = (typeof valueOrString === 'number') ? formatMya(valueOrString) : valueOrString;
    epochOverlayEl.textContent = textToDisplay;
    if (epochHideTimer) {
        clearTimeout(epochHideTimer);
        epochHideTimer = null;
    }
    epochOverlayEl.style.transition = 'opacity 0.5s ease-in-out, visibility 0s linear 0s';
    epochOverlayEl.style.visibility = 'visible';
    epochOverlayEl.style.opacity = '1';
    const displayDurationMs = Config.EPOCH_DISPLAY_DURATION * 1000;
    epochHideTimer = setTimeout(() => {
        epochOverlayEl.style.opacity = '0';
        epochHideTimer = setTimeout(() => {
            if (!isMyaTransitionActive) {
                epochOverlayEl.style.visibility = 'hidden';
            }
            epochHideTimer = null;
        }, 500); 
    }, displayDurationMs);
}
export function startMyaEpochTransition(fromMya, toMya, duration) {
    if (!epochOverlayEl) return;
    DebugLogger.log(`[UI] Starting MYA transition from ${fromMya} to ${toMya} over ${duration.toFixed(3)}s`);
    isMyaTransitionActive = true;
    myaTransitionFrom = fromMya;
    myaTransitionTo = toMya;
    myaTransitionDuration = duration;
    myaTransitionTimer = duration;
    myaTransitionCurrentDisplayValue = fromMya;
    if (epochHideTimer) {
        clearTimeout(epochHideTimer);
        epochHideTimer = null;
    }
    epochOverlayEl.style.transition = 'none';
    epochOverlayEl.style.visibility = 'visible';
    epochOverlayEl.style.opacity = '1';
    epochOverlayEl.textContent = formatMya(myaTransitionCurrentDisplayValue);

    myaAnimStartTime = performance.now(); // Record start time
    DebugLogger.log(`[UI] MYA Epoch Transition START. Target Duration: ${duration.toFixed(3)}s. Time: ${myaAnimStartTime.toFixed(2)}ms`);
}
export function updateMyaEpochTransition(dt) {
    if (!isMyaTransitionActive || !epochOverlayEl) return;
    myaTransitionTimer -= dt;
    if (myaTransitionTimer <= 0) {
        isMyaTransitionActive = false;
        epochOverlayEl.textContent = formatMya(myaTransitionTo);
        
        const myaAnimEndTime = performance.now();
        if (myaAnimStartTime > 0) {
            const actualMyaDuration = (myaAnimEndTime - myaAnimStartTime) / 1000;
            DebugLogger.log(`[UI] MYA Epoch Transition END. Actual Duration: ${actualMyaDuration.toFixed(3)}s. Time: ${myaAnimEndTime.toFixed(2)}ms`);
        } else {
            DebugLogger.log(`[UI] MYA Epoch Transition END (no start time recorded). Time: ${myaAnimEndTime.toFixed(2)}ms`);
        }
        myaAnimStartTime = 0; // Reset for next time
        
        epochOverlayEl.style.transition = 'opacity 0.5s ease-in-out, visibility 0s linear 0s';
        epochOverlayEl.style.opacity = '1';
        if (epochHideTimer) clearTimeout(epochHideTimer);
        const finalDisplayDuration = Config.EPOCH_DISPLAY_DURATION * 500; 
        epochHideTimer = setTimeout(() => {
            epochOverlayEl.style.opacity = '0';
            epochHideTimer = setTimeout(() => {
                epochOverlayEl.style.visibility = 'hidden';
                epochHideTimer = null;
            }, 500);
        }, finalDisplayDuration);
        DebugLogger.log(`[UI] MYA transition finished. Displaying: ${formatMya(myaTransitionTo)}`);
        return;
    }
    const progress = Math.max(0, Math.min(1, 1 - (myaTransitionTimer / myaTransitionDuration)));
    let nextDisplayValue = Math.round(myaTransitionFrom + (myaTransitionTo - myaTransitionFrom) * progress);
    if (nextDisplayValue !== myaTransitionCurrentDisplayValue) {
        myaTransitionCurrentDisplayValue = nextDisplayValue;
        epochOverlayEl.textContent = formatMya(myaTransitionCurrentDisplayValue);
    }
}
export function updatePauseMenuEpochText(epochText) {
    if (!pauseMenuEpochTextEl) {
        console.warn("UI updatePauseMenuEpochText: Element not found.");
        return;
    }
    if (epochText && typeof epochText === 'string' && epochText.trim() !== "") {
        pauseMenuEpochTextEl.textContent = epochText;
        pauseMenuEpochTextEl.style.display = 'block';
    } else {
        pauseMenuEpochTextEl.textContent = '';
        pauseMenuEpochTextEl.style.display = 'none';
    }
}
export function isInitialized() { // getter to check if main game UI initialization was successful
    return isUIReady;
}
export function getMyaTransitionInfo() {
    if (isMyaTransitionActive) {
        return {
            timer: myaTransitionTimer,
            duration: myaTransitionDuration,
            isActive: true
        };
    }
    return { timer: 0, duration: 0, isActive: false };
}