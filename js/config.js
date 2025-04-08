// -----------------------------------------------------------------------------
// js/config.js - Centralized Game Configuration
// -----------------------------------------------------------------------------

// =============================================================================
// --- World Parameters ---
// =============================================================================

// --- Canvas ---
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 800;
// --- Grid ---
export const GRID_COLS = 200;
export const GRID_ROWS = 200;
// --- Procedural Generation Parameters ---
export const WORLD_ISLAND_WIDTH = 0.8; // width of main island as a percentage
export const WORLD_WATER_LEVEL = 0.15; // Water coverage: bottom 15%, can be raised for environmental chaos
export const WORLD_WATER_LEVEL_ROW_TARGET = Math.floor(GRID_ROWS * (1.0 - WORLD_WATER_LEVEL)); // Calculate base water level (row 170)
export const WORLD_GROUND_LEVEL_MEAN = WORLD_WATER_LEVEL_ROW_TARGET - Math.floor(GRID_ROWS * 0.10); // Calculate mean ground level (surface) e.g., row 150
const STONE_DEPTH_BELOW_GROUND = 15; // Define how deep stone starts below the average ground level
export const WORLD_STONE_LEVEL_MEAN = WORLD_GROUND_LEVEL_MEAN + STONE_DEPTH_BELOW_GROUND; // Calculate mean stone level (row 165)
export const WORLD_GROUND_VARIATION = 3; // variations and noise scale
export const WORLD_STONE_VARIATION = 3; // Can adjust this noise amount if needed
export const WORLD_NOISE_SCALE = 0.05;
// --- Ocean Tapering Config ---
export const OCEAN_FLOOR_ROW_NEAR_ISLAND = WORLD_WATER_LEVEL_ROW_TARGET + 5;      // Row 175
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;     // Row 183
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1);        // 20 rows below water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3;                              // Limit deep ocean floor (row 197)
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WORLD_WATER_LEVEL_ROW_TARGET + DEEP_OCEAN_BASE_ROW_OFFSET); // Row 190 approx
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8;      // Row 198 approx
export const EDGE_TAPER_WIDTH_FACTOR = 0.15; // Percentage of grid width for edge taper
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 5; // Target stone level below map at edge
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 10; // Target floor level below deep ocean floor at edge
export const ISLAND_CENTER_TAPER_WIDTH = 80; // Width of taper from island edge inward

// =============================================================================
// --- Block Parameters ---
// =============================================================================

// --- Block ---
export const BLOCK_WIDTH = CANVAS_WIDTH / GRID_COLS;   // Calculated: 4
export const BLOCK_HEIGHT = CANVAS_HEIGHT / GRID_ROWS; // Calculated: 4
// --- Block Type IDs ---
export const BLOCK_AIR = 0;
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_GRASS = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD_WALL = 6;
export const BLOCK_METAL = 7;
// TODO: Glass, specific ores, etc. 

// --- Block Orientation IDs ---
export const ORIENTATION_FULL = 0;
export const ORIENTATION_SLOPE_BL = 1; // Bottom-Left triangle solid
export const ORIENTATION_SLOPE_BR = 2; // Bottom-Right triangle solid
export const ORIENTATION_SLOPE_TR = 3; // Top-Right triangle solid
export const ORIENTATION_SLOPE_TL = 4; // Top-Left triangle solid
// TODO: Implement drawing/collision later

// --- Block Base HP ---
export const BLOCK_HP = {
    [BLOCK_WATER]: Infinity,
    [BLOCK_SAND]: 30,
    [BLOCK_DIRT]: 50,
    [BLOCK_GRASS]: 50,
    [BLOCK_STONE]: 300,
    [BLOCK_WOOD_WALL]: 100,
    [BLOCK_METAL]: 500,
}; // TODO: Add HP for other types later

// --- Block Colors ---
export const BLOCK_COLORS = {
    // BLOCK_AIR is background color
    [BLOCK_WATER]: 'rgb(50, 100, 200)',
    [BLOCK_SAND]: 'rgb(210, 180, 140)',
    [BLOCK_DIRT]: 'rgb(130, 82, 45)',
    [BLOCK_GRASS]: 'rgb(80, 180, 80)',
    [BLOCK_STONE]: 'rgb(140, 140, 140)',
    [BLOCK_WOOD_WALL]: 'rgb(160, 110, 70)',
    [BLOCK_METAL]: 'rgb(190, 190, 200)',
};

// =============================================================================
// --- Player Constants ---
// =============================================================================

export const PLAYER_WIDTH = Math.max(5, Math.floor(1.25 * BLOCK_WIDTH)); // Approx 5px (adjust if block size changes)
export const PLAYER_HEIGHT = Math.max(8, Math.floor(2.5 * BLOCK_HEIGHT)); // Approx 10px (adjust if block size changes)
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
export const PLAYER_START_Y = (WORLD_GROUND_LEVEL_MEAN * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT); // Spawn slightly above mean ground
export const PLAYER_COLOR = 'rgb(200, 50, 50)';
// --- Player Health & Combat ---
export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_MAX_HEALTH_DISPLAY = 100;
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds (reduced slightly)
export const PLAYER_ATTACK_DURATION = 0.25; // seconds
export const PLAYER_ATTACK_COOLDOWN = 0.4; // seconds
export const PLAYER_ATTACK_DAMAGE = 10;
export const PLAYER_ATTACK_REACH_X = Math.floor(2.25 * BLOCK_WIDTH); // Approx 9px reach horizontal offset from edge
export const PLAYER_ATTACK_REACH_Y = 0; // Vertical offset from player center
export const PLAYER_ATTACK_WIDTH = Math.floor(1.25 * BLOCK_WIDTH); // Approx 5px width
export const PLAYER_ATTACK_HEIGHT = PLAYER_HEIGHT; // Same height as player for now
export const PLAYER_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';
// --- Delta-Time Based Player Physics ---
export const PLAYER_MOVE_ACCELERATION = 800; // Pixels per second per second
export const PLAYER_MAX_SPEED_X = 120;     // Pixels per second
export const PLAYER_FRICTION_BASE = 0.04;  // Base friction multiplier (Lower = stronger friction)
export const PLAYER_JUMP_VELOCITY = 200;   // Pixels per second (Initial upward velocity)

// =============================================================================
// --- Enemy Constants ---
// =============================================================================

// --- Default Enemy Size (can be overridden in ENEMY_STATS) ---
export const DEFAULT_ENEMY_WIDTH = Math.floor(1.5 * BLOCK_WIDTH);   // Approx 6px
export const DEFAULT_ENEMY_HEIGHT = Math.floor(2.25 * BLOCK_HEIGHT); // Approx 9px
// --- Enemy Type Identifiers ---
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker';
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod';
// Add new type constants here: export const ENEMY_TYPE_FLYER = 'flyer';

// --- Default Separation Behavior ---
// Can be overridden in ENEMY_STATS per type
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // How close before pushing (factor of width)
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = 60;     // How hard they push (pixels/sec velocity boost)

// --- General Enemy Config ---
export const MAX_ENEMIES = 100;
export const ENEMY_SPAWN_EDGE_MARGIN = 80; // Pixels away from screen edge to attempt spawning
export const ENEMY_FLASH_DURATION = 0.15; // Seconds enemy flashes when hit

// --- Detailed Enemy Stats ---
// This structure allows adding many new enemy types easily by defining their properties here.
// The Enemy class constructor and AI Strategies will read from this configuration.
export const ENEMY_STATS = {

    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod",
        aiType: 'flopAI',                 // <-- Link to the new AI strategy
        color: 'rgb(100, 120, 80)',       // Muddy green/brown color
        width: DEFAULT_ENEMY_WIDTH,       // Use default size for now
        height: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX: 20,                    // Very slow horizontal movement during flops
        health: 1,                        // Very fragile
        contactDamage: 0,                 // <-- Minimal damage (0 for now, can adjust)
        applyGravity: true,
        gravityFactor: 1.0,
        canJump: true,                    // Needs to jump to "flop"
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.4, // Weak jump/flop strength
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2, // Maybe slightly more space? Optional.
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.8, // Less pushy? Optional.
        dropTable: [],                    // No drops for the basic version
    },


    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker",              // For potential UI/debugging
        aiType: 'seekCenter',             // Key to match an AI Strategy class (to be implemented)
        color: 'rgb(80, 150, 80)',        // Visual color
        width: DEFAULT_ENEMY_WIDTH,         // Use default size
        height: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX: 40,                    // Movement speed (pixels/sec)
        health: 1,                        // Starting health points
        contactDamage: 10,                 // Damage dealt on player collision
        applyGravity: true,               // Does gravity affect this enemy?
        gravityFactor: 1.0,               // Multiplier for gravity (1.0 = normal)
        canJump: false,                   // Can this enemy initiate a jump?
        jumpVelocity: 0,                  // Initial jump speed if canJump is true
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // Use default separation
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [                      // Loot drops on death
            // { type: 'item_id', chance: 0.0 to 1.0, minAmount: N, maxAmount: M }
            { type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 },
        ],
        // --- Future properties ---
        // attackType: 'none', // 'melee', 'ranged', 'aura', 'special'
        // attackDamage: 0,
        // attackRange: 0,
        // attackCooldown: 0,
        // projectileType: null, // Key for projectile config if attackType is 'ranged'
        // immunities: [], // e.g., ['fire', 'poison'] - strings matching damage types
        // resistances: { 'physical': 0.1 }, // e.g., 10% physical resistance (0.0 to 1.0)
        // vulnerabilities: { 'fire': 1.5 }, // e.g., 50% extra fire damage
        // specialFlags: [], // e.g., ['explodes_on_death', 'teleports']
    },
    [ENEMY_TYPE_PLAYER_CHASER]: {
        displayName: "Chaser",
        aiType: 'chasePlayer',            // Key for AI Strategy
        color: 'rgb(150, 80, 80)',
        width: DEFAULT_ENEMY_WIDTH,
        height: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX: 55,                    // Slightly faster
        health: 2,                        // Slightly tougher
        contactDamage: 10,
        applyGravity: true,
        gravityFactor: 1.0,
        canJump: true,                   // Chasers can jump over small obstacles
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.75, // Jump strength relative to player
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [
            { type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 },
            // Example: Maybe a small chance for something else?
            // { type: 'enemy_part', chance: 0.05, minAmount: 1, maxAmount: 1 },
        ],
         // --- Future properties ---
        // attackType: 'melee', // Could have a bite attack later
        // attackDamage: 1,
        // attackRange: 5, // Short melee range
        // attackCooldown: 1.5,
    },
    // --- Template for a new enemy type ---
    /*
    ['new_enemy_type_key']: {
        displayName: "New Enemy Name",
        aiType: 'newAiStrategyKey',
        color: 'rgb(x, y, z)',
        width: PIXELS or DEFAULT_ENEMY_WIDTH,
        height: PIXELS or DEFAULT_ENEMY_HEIGHT,
        maxSpeedX: PIXELS_PER_SECOND,
        health: NUMBER,
        contactDamage: NUMBER,
        applyGravity: BOOLEAN,
        gravityFactor: NUMBER, // Usually 1.0
        canJump: BOOLEAN,
        jumpVelocity: PIXELS_PER_SECOND,
        separationFactor: NUMBER, // Usually DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR
        separationStrength: NUMBER, // Usually DEFAULT_ENEMY_SEPARATION_STRENGTH
        dropTable: [
             { type: 'item_id', chance: 0.0-1.0, minAmount: N, maxAmount: M },
             // ... more potential drops
        ],
        // Add future properties as needed (attack, resistances etc.)
    }
    */
};

// REMOVED: ENEMY_CONTACT_DAMAGE (now defined per enemy in ENEMY_STATS)
// REMOVED: ENEMY_DROP_TYPE, ENEMY_DROP_AMOUNT, ENEMY_DROP_CHANCE (replaced by dropTable in ENEMY_STATS)


// =============================================================================
// --- Item Constants ---
// =============================================================================
// Define item appearance and behavior
// Specific item types are often checked by string ('sword', 'wood', etc.)
export const SWORD_WIDTH = Math.floor(3 * BLOCK_WIDTH);      // Approx 12px
export const SWORD_HEIGHT = Math.floor(1 * BLOCK_HEIGHT);     // Approx 4px
export const SWORD_COLOR = 'rgb(180, 180, 190)';
export const WOOD_ITEM_WIDTH = Math.floor(1 * BLOCK_WIDTH);   // Approx 4px
export const WOOD_ITEM_HEIGHT = Math.floor(1 * BLOCK_HEIGHT);  // Approx 4px
export const WOOD_ITEM_COLOR = 'rgb(139, 69, 19)'; // Brown

export const ITEM_BOBBLE_AMOUNT = 0.15; // How much items bob (relative to height)
export const ITEM_BOBBLE_SPEED = 2.0;   // Radians per second for bobbing cycle


// =============================================================================
// --- General Physics Constants (Delta-Time Based) ---
// =============================================================================
export const GRAVITY_ACCELERATION = 700;   // Pixels per second per second
export const MAX_FALL_SPEED = 450;         // Pixels per second - General max fall speed unless overridden


// =============================================================================
// --- Wave System Definitions ---
// =============================================================================
export const WAVE_START_DELAY = 10.0; // Seconds before the very first wave starts
export const WAVE_INTERMISSION_DURATION = 15.0; // Seconds between *main* waves
export const WAVE_ENEMY_SPAWN_DELAY = 0.5; // Default delay if not specified in group

// --- Detailed Wave Structure ---
// Each element is a Main Wave.
// Each Main Wave has 'subWaves'.
// Each Sub-Wave has 'enemyGroups'.
// Each Enemy Group defines a batch of a specific enemy type.


// =============================================================================
// --- UI Constants ---
// =============================================================================

// --- Colors (mostly used by HTML/CSS, but keep for reference/canvas UI) ---
export const BACKGROUND_COLOR = 'rgb(135, 206, 235)'; // Sky Blue (Main canvas background)
export const UI_HEALTH_BAR_COLOR_EMPTY = 'rgb(80, 80, 80)';  // NEW: Background for health bar
export const UI_HEALTH_BAR_COLOR_FULL = 'rgb(220, 40, 40)'; // NEW: Fill color for health bar
// export const UI_TEXT_COLOR = 'black'; // Defined in CSS as white for sidebars

// Game Over Screen (If implemented on canvas, otherwise CSS)
// export const UI_GAMEOVER_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.75)';
// export const UI_GAMEOVER_TEXT_COLOR = 'red';
// export const UI_GAMEOVER_STATS_COLOR = 'white';
// export const UI_GAMEOVER_BUTTON_COLOR = 'darkred';       // Defined in CSS
// export const UI_GAMEOVER_BUTTON_TEXT_COLOR = 'white';    // Defined in CSS
// export const UI_GAMEOVER_BUTTON_WIDTH = 180;             // Defined in CSS
// export const UI_GAMEOVER_BUTTON_HEIGHT = 50;            // Defined in CSS


// =============================================================================
// --- Game Loop ---
// =============================================================================
export const MAX_DELTA_TIME = 0.05; // Max time step (seconds) to prevent physics glitches (~1/20th second or 20fps min simulation rate)


// =============================================================================
// --- Input Constants (Touch Controls) ---
// =============================================================================
// These could be moved to input.js if preferred, but keeping layout-related numbers here is okay too
export const TOUCH_BUTTON_SIZE = 80; // Pixel size of touch buttons
export const TOUCH_BUTTON_MARGIN = 20; // Pixel margin around buttons / from edge
export const TOUCH_BUTTON_COLOR_IDLE = 'rgba(128, 128, 128, 0.4)';
export const TOUCH_BUTTON_COLOR_PRESSED = 'rgba(255, 255, 255, 0.6)';
export const TOUCH_BUTTON_LABEL_COLOR = 'rgba(255, 255, 255, 0.8)';
export const TOUCH_BUTTON_LABEL_FONT = 'bold 24px sans-serif';