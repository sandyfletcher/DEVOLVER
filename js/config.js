// -----------------------------------------------------------------------------
// js/config.js - Centralized Game Configuration
// -----------------------------------------------------------------------------

// =============================================================================
// --- World Parameters ---
// =============================================================================

// --- Grid ---
export const GRID_COLS = 400;
export const GRID_ROWS = 200;
export const BASE_BLOCK_PIXEL_SIZE = 4; // Set desired square block size
// --- Canvas (INTERNAL RESOLUTION based on grid and block size) ---
export const CANVAS_WIDTH = GRID_COLS * BASE_BLOCK_PIXEL_SIZE;   // Calculated: 400 * 4 = 1600
export const CANVAS_HEIGHT = GRID_ROWS * BASE_BLOCK_PIXEL_SIZE;  // Calculated: 200 * 4 = 800
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

// --- Block Calculated Size (derived from above) ---
export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE;   // Should be 4
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE; // Should be 4
export const INVENTORY_MATERIALS = ['wood', 'stone', 'metal', 'dirt', 'sand', 'bone'];
// --- Type IDs ---
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
// --- Orientation IDs ---
export const ORIENTATION_FULL = 0;
export const ORIENTATION_SLOPE_BL = 1; // Bottom-Left triangle solid
export const ORIENTATION_SLOPE_BR = 2; // Bottom-Right triangle solid
export const ORIENTATION_SLOPE_TR = 3; // Top-Right triangle solid
export const ORIENTATION_SLOPE_TL = 4; // Top-Left triangle solid
// TODO: Implement drawing/collision later
// --- Base HP ---
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
// --- Block Placement ---
export const MATERIAL_TO_BLOCK_TYPE = { // Map inventory material strings to block type constants
    'dirt': BLOCK_DIRT,
    'stone': BLOCK_STONE,
    'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND,
    'metal': BLOCK_METAL,
    'bone': BLOCK_BONE,
    // Add other placeable materials here if needed
};
// --- Ghost and Future build options ---
export const GHOST_BLOCK_ALPHA = 0.5; // Transparency for placement preview
export const CAN_PLACE_IN_WATER = false; // Control if blocks can replace water (future enhancement?)
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)'; // White outline for player blocks
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 1; // 1 pixel thickness

// --- Water Physics & Flow ---
export const WATER_GRAVITY_FACTOR = 0.4; // Reduce gravity effect
export const WATER_HORIZONTAL_DAMPING = 0.1; // Strong horizontal drag (adjust base value, used with Math.pow)
export const WATER_VERTICAL_DAMPING = 0.05;  // Stronger vertical drag
export const WATER_MAX_SPEED_FACTOR = 0.6; // Reduce max horizontal speed
export const WATER_ACCELERATION_FACTOR = 0.5; // Reduce horizontal acceleration
export const WATER_SWIM_VELOCITY = 120;    // Initial upward speed from a swim 'stroke'
export const WATER_MAX_SWIM_UP_SPEED = 80;  // Max speed swimming up
export const WATER_MAX_SINK_SPEED = 100;  // Max speed falling down in water
export const ENEMY_WATER_BUOYANCY_ACCEL = 180;
export const WATER_JUMP_COOLDOWN_DURATION = 0.2;
export const WATER_PROPAGATION_DELAY = 0.05; // Delay between water spreading/falling updates (lower = faster flow)
export const WATER_UPDATES_PER_FRAME = 10; // Max number of water cells to process per frame

// =============================================================================
// --- Player Constants ---
// =============================================================================

export const PLAYER_WIDTH = Math.max(5, Math.floor(2.5 * BLOCK_WIDTH));   // Approx 10px (adjust if block size changes)
export const PLAYER_HEIGHT = Math.max(8, Math.floor(5 * BLOCK_HEIGHT)); // Approx 20px (adjust if block size changes)
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
// Define thresholds as factors of entity.height
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // Max height for effortless step (approx 0.33)
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2; // Max height for slowed step (approx 0.5)
// Horizontal velocity multiplier after completing a Tier 2 step
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.4; // Example: retain 40% of horizontal speed
// ---  Interaction Range  ---
export const PLAYER_INTERACTION_RANGE = 100; // Player range for block interaction (digging/placing)
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE;

// =============================================================================
// --- Enemy Constants ---
// =============================================================================

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
        aiType: 'flopAI',
        color: 'rgb(100, 120, 80)',
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
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.5, // <-- UPDATED: Meaningful jump strength relative to player
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
// Visual size: Keep factors as is for now
export const SHOVEL_WIDTH = Math.floor(2.5 * BLOCK_WIDTH);   // ~10px (Matches new player width)
export const SHOVEL_HEIGHT = Math.floor(1.5 * BLOCK_HEIGHT);  // ~6px
export const SHOVEL_COLOR = 'rgb(160, 160, 160)'; // Grey color
// Damage: Keep as is
export const PLAYER_SHOVEL_ATTACK_DAMAGE = 5; // Very low damage vs enemies
export const PLAYER_SHOVEL_BLOCK_DAMAGE = 25; // High damage vs blocks
// Hitbox: Adjust reach and size for 1-block horiz, 2-block vert from player center approx
export const PLAYER_SHOVEL_ATTACK_REACH_X = Math.floor(2.5 * BLOCK_WIDTH);  // ~10px from player center (~1 block beyond player edge)
export const PLAYER_SHOVEL_ATTACK_REACH_Y = Math.floor(2.0 * BLOCK_HEIGHT); // ~8px down from player center (~2 blocks down)
export const PLAYER_SHOVEL_ATTACK_WIDTH = Math.floor(2.0 * BLOCK_WIDTH);  // Moderate width hitbox ~8px (covers ~1 block each side of reach point)
export const PLAYER_SHOVEL_ATTACK_HEIGHT = Math.floor(4.0 * BLOCK_HEIGHT); // Taller height hitbox ~16px (covers ~2 blocks each side of reach point)
export const PLAYER_SHOVEL_ATTACK_DURATION = 0.3; // Clunky duration
export const PLAYER_SHOVEL_ATTACK_COOLDOWN = 0.4; // Clunky cooldown
export const PLAYER_SHOVEL_ATTACK_COLOR = 'rgba(180, 180, 180, 0.5)'; // Greyish color

// --- Sword ---
export const SWORD_COLOR = 'rgb(180, 180, 190)';
export const PLAYER_SWORD_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';
export const SWORD_WIDTH = Math.floor(3 * BLOCK_WIDTH); // Approx 12px
export const SWORD_HEIGHT = Math.floor(1 * BLOCK_HEIGHT); // Approx 4px
export const PLAYER_SWORD_ATTACK_DAMAGE = 15; // // Damage: Increase for combat focusGood baseline damage (Increased)
export const PLAYER_SWORD_BLOCK_DAMAGE = 0; // Swords don't break blocks
export const PLAYER_SWORD_ATTACK_REACH_X = Math.floor(4.5 * BLOCK_WIDTH); // Hitbox: Adjust reach and size for a wider arcModerate reach ~18px from player center (~3 blocks beyond player edge)
export const PLAYER_SWORD_ATTACK_REACH_Y = Math.floor(0.5 * BLOCK_HEIGHT); // Slight downward offset ~2px from player center
export const PLAYER_SWORD_ATTACK_WIDTH = Math.floor(3.0 * BLOCK_WIDTH); // Wide hitbox ~12px (arc) (Increased)
export const PLAYER_SWORD_ATTACK_HEIGHT = Math.floor(PLAYER_HEIGHT * 1.1); // Tall hitbox ~22px (arc) (Scales with new player height)
export const PLAYER_SWORD_ATTACK_DURATION = 0.2; // Faster duration
export const PLAYER_SWORD_ATTACK_COOLDOWN = 0.3; // Faster cooldown

// --- Spear ---
// Visual size: Keep factors as is for now
export const SPEAR_WIDTH = Math.floor(4 * BLOCK_WIDTH);      // Longer item ~16px
export const SPEAR_HEIGHT = Math.floor(0.75 * BLOCK_HEIGHT);  // Thinner item ~3px
export const SPEAR_COLOR = 'rgb(210, 180, 140)'; // Wood-like color
// Damage: Keep as is
export const PLAYER_SPEAR_ATTACK_DAMAGE = 8; // Slightly less damage than sword
export const PLAYER_SPEAR_BLOCK_DAMAGE = 0; // Spears don't break blocks
// Hitbox: Adjust reach for long poke, keep size narrow
export const PLAYER_SPEAR_ATTACK_REACH_X = Math.floor(5.5 * BLOCK_WIDTH); // Very Long reach ~22px from player center (~4 blocks beyond player edge) (Increased)
export const PLAYER_SPEAR_ATTACK_REACH_Y = Math.floor(0.5 * BLOCK_HEIGHT); // Slight vertical offset ~2px
export const PLAYER_SPEAR_ATTACK_WIDTH = Math.floor(0.75 * BLOCK_WIDTH); // Narrow hitbox ~3px
export const PLAYER_SPEAR_ATTACK_HEIGHT = Math.floor(0.75 * BLOCK_HEIGHT); // Narrow hitbox ~3px
export const PLAYER_SPEAR_ATTACK_DURATION = 0.3; // Moderate duration (thrust lingers)
export const PLAYER_SPEAR_ATTACK_COOLDOWN = 0.5; // Moderate/Slow cooldown (recovery)
export const PLAYER_SPEAR_ATTACK_COLOR = 'rgba(220, 220, 180, 0.5)'; // Different color?

// --- Centralized Item Configuration Object ---
export const ITEM_CONFIG = {
    [WEAPON_TYPE_SHOVEL]: { width: SHOVEL_WIDTH, height: SHOVEL_HEIGHT, color: SHOVEL_COLOR },
    [WEAPON_TYPE_SWORD]: { width: SWORD_WIDTH, height: SWORD_HEIGHT, color: SWORD_COLOR },
    [WEAPON_TYPE_SPEAR]: { width: SPEAR_WIDTH, height: SPEAR_HEIGHT, color: SPEAR_COLOR },
    // ... other items (material drops)
    'dirt': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_DIRT] },
    'sand': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_SAND] },
    'wood': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_WOOD] },
    'stone': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_STONE] },
    'metal': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_METAL] },
    'bone': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_BONE] },
    // ... other items
};
export const ITEM_BOBBLE_AMOUNT = 0.15; // How much items bob (relative to height)
export const ITEM_BOBBLE_SPEED = 2.0;   // Radians per second for bobbing cycle

// =============================================================================
// --- General Physics Constants (Delta-Time Based) ---
// =============================================================================

export const GRAVITY_ACCELERATION = 700;   // Pixels per second per second
export const MAX_FALL_SPEED = 450;         // Pixels per second - General max fall speed unless overridden
export const MAX_DELTA_TIME = 0.05; // Max time step (seconds) to prevent physics glitches (~1/20th second or 20fps min simulation rate)


// =============================================================================
// --- Audio Constants ---
// =============================================================================
export const AUDIO_SFX_POOL_SIZE = 8; // Number of simultaneous sound effects allowed
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4; // Default volume for game music (adjust as needed)
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;   // Default volume for UI music (adjust as needed)
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;  // Default volume for sound effects (adjust as needed)

export const AUDIO_TRACKS = {
    // Game Music (Wave themes) - paths already in WAVES config, keep them there for now
    // Example: wave1: 'assets/audio/Wave1-350.mp3'

    // UI Music
    // title: 'assets/audio/title_music.mp3',   // <-- Add your title music path
    pause: 'assets/audio/Music/Pause.mp3',
    // gameOver: 'assets/audio/gameover_music.mp3', // <-- Add your game over music path
    victory: 'assets/audio/Music/Victory.mp3',

    // Sound Effects (Add actual paths and types as needed)
    // player_hit: 'assets/audio/sfx/player_hit.wav', // <-- Example SFX path
    // enemy_hit: 'assets/audio/sfx/enemy_hit.wav',
    // enemy_death: 'assets/audio/sfx/enemy_death.wav',
    // block_break_dirt: 'assets/audio/sfx/block_break_dirt.wav',
    // block_break_stone: 'assets/audio/sfx/block_break_stone.wav',
    // item_pickup: 'assets/audio/sfx/item_pickup.wav',
    // button_click: 'assets/audio/sfx/button_click.wav',
    // player_jump: 'assets/audio/sfx/player_jump.wav', // For ground jump
    // player_water_stroke: 'assets/audio/sfx/player_water_stroke.wav', // For water "jump"
    // player_attack_swing: 'assets/audio/sfx/attack_swing.wav', // Generic attack sound
    // player_attack_hit: 'assets/audio/sfx/attack_hit.wav', // Sound when player attack hits something
};

// =============================================================================
// --- Wave System Definitions ---
// =============================================================================

export const WAVE_START_DELAY = 10.0; // Seconds before the very first wave starts
export const WAVE_INTERMISSION_DURATION = 60.0; // Seconds between *main* waves (1 minute)
export const WAVE_ENEMY_SPAWN_DELAY = 0.5; // Default delay if not specified in group

// --- Wave Scripts --- //
export const WAVES = [
    { // ==================== Main Wave 1 ====================
        mainWaveNumber: 1, // For reference/UI
        duration: 117, // Total duration of Wave 1 in seconds (for music)
        audioTrack: 'assets/audio/Music/Wave1-350.mp3',
        subWaves: [
            { // --- Sub-Wave 1.1 ---
                enemyGroups: [
                    { type: ENEMY_TYPE_TETRAPOD, count: 10, delayBetween: 1.8, startDelay: 0.0 },
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.7, startDelay: 8.0 },
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 3, delayBetween: 0.5, startDelay: 15.0 },
                ]
            },
            { // --- Sub-Wave 1.2 ---
                enemyGroups: [
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 4, delayBetween: 0.6, startDelay: 1.0 },
                    { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 3.0 }
                ]
            },
            { // --- Sub-Wave 1.3 ---
                enemyGroups: [
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 6, delayBetween: 0.4, startDelay: 0.5 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 1, delayBetween: 1.5, startDelay: 4.0 }
                ]
            }
        ]
    },
    { // ==================== Main Wave 2 ====================
        mainWaveNumber: 2,
        duration: 137, // Total duration of Wave 2 in seconds (for music)
        audioTrack: 'assets/audio/Music/Wave2-300.mp3', // <-- Add the path to your wave 2 music file
        subWaves: [
            { // --- Sub-Wave 2.1 ---
                 enemyGroups: [
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 4, delayBetween: 1.2, startDelay: 1.0 },
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.6, startDelay: 3.0 },
                 ]
            },
            { // --- Sub-Wave 2.2 ---
                 enemyGroups: [
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 10, delayBetween: 0.3, startDelay: 0.0 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 3, delayBetween: 1.0, startDelay: 5.0 },
                 ]
            },
            { // --- Sub-Wave 2.3 ---
                 enemyGroups: [
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 5, delayBetween: 0.9, startDelay: 0.5 },
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.5, startDelay: 1.5 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 6.0 },
                 ]
            }
        ]
    },
    // ==================== Add Main Wave 3, 4, etc. here ====================
    { // Example of a potentially shorter/different wave
        mainWaveNumber: 3,
        duration: 90,
        audioTrack: 'assets/audio/Music/wave3.mp3', // <-- Add path for wave 3 music
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    }
    // ... more waves
];


// =============================================================================
// --- Touch Controls --- move to input.js?
// =============================================================================

export const TOUCH_BUTTON_SIZE = 80; // Pixel size of touch buttons
export const TOUCH_BUTTON_MARGIN = 20; // Pixel margin around buttons / from edge
export const TOUCH_BUTTON_COLOR_IDLE = 'rgba(128, 128, 128, 0.4)';
export const TOUCH_BUTTON_COLOR_PRESSED = 'rgba(255, 255, 255, 0.6)';
export const TOUCH_BUTTON_LABEL_COLOR = 'rgba(255, 255, 255, 0.8)';
export const TOUCH_BUTTON_LABEL_FONT = 'bold 24px sans-serif';