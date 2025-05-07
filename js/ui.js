// root/js/ui.js - Manages HTML Sidebar Elements and Updates

import * as Config from './config.js';
import * as EnemyManager from './enemyManager.js';
// NEW: Import AudioManager to check mute state for button appearance
import * as AudioManager from './audioManager.js';
// Import Input (though not directly used here, it might be needed for context or future features)
// import * as Input from './input.js';


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
let gameOverlay = null; // Kept for overlay init check
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
    gameOverlay = document.getElementById('game-overlay');
    if (!gameOverlay) {
        console.error("UI InitOverlay: Could not find core overlay elements!");
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
        // Log specific missing elements for easier debugging
        requiredElements.forEach(el => {
            if (!el) console.error(`Missing UI element: ${el?.id || el?.className || 'Unknown (null)'}`);
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
        slotDiv.appendChild(countSpan);
        titleText += ' (0)'; // Initial title for materials includes count
    } else if (category === 'weapon') {
        // Add specific text content (icons) for weapons
        if (itemType === Config.WEAPON_TYPE_SWORD) slotDiv.textContent = '⚔️';
        else if (itemType === Config.WEAPON_TYPE_SPEAR) slotDiv.textContent = '↑'; // Unicode arrow or other symbol
        else if (itemType === Config.WEAPON_TYPE_SHOVEL) slotDiv.textContent = '⛏️'; // Unicode pickaxe or other symbol
        else if (itemType === Config.WEAPON_TYPE_UNARMED) slotDiv.textContent = '👊'; // Unicode fist or other symbol
        else slotDiv.textContent = '?'; // Fallback icon

        // Initial title for weapons will show 'Not Found' or crafting recipe, updated later
         titleText += ' (Not Found)'; // Placeholder, will be updated by updatePlayerInfo
    }

    slotDiv.title = titleText; // Set initial title attribute

    // Add Event Listener for Click
    // This listener directly calls the handleItemSlotClick helper.
    // Input.js handles mapping touch/mouse input on these elements to a 'click'.
    slotDiv.addEventListener('click', () => {
        handleItemSlotClick(itemType, category);
    });

    container.appendChild(slotDiv); // Add the created div to the specified container
    itemSlotDivs[itemType] = slotDiv; // Store reference for later updates
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
         // console.error("UI UpdatePlayerInfo: Missing essential elements."); // Too noisy during loading
         // Still try to update health bar if available
         if(playerHealthBarFillEl){
              const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
              const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
              playerHealthBarFillEl.style.width = `${healthPercent}%`;
         }
         return; // Cannot proceed with slot updates if containers are missing
    }

    // Update Health Bar (Top Sidebar)
    const clampedHealth = Math.max(0, Math.min(currentHealth, maxHealth));
    const healthPercent = (maxHealth > 0) ? (clampedHealth / maxHealth) * 100 : 0;
    playerHealthBarFillEl.style.width = `${healthPercent}%`;


    // --- Update Item/Weapon Selection Boxes (Bottom Sidebar) ---

    // Get the currently selected item type from the player reference IF it exists
    // If playerRef is null (e.g., before game start or after game over), treat selectedItem as null/unarmed implicitly
    const selectedItem = playerRef ? playerRef.getCurrentlySelectedItem() : null;

    // Update Material Boxes
    for (const materialType of Config.INVENTORY_MATERIALS) {
        const slotDiv = itemSlotDivs[materialType];
        // Ensure the corresponding slot div exists
        if (!slotDiv) {
             // console.warn(`UI updatePlayerInfo: Material slot div not found for type "${materialType}".`);
             continue; // Skip if the element wasn't created
        }

        const count = inventory[materialType] || 0; // Get count from the passed inventory object
        const countSpan = slotDiv.querySelector('.item-count');
        // Update the count text, capping display at 99+
        if (countSpan) countSpan.textContent = count > 0 ? Math.min(count, 99) : '';

        // A material slot is disabled if the player has 0 of that material
        const isDisabled = count === 0;
        slotDiv.classList.toggle('disabled', isDisabled);

        // A material slot is active if the player has this material selected AND has at least 1 count
        // The check for count > 0 is technically redundant due to the 'disabled' logic, but makes it explicit.
        slotDiv.classList.toggle('active', playerRef && selectedItem === materialType && count > 0);

        // Update the title attribute for the hover tooltip
        slotDiv.title = `${materialType.toUpperCase()} (${count})`;
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
            for (const ingredient of recipe) {
                const requiredType = ingredient.type;
                const requiredAmount = ingredient.amount;
                const possessedAmount = inventory[requiredType] || 0; // Get count from passed inventory
                 if (possessedAmount < requiredAmount) {
                     canAfford = false;
                     break; // Stop checking if one ingredient is missing
                 }
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

     // Handle Unarmed slot if it existed visually (example):
     // const unarmedSlotDiv = itemSlotDivs[Config.WEAPON_TYPE_UNARMED];
     // if (unarmedSlotDiv) {
     //    // Unarmed is always interactive (can always switch to it)
     //    unarmedSlotDiv.classList.remove('disabled');
     //    // It's active if the selected item is unarmed
     //    unarmedSlotDiv.classList.toggle('active', playerRef && selectedItem === Config.WEAPON_TYPE_UNARMED);
     //    unarmedSlotDiv.title = 'UNARMED';
     // }
}


// Updates the portal health bar and its title color
export function updatePortalInfo(currentHealth, maxHealth) {
    // Ensure essential UI elements exist before proceeding
     if (!portalHealthBarFillEl || !portalColumnH2El || !portalColumnEl) {
         // console.error("UI UpdatePortalInfo: Missing essential elements."); // Too noisy during loading
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
         // console.error("UI UpdateWaveTimer: Missing essential elements."); // Too noisy
         return;
    }

    // Destructure relevant properties from the waveInfo object
    const { state, timer: currentTimer, maxTimer, mainWaveNumber } = waveInfo; // Renamed timer to currentTimer for clarity

    // Clamp currentTimer to be between 0 and maxTimer for robust display
    const clampedTimer = Math.max(0, Math.min(currentTimer, maxTimer));

    // Calculate fill percentage for the timer bar (counts down)
    // Handle maxTimer = 0 case to prevent division by zero and show full bar
    const timerPercent = (maxTimer > 0) ? (clampedTimer / maxTimer) * 100 : 100; // Show 100% if maxTimer is 0 (e.g. during loading/game over)
    timerBarFillEl.style.width = `${timerPercent}%`;

    // --- Update Timer Text Overlay based on WaveManager State ---
    let timerText = "";
    let displayTimer = true; // Flag to control if we append the numerical timer

    switch(state) {
        case 'PRE_WAVE': timerText = "FIRST WAVE IN"; break;
        case 'WAVE_COUNTDOWN': timerText = `WAVE ${mainWaveNumber} ENDS IN`; break; // Show current wave number
        case 'BUILDPHASE': timerText = "BUILD TIME"; break;
        case 'WARPPHASE': timerText = "WARPING..."; displayTimer = false; break; // Warp phase is timed, display timer
        case 'GAME_OVER': timerText = "GAME OVER"; displayTimer = false; break; // Game over/Victory states don't show countdown
        case 'VICTORY': timerText = "VICTORY!"; displayTimer = false; break;
        case 'LOADING': timerText = "LOADING..."; displayTimer = false; break; // Initial state placeholder
        default: timerText = "TIME"; break; // Fallback
    }

     // Append formatted time if displayTimer is true
    if (displayTimer) {
         const minutes = Math.floor(clampedTimer / 60);
         const seconds = Math.floor(clampedTimer % 60);
         // Format seconds with leading zero if less than 10
         const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

         timerText = `${timerText}: ${minutes}:${formattedSeconds}`;

        // Optional: Add milliseconds for more frantic timers if needed later
         // const milliseconds = Math.floor((clampedTimer * 1000) % 1000);
         // const formattedMilliseconds = milliseconds < 100 ? (milliseconds < 10 ? '00' + milliseconds : '0' + milliseconds) : milliseconds;
         // timerText = `${timerText}: ${minutes}:${formattedSeconds}.${formattedMilliseconds}`;
    }

    // Update the text content of the overlay element
    timerTextOverlayEl.textContent = timerText;

    // Optional: Change color of timer bar or text based on state or time remaining (e.g., flash red when time is low)
    // This is handled in style.css for fill color based on ID, but could be dynamic here.
}

// Function to display the epoch text overlay above the game canvas
// Clears any pending hide timer and sets a new one
export function showEpochText(epochYear) {
    // Ensure the epoch overlay element exists
    if (!epochOverlayEl) {
        console.warn("UI showEpochText: Element not found.", epochOverlayEl);
        return;
    }
    // Ensure epochYear is a number, default to a placeholder if not
    const yearToDisplay = typeof epochYear === 'number' && !isNaN(epochYear) ? `${epochYear} Million Years Ago` : 'Wave Starting';

    // Set the text content
    epochOverlayEl.textContent = yearToDisplay;

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