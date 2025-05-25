// -----------------------------------------------------------------------------
// root/js/uiManager.js - Manages HTML Sidebar Elements and Updates
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';

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
const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SHOVEL, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SWORD];
let isUIReady = false;
let isMyaTransitionActive = false;
let myaTransitionFrom = 0;
let myaTransitionTo = 0;
let myaTransitionTimer = 0;
let myaTransitionDuration = 0;
let myaTransitionCurrentDisplayValue = 0;

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
            if (i < Config.INVENTORY_MATERIALS.length) {
                createItemSlot(Config.INVENTORY_MATERIALS[i], inventoryBoxesContainerEl, 'material');
            } else {
                createItemSlot(`placeholder_material_${i - Config.INVENTORY_MATERIALS.length}`, inventoryBoxesContainerEl, 'material-placeholder'); // create placeholder slot
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
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false); // initial state
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
        const weaponStats = Config.WEAPON_STATS[itemType];
        slotDiv.textContent = weaponStats?.symbol || '?'; // Use the new symbol property
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
                const weaponStats = Config.WEAPON_STATS[key];
                slotDiv.title = `${weaponStats?.displayName || key.toUpperCase()} (Unavailable)`;
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
    if (settingsBtnMuteSfx /* && settingsValueSfx - settingsValueSfx is removed */) {
        settingsBtnMuteSfx.classList.toggle('settings-row__button--state-bad', isSfxMuted);
        settingsBtnMuteSfx.textContent = isSfxMuted ? 'SFX: OFF' : 'SFX: ON';
        settingsBtnMuteSfx.title = isSfxMuted ? 'Unmute SFX' : 'Mute SFX';
    }
}
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) { // update player health bar and inventory/weapon slots
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
        const weaponStats = Config.WEAPON_STATS[weaponType]; // Get weapon stats
        const recipe = weaponStats?.recipe; // Get recipe from weaponStats
        const isCraftable = recipe !== undefined && recipe.length > 0;
        let canInteract = false; 
        let titleText = weaponStats?.displayName || weaponType.toUpperCase(); // Use display name for title
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
export function updatePortalInfo(currentHealth, maxHealth) { // updates portal health bar and color
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
    console.log(`[UI] Starting MYA transition from ${fromMya} to ${toMya} over ${duration}s`);
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
}
export function updateMyaEpochTransition(dt) {
    if (!isMyaTransitionActive || !epochOverlayEl) return;
    myaTransitionTimer -= dt;
    if (myaTransitionTimer <= 0) {
        isMyaTransitionActive = false;
        epochOverlayEl.textContent = formatMya(myaTransitionTo);
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
        console.log(`[UI] MYA transition finished. Displaying: ${formatMya(myaTransitionTo)}`);
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