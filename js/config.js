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

// --- Background ---
export const BACKGROUND_COLOR = 'rgb(135, 206, 235)';

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
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;       // Row 183
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1);            // 20 rows below water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3;                                  // Limit deep ocean floor (row 197)
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WORLD_WATER_LEVEL_ROW_TARGET + DEEP_OCEAN_BASE_ROW_OFFSET);    // Row 190 approx
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8;         // Row 198 approx
export const EDGE_TAPER_WIDTH_FACTOR = 0.15;                                      // Percentage of grid width for edge taper
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 5;                              // Target stone level below map at edge
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 10;                             // Target floor level below deep ocean floor at edge
export const ISLAND_CENTER_TAPER_WIDTH = 80;                                      // Width of taper from island edge inward

// =============================================================================
// --- Camera / Viewport Constants ---
// =============================================================================

export const MIN_CAMERA_SCALE = 0.25; // Min zoom level (zoom out)
export const MAX_CAMERA_SCALE = 3.0;  // Max zoom level (zoom in)
export const ZOOM_SPEED_FACTOR = 0.001; // How fast scrolling zooms

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
export const BLOCK_WOOD = 6;
export const BLOCK_METAL = 7;
export const BLOCK_BONE = 8;
// TODO: Glass, specific ores, etc.

export const INVENTORY_MATERIALS = ['wood', 'stone', 'metal', 'dirt', 'sand', 'bone'];

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
    [BLOCK_WOOD]: 100,
    [BLOCK_METAL]: 500,
    [BLOCK_BONE]: 120,
}; // TODO: Add HP for other types later

// --- Block Colors ---
export const BLOCK_COLORS = {
    // BLOCK_AIR is background color
    [BLOCK_WATER]: 'rgb(50, 100, 200)',
    [BLOCK_SAND]: 'rgb(210, 180, 140)',
    [BLOCK_DIRT]: 'rgb(130, 82, 45)',
    [BLOCK_GRASS]: 'rgb(80, 180, 80)',
    [BLOCK_STONE]: 'rgb(140, 140, 140)',
    [BLOCK_WOOD]: 'rgb(160, 110, 70)',
    [BLOCK_METAL]: 'rgb(190, 190, 200)',
    [BLOCK_BONE]: 'rgb(200, 190, 170)',
};

// --- Water Physics ---
export const WATER_GRAVITY_FACTOR = 0.4; // Reduce gravity effect
export const WATER_HORIZONTAL_DAMPING = 0.1; // Strong horizontal drag (adjust base value, used with Math.pow)
export const WATER_VERTICAL_DAMPING = 0.05;  // Stronger vertical drag
export const WATER_MAX_SPEED_FACTOR = 0.6; // Reduce max horizontal speed
export const WATER_ACCELERATION_FACTOR = 0.5; // Reduce horizontal acceleration
export const WATER_SWIM_VELOCITY = 120;    // Initial upward speed from a swim 'stroke'
export const WATER_MAX_SWIM_UP_SPEED = 80;  // Max speed swimming up
export const WATER_MAX_SINK_SPEED = 100;  // Max speed falling down in water
export const WATER_CONTINUOUS_SWIM_ACCEL = 200; // Upward acceleration while holding jump
export const ENEMY_WATER_BUOYANCY_ACCEL = 180;
export const WATER_JUMP_COOLDOWN_DURATION = 0.2; // Define the cooldown duration for water jumps (strokes) in seconds


// =============================================================================
// --- Player Constants ---
// =============================================================================

// --- Size and Coordinates  ---
export const PLAYER_WIDTH = Math.max(5, Math.floor(1.25 * BLOCK_WIDTH)); // Approx 5px (adjust if block size changes)
export const PLAYER_HEIGHT = Math.max(8, Math.floor(2.5 * BLOCK_HEIGHT)); // Approx 10px (adjust if block size changes)
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
export const PLAYER_START_Y = (WORLD_GROUND_LEVEL_MEAN * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT); // Spawn slightly above mean ground
export const PLAYER_COLOR = 'rgb(200, 50, 50)';
// --- Health  ---
export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_MAX_HEALTH_DISPLAY = 100;
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds (reduced slightly)
// --- Delta-Time Physics ---
export const PLAYER_MOVE_ACCELERATION = 800; // Pixels per second per second
export const PLAYER_MAX_SPEED_X = 120;     // Pixels per second
export const PLAYER_FRICTION_BASE = 0.04;  // Base friction multiplier (Lower = stronger friction)
export const PLAYER_JUMP_VELOCITY = 200;   // Pixels per second (Initial upward velocity)
// ---  Interaction Range  ---
export const PLAYER_INTERACTION_RANGE = 100; // Player range for block interaction (digging/placing)
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE;

// =============================================================================
// --- Enemy Constants ---
// =============================================================================

// --- General Config ---
export const MAX_ENEMIES = 100;
export const ENEMY_SPAWN_EDGE_MARGIN = 80; // Pixels away from screen edge to attempt spawning
export const ENEMY_FLASH_DURATION = 0.15; // Seconds enemy flashes when hit
// --- Default  Size ---
export const DEFAULT_ENEMY_WIDTH = Math.floor(1.5 * BLOCK_WIDTH);
export const DEFAULT_ENEMY_HEIGHT = Math.floor(2.25 * BLOCK_HEIGHT);
// --- Type Identifiers ---
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker';
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod';
// Add new type constants here: export const ENEMY_TYPE_FLYER = 'flyer';

// --- Default Separation Behavior ---
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // How close before pushing (factor of width)
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = 60;     // How hard they push (pixels/sec velocity boost)
// Can be overridden in ENEMY_STATS per type

// --- Detailed Stats ---
export const ENEMY_STATS = { // Enemy class constructor and AI Strategies read from this configuration.
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod",
        aiType: 'flopAI',                 // <-- Link to the new AI strategy
        color: 'rgb(100, 120, 80)',       // Muddy green/brown color
        width: DEFAULT_ENEMY_WIDTH,       // Use default size for now
        height: DEFAULT_ENEMY_HEIGHT,
        health: 1,                        // Very fragile
        contactDamage: 0,                 // <-- Minimal damage (0 for now, can adjust)
        applyGravity: true,
        gravityFactor: 1.0,
        maxSpeedX: 15, // Reduced land speed example
        canJump: true, // Keep the land jump for flopping
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.4, // Weak jump/flop strength
        canSwim: true, // Good in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2, // Maybe slightly more space? Optional.
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.8, // Less pushy? Optional.
        dropTable: [
                { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }, // Change to drop bone
            ],
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
        canJump: true,                   // Can this enemy initiate a jump?
        jumpVelocity: 0.4,                  // Initial jump speed if canJump is true
        canSwim: false, // Default land creature
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // Use default separation
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [
            { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }, // Change to drop bone
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
        canSwim: false, // NEW: Becomes encumbered in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [
            { type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 }, // Change to drop bone
        ],
         // --- Future properties ---
        // attackType: 'melee', // Could have a bite attack later
        // attackDamage: 1,
        // attackRange: 5, // Short melee range
        // attackCooldown: 1.5,
    },
//     [ENEMY_TYPE_FLYER]: {
//         displayName: "Flyer",
//         aiType: 'flyPatrol', // A new AI strategy
//         color: 'lightblue',
//         width: DEFAULT_ENEMY_WIDTH,
//         height: DEFAULT_ENEMY_HEIGHT * 0.8, // Shorter?
//         maxSpeedX: 70,
//         maxSpeedY: 50, // Flyers need vertical speed control
//         health: 15,
//         contactDamage: 5,
//         applyGravity: false, // IMPORTANT for default state if canFly is true
//         canJump: false,
//         canSwim: false,
//         canFly: true, // The key flag
//         dropTable: [],
        // Add future properties as needed (attack, resistances etc.)
//     }
};

// =============================================================================
// --- Item & Weapon Constants ---
// =============================================================================

export const WEAPON_TYPE_UNARMED = 'unarmed';
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear'
// --- Shovel ---
export const SHOVEL_WIDTH = Math.floor(2.5 * BLOCK_WIDTH);   // ~10px
export const SHOVEL_HEIGHT = Math.floor(1.5 * BLOCK_HEIGHT);  // ~6px
export const SHOVEL_COLOR = 'rgb(160, 160, 160)'; // Grey color
export const PLAYER_SHOVEL_ATTACK_DAMAGE = 5; // Very low damage vs enemies
export const PLAYER_SHOVEL_BLOCK_DAMAGE = 25; // High damage vs blocks
export const PLAYER_SHOVEL_ATTACK_REACH_X = Math.floor(1 * BLOCK_WIDTH);  // Short reach forward ~2px
export const PLAYER_SHOVEL_ATTACK_REACH_Y = Math.floor(1.5 * BLOCK_HEIGHT); // Slight downward offset ~3px
export const PLAYER_SHOVEL_ATTACK_WIDTH = Math.floor(1.5 * BLOCK_WIDTH);  // Moderate width hitbox ~6px
export const PLAYER_SHOVEL_ATTACK_HEIGHT = Math.floor(2.0 * BLOCK_HEIGHT); // Short height hitbox ~4px
export const PLAYER_SHOVEL_ATTACK_DURATION = 0.3; // Clunky duration
export const PLAYER_SHOVEL_ATTACK_COOLDOWN = 0.4; // Clunky cooldown
export const PLAYER_SHOVEL_ATTACK_COLOR = 'rgba(180, 180, 180, 0.5)'; // Greyish color
// --- Sword ---
export const SWORD_WIDTH = Math.floor(3 * BLOCK_WIDTH);      // Approx 12px
export const SWORD_HEIGHT = Math.floor(1 * BLOCK_HEIGHT);     // Approx 4px
export const SWORD_COLOR = 'rgb(180, 180, 190)';
export const PLAYER_SWORD_ATTACK_DAMAGE = 10; // Good baseline damage
export const PLAYER_SWORD_BLOCK_DAMAGE = 0; // NEW: Swords don't break blocks
export const PLAYER_SWORD_ATTACK_REACH_X = Math.floor(2 * BLOCK_WIDTH); // Moderate reach ~7px
export const PLAYER_SWORD_ATTACK_REACH_Y = 0; // Vertical offset from player center
export const PLAYER_SWORD_ATTACK_WIDTH = Math.floor(2.0 * BLOCK_WIDTH); // Wide hitbox ~8px (arc)
export const PLAYER_SWORD_ATTACK_HEIGHT = Math.floor(PLAYER_HEIGHT * 1.1); // Tall hitbox ~11px (arc)
export const PLAYER_SWORD_ATTACK_DURATION = 0.2; // Faster duration
export const PLAYER_SWORD_ATTACK_COOLDOWN = 0.3; // Faster cooldown
export const PLAYER_SWORD_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';
// --- Spear ---
export const SPEAR_WIDTH = Math.floor(4 * BLOCK_WIDTH);      // Longer item ~16px
export const SPEAR_HEIGHT = Math.floor(0.75 * BLOCK_HEIGHT);  // Thinner item ~3px
export const SPEAR_COLOR = 'rgb(210, 180, 140)'; // Wood-like color
export const PLAYER_SPEAR_ATTACK_DAMAGE = 8; // Slightly less damage than sword
export const PLAYER_SPEAR_BLOCK_DAMAGE = 0; // Spears don't break blocks
export const PLAYER_SPEAR_ATTACK_REACH_X = Math.floor(3.5 * BLOCK_WIDTH); // Very Long reach ~14px
export const PLAYER_SPEAR_ATTACK_REACH_Y = Math.floor(1 * BLOCK_HEIGHT);
export const PLAYER_SPEAR_ATTACK_WIDTH = Math.floor(0.75 * BLOCK_WIDTH); // Narrow hitbox ~3px
export const PLAYER_SPEAR_ATTACK_HEIGHT = Math.floor(0.75 * BLOCK_HEIGHT); // Narrow hitbox ~3px
export const PLAYER_SPEAR_ATTACK_DURATION = 0.3; // Moderate duration (thrust lingers)
export const PLAYER_SPEAR_ATTACK_COOLDOWN = 0.5; // Moderate/Slow cooldown (recovery)
export const PLAYER_SPEAR_ATTACK_COLOR = 'rgba(220, 220, 180, 0.5)'; // Different color?
// --- Centralized Item Configuration Object ---
export const ITEM_CONFIG = {
    [WEAPON_TYPE_SHOVEL]: { // Use constant
            width: SHOVEL_WIDTH,
            height: SHOVEL_HEIGHT,
            color: SHOVEL_COLOR,
    },
    [WEAPON_TYPE_SWORD]: {
        width: SWORD_WIDTH,
        height: SWORD_HEIGHT,
        color: SWORD_COLOR,
    },
    [WEAPON_TYPE_SPEAR]: {
        width: SPEAR_WIDTH,
        height: SPEAR_HEIGHT,
        color: SPEAR_COLOR,
    },
    'dirt': { // Add config for material drops
        width: Math.floor(1 * BLOCK_WIDTH),
        height: Math.floor(1 * BLOCK_HEIGHT),
        color: BLOCK_COLORS[BLOCK_DIRT],
    },
    'sand': {
        width: Math.floor(1 * BLOCK_WIDTH),
        height: Math.floor(1 * BLOCK_HEIGHT),
        color: BLOCK_COLORS[BLOCK_SAND],
    },
    'wood': {
        width: Math.floor(1 * BLOCK_WIDTH),
        height: Math.floor(1 * BLOCK_HEIGHT),
        color: BLOCK_COLORS[BLOCK_WOOD],
    },
    'stone': {
        width: Math.floor(1 * BLOCK_WIDTH),
        height: Math.floor(1 * BLOCK_HEIGHT),
        color: BLOCK_COLORS[BLOCK_STONE],
    },
    'metal': {
        width: Math.floor(1 * BLOCK_WIDTH),
        height: Math.floor(1 * BLOCK_HEIGHT),
        color: BLOCK_COLORS[BLOCK_METAL],
    },
    'bone': { // Add config for bone item
            width: Math.floor(1 * BLOCK_WIDTH),
            height: Math.floor(1 * BLOCK_HEIGHT),
            color: BLOCK_COLORS[BLOCK_BONE],
        },
    // ... other items
};
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