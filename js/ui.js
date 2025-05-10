// root/js/ui.js - Manages HTML Sidebar Elements and Updates

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js';
import * as AudioManager from './audioManager.js';
import * as WorldManager from './worldManager.js';

// --- DOM Element References ---

// Top Sidebar
let topSidebarEl = null;
let playerColumnEl, portalColumnEl; // Keep column refs for structure/class
let playerHealthBarContainerEl, playerHealthBarFillEl; // Updated player health bar elements
let portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl; // Updated portal health bar elements (added H2 ref)
let timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl; // New timer elements

// Bottom Sidebar
let bottomSidebarEl;
let itemSelectionAreaEl;
let inventoryBoxesContainerEl, weaponSlotsContainerEl;
let actionButtonsAreaEl;
let toggleControlsButtonEl;
export let actionButtons = {}; // Exported so Input.js can reference buttons
let toggleGridButtonEl = null;
let muteMusicButtonEl = null;
let muteSfxButtonEl = null;

// Overlay
let bootOverlayEl = null; // Changed from gameOverlay to bootOverlayEl
let epochOverlayEl = null; // Kept for epoch text


// --- Internal State ---
let playerRef = null; // Reference to the Player instance
let portalRef = null; // Reference to the Portal instance
const itemSlotDivs = {}; // Map itemType string to its HTML div element
let buttonIlluminationTimers = {}; // Map actionName to timer ID for button illumination
const ILLUMINATION_DURATION = 150; // ms
// Order matters for weapon slots display
const WEAPON_SLOTS_ORDER = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL];
// Add a flag to track if UI init was successful
let isUIReady = false;

// --- Initialization ---

// Initializes only the core overlay element reference (called early by main.js)
export function initOverlay() {
    bootOverlayEl = document.getElementById('boot-overlay'); // Changed from gameOverlay to bootOverlayEl
    if (!bootOverlayEl) {
        console.error("UI InitOverlay: Could not find core boot overlay element!");
        return false;
    }
    return true;
}

// Initializes the main game UI elements in the sidebars (called by main.js on DOMContentLoaded)
export function initGameUI() {
    let success = true; // Assume success until proven otherwise

    // --- Find Top Sidebar Elements ---
    topSidebarEl = document.getElementById('top-sidebar'); // Get the main top sidebar
    playerColumnEl = document.getElementById('player-column'); // Player column (container)
    portalColumnEl = document.getElementById('portal-column'); // Portal column (container)
    playerHealthBarContainerEl = document.getElementById('player-health-bar-container'); // Player bar container
    playerHealthBarFillEl = document.getElementById('player-health-bar-fill'); // Player bar fill
    portalColumnH2El = document.getElementById('portal-health-title'); // Portal title (now superimposed H2)
    portalHealthBarContainerEl = document.getElementById('portal-health-bar-container'); // Portal bar container
    portalHealthBarFillEl = document.getElementById('portal-health-bar-fill'); // Portal bar fill
    timerRowEl = document.getElementById('timer-row'); // Timer row container
    timerBarContainerEl = document.getElementById('timer-bar-container'); // Timer bar container
    timerBarFillEl = document.getElementById('timer-bar-fill'); // Timer bar fill
    timerTextOverlayEl = document.getElementById('timer-text-overlay'); // Timer text overlay

    // --- Find Bottom Sidebar Elements ---
    bottomSidebarEl = document.getElementById('bottom-sidebar');
    itemSelectionAreaEl = document.getElementById('item-selection-area');
    inventoryBoxesContainerEl = document.getElementById('inventory-boxes-container');
    weaponSlotsContainerEl = document.getElementById('weapon-slots-container');
    actionButtonsAreaEl = document.getElementById('action-buttons-area');
    toggleControlsButtonEl = document.getElementById('toggle-controls-button');

    // Find Action Button Elements and map them to action names
    actionButtons.left = document.getElementById('btn-move-left');
    actionButtons.right = document.getElementById('btn-move-right');
    actionButtons.pause = document.getElementById('btn-pause');
    actionButtons.jump = document.getElementById('btn-jump');
    actionButtons.attack = document.getElementById('btn-attack');

    // Find Settings Button Elements and map them
    toggleGridButtonEl = document.getElementById('btn-toggle-grid');
    muteMusicButtonEl = document.getElementById('btn-mute-music');
    muteSfxButtonEl = document.getElementById('btn-mute-sfx');
    actionButtons.toggleGrid = toggleGridButtonEl; // Add to actionButtons map for illumination
    actionButtons.muteMusic = muteMusicButtonEl;   // Add to actionButtons map for illumination
    actionButtons.muteSfx = muteSfxButtonEl;       // Add to actionButtons map for illumination

    // Find Epoch Overlay Element
    epochOverlayEl = document.getElementById('epoch-overlay');


    // --- Verification - Check if all required DOM elements were found ---
    const requiredElements = [
        topSidebarEl, playerColumnEl, portalColumnEl,
        playerHealthBarContainerEl, playerHealthBarFillEl,
        portalColumnH2El, portalHealthBarContainerEl, portalHealthBarFillEl,
        timerRowEl, timerBarContainerEl, timerBarFillEl, timerTextOverlayEl,
        bottomSidebarEl, itemSelectionAreaEl, inventoryBoxesContainerEl, weaponSlotsContainerEl,
        actionButtonsAreaEl, toggleControlsButtonEl,
        actionButtons.left, actionButtons.right, actionButtons.pause, actionButtons.jump, actionButtons.attack,
        actionButtons.toggleGrid, actionButtons.muteMusic, actionButtons.muteSfx, // Ensure settings buttons are included
        epochOverlayEl // Ensure epoch overlay element is included
    ];

    // Use Array.prototype.some() for a concise check.
    if (requiredElements.some(el => !el)) {
        console.error("UI InitGameUI: Could not find all expected game UI elements!");
        const elementNames = [ // Map indices to names for logging
            'topSidebarEl', 'playerColumnEl', 'portalColumnEl',
            'playerHealthBarContainerEl', 'playerHealthBarFillEl',
            'portalColumnH2El', 'portalHealthBarContainerEl', 'portalHealthBarFillEl',
            'timerRowEl', 'timerBarContainerEl', 'timerBarFillEl', 'timerTextOverlayEl',
            'bottomSidebarEl', 'itemSelectionAreaEl', 'inventoryBoxesContainerEl', 'weaponSlotsContainerEl',
            'actionButtonsAreaEl', 'toggleControlsButtonEl',
            'actionButtons.left', 'actionButtons.right', 'actionButtons.pause', 'actionButtons.jump', 'actionButtons.attack',
            'actionButtons.toggleGrid', 'actionButtons.muteMusic', 'actionButtons.muteSfx',
            'epochOverlayEl'
        ];
        requiredElements.forEach((el, index) => {
            if (!el) console.error(`Missing UI element: ${elementNames[index]}`);
        });
        success = false; // Mark initialization as failed
    }

    // --- Clear previous dynamic content and listeners ---
    if (inventoryBoxesContainerEl) inventoryBoxesContainerEl.innerHTML = 'Loading...';
    if (weaponSlotsContainerEl) weaponSlotsContainerEl.innerHTML = '';
    // Clear the itemSlotDivs map and illumination timers from any previous game instance
    for (const key in itemSlotDivs) {
        const slotDiv = itemSlotDivs[key];
        if (slotDiv) {
            // Optionally remove event listeners here if memory leaks are suspected in long-running scenarios,
            // but since we clear innerHTML and repopulate on init, it's usually not necessary.
            // slotDiv.removeEventListener('click', ...);
        }
        delete itemSlotDivs[key]; // Remove reference from the map
    }
    for (const key in buttonIlluminationTimers) {
        clearTimeout(buttonIlluminationTimers[key]);
    }
    buttonIlluminationTimers = {}; // Reset timers map

    // --- Create Item/Weapon Selection Boxes Dynamically ---
    if (inventoryBoxesContainerEl && weaponSlotsContainerEl) {
        inventoryBoxesContainerEl.innerHTML = ''; // Clear loading text
        weaponSlotsContainerEl.innerHTML = ''; // Clear loading text

        // Create Material Boxes
        for (const materialType of Config.INVENTORY_MATERIALS) {
            createItemSlot(materialType, inventoryBoxesContainerEl, 'material');
        }
        // Create Weapon Boxes in the defined order
        for (const weaponType of WEAPON_SLOTS_ORDER) {
            createItemSlot(weaponType, weaponSlotsContainerEl, 'weapon');
        }
        // Add an unarmed slot? Not currently defined in Config.WEAPON_SLOTS_ORDER.
        // If needed, add it here: createItemSlot(Config.WEAPON_TYPE_UNARMED, weaponSlotsContainerEl, 'weapon');

    } else {
        success = false; // If containers are missing, dynamic creation fails
    }


    // --- Set Initial States and Add Event Listeners ---
    if (success) {
        // Toggle controls button listener
        // Ensure toggleControlsButtonEl exists before adding the listener
        if(toggleControlsButtonEl) {
            toggleControlsButtonEl.addEventListener('click', toggleActionControls);
        } else {
            success = false; // Mark failed if the button is missing
        }


        // Initial states - These will be updated properly by main.js on game start
        // but setting defaults prevents empty/stale UI on first load.
        updatePlayerInfo(0, Config.PLAYER_MAX_HEALTH_DISPLAY, {}, false, false, false); // Set initial empty state
        updatePortalInfo(0, Config.PORTAL_INITIAL_HEALTH); // Set initial portal health
        // Set initial timer state - Use a placeholder waveInfo object
        updateWaveTimer({ state: 'LOADING', timer: 0, maxTimer: 1, progressText: "Loading...", mainWaveNumber: 0 });


        // Initial settings button states are set by main.js after AudioManager.init
        // updateSettingsButtonStates(); // This call is handled by main.js

        isUIReady = true; // Mark UI as ready if all steps succeeded
    } else {
        isUIReady = false; // Mark UI as not ready on failure
        console.error("UI: Failed to initialize some critical Game UI elements.");
    }

    return success; // Return overall success status
}

// Helper to create and setup a single item/weapon slot div
function createItemSlot(itemType, container, category) {
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

// Helper function to handle clicks on item/weapon slots
// This function is called by the click event listener attached to the item slot divs.
function handleItemSlotClick(itemType, category) {
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
    // Note: The 'active' class on the slot is handled by updatePlayerInfo running in the main loop.
    // The 'disabled' class is also handled by updatePlayerInfo.
}


// Toggles the visibility of the action buttons area in the bottom sidebar
export function toggleActionControls() {
    // Ensure elements exist before toggling classes
    if (bottomSidebarEl && actionButtonsAreaEl && toggleControlsButtonEl) {
        bottomSidebarEl.classList.toggle('controls-hidden');
        const isHidden = bottomSidebarEl.classList.contains('controls-hidden');
        // Update the button text and title to reflect the new state
        toggleControlsButtonEl.textContent = isHidden ? '▲ TOUCH CONTROLS ▲' : '▼ TOUCH CONTROLS ▼';
        toggleControlsButtonEl.title = isHidden ? 'Show Controls' : 'Hide Controls';
        // Note: Input.js must be aware of this state change to ignore touch inputs on hidden buttons.
        // This is handled in Input.js touch handlers by checking the element's visibility or parent's class.
    } else {
        console.error("UI toggleActionControls: Missing elements.");
    }
}

// Sets the reference to the player object (called by main.js)
export function setPlayerReference(playerObject) {
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

// Sets the reference to the portal object (called by main.js)
export function setPortalReference(portalObject) {
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

// Briefly illuminates a specific action button (called by Input.js or main.js toggles)
export function illuminateButton(actionName) {
    // actionButtons map is populated in initGameUI with button IDs
    // Ensure the button exists in the map
    const button = actionButtons[actionName];
    if (!button) {
        // console.warn(`UI illuminateButton: Button mapping not found for action "${actionName}".`);
        return; // Button element not found
    }

    // Prevent illumination if the controls area is hidden (except for pause)
    // Check if the button's parent area (actionButtonsAreaEl) is hidden by the 'controls-hidden' class.
    // Ensure actionButtonsAreaEl exists before checking classList.
    if (actionButtonsAreaEl && bottomSidebarEl && bottomSidebarEl.classList.contains('controls-hidden') && actionName !== 'pause') {
        // Also ensure the button itself is within the hidden area (most are, but safeguard)
        if(actionButtonsAreaEl.contains(button)) {
            return;
        }
    }

    // Clear any existing timer for this button to reset the flash
    if (buttonIlluminationTimers[actionName]) {
        clearTimeout(buttonIlluminationTimers[actionName]);
    }

    // Add the 'illuminated' class to trigger the CSS animation/style
    button.classList.add('illuminated');

    // Set a new timer to remove the 'illuminated' class after the duration
    buttonIlluminationTimers[actionName] = setTimeout(() => {
        button.classList.remove('illuminated');
        // Clean up the timer reference
        delete buttonIlluminationTimers[actionName];
    }, ILLUMINATION_DURATION);
}

// Updates the visual state (active/muted class) of settings buttons (called by main.js or toggle functions)
export function updateSettingsButtonStates(isGridVisible, isMusicMuted, isSfxMuted) {
    // Ensure elements exist before modifying their classes/titles
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


// --- Update Functions (Called by main.js game loop) ---

// Updates player health bar and inventory/weapon slots based on current player state
export function updatePlayerInfo(currentHealth, maxHealth, inventory = {}, hasSword, hasSpear, hasShovel) {
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


// Updates the portal health bar and its title color
export function updatePortalInfo(currentHealth, maxHealth) {
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
    // Text content remains "PORTAL" as defined in HTML, or set by main.js potentially
}

// Updates the wave timer bar and text based on wave info state (called by main.js)
// Accepts the entire waveInfo object now from WaveManager.getWaveInfo()
export function updateWaveTimer(waveInfo) {
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
                // Check if spawning is complete for the current wave
                // This needs WaveManager to expose if all groups/subwaves are done.
                // For now, simplify: if no enemies and timer < 5, show "Intermission Soon"
                // This check is a bit simplistic as spawning might still be happening.
                // A more robust check would be needed from WaveManager itself.
                if (clampedTimer <= 5 && livingEnemies === 0) { // A rough check
                    timerText = "INTERMISSION SOON!";
                } else {
                    timerText = `WAVE ${mainWaveNumber} (CLEARING)`;
                }
            }
            break;
        case 'BUILDPHASE':
            timerText = `BUILD TIME (WAVE ${mainWaveNumber} NEXT)`; // Show which wave is upcoming
            break;
        case 'WARPPHASE':
            let animStatus = "";
            if (WorldManager && !WorldManager.areAgingAnimationsComplete()) { // Check WorldManager exists
                animStatus = " (MORPHING...)";
            }
            timerText = `WARPING TO WAVE ${mainWaveNumber}${animStatus}`;
            displayTimerValue = true; // Show timer during warp
            break;
        case 'GAME_OVER':
            timerText = "GAME OVER";
            displayTimerValue = false;
            break;
        case 'VICTORY':
            timerText = "VICTORY!";
            displayTimerValue = false;
            break;
        case 'LOADING': // Fallthrough for initial load
        default:
            timerText = "LOADING...";
            displayTimerValue = false;
            break;
    }

    // Append formatted time if displayTimerValue is true
    if (displayTimerValue) {
        const minutes = Math.floor(clampedTimer / 60);
        const seconds = Math.floor(clampedTimer % 60);
        const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
        timerText = `${timerText}: ${minutes}:${formattedSeconds}`;
    }

    timerTextOverlayEl.textContent = timerText;
}


// Function to display the epoch text overlay above the game canvas
// Clears any pending hide timer and sets a new one
export function showEpochText(epochMessage) { // Changed parameter name for clarity
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