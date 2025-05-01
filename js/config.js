// root/js/config.js - Centralized Game Configuration

// =============================================================================
// --- World Parameters ---
// =============================================================================

export const BACKGROUND_COLOR = 'rgb(135, 206, 235)';
export const BASE_BLOCK_PIXEL_SIZE = 4; // Set desired square block size
// --- Grid ---
export const GRID_COLS = 400;
export const GRID_ROWS = 200;
// --- Canvas  ---
export const CANVAS_WIDTH = GRID_COLS * BASE_BLOCK_PIXEL_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * BASE_BLOCK_PIXEL_SIZE;
// --- Procedural Generation Parameters ---
export const WORLD_ISLAND_WIDTH = 0.8; // width of island as a percentage
export const WORLD_WATER_LEVEL = 0.15; // water covers bottom 15%, could be raised for environmental chaos
export const WORLD_WATER_LEVEL_ROW_TARGET = Math.floor(GRID_ROWS * (1.0 - WORLD_WATER_LEVEL)); // water level = +/- row 170
export const WORLD_GROUND_LEVEL_MEAN = WORLD_WATER_LEVEL_ROW_TARGET - Math.floor(GRID_ROWS * 0.10); // mean ground level (surface) = row 150
const STONE_DEPTH_BELOW_GROUND = 15; // how deep stone starts below the average ground level
export const WORLD_STONE_LEVEL_MEAN = WORLD_GROUND_LEVEL_MEAN + STONE_DEPTH_BELOW_GROUND; // mean stone level (row 165)
export const WORLD_GROUND_VARIATION = 3; // variations and noise scale
export const WORLD_STONE_VARIATION = 3; // adjustable noise amount
export const WORLD_NOISE_SCALE = 0.05;
// --- Ocean Tapering Config ---
export const OCEAN_FLOOR_ROW_NEAR_ISLAND = WORLD_WATER_LEVEL_ROW_TARGET + 5; // Row 175
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8; // Row 183
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1); // 20 rows below water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3; // Limit deep ocean floor (row 197)
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WORLD_WATER_LEVEL_ROW_TARGET + DEEP_OCEAN_BASE_ROW_OFFSET); // Row 190 approx
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8; // Row 198 approx
export const EDGE_TAPER_WIDTH_FACTOR = 0.15; // Percentage of grid width for edge taper
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 5; // Target stone level below map at edge
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 10; // Target floor level below deep ocean floor at edge
export const ISLAND_CENTER_TAPER_WIDTH = 80; // Width of taper from island edge inward

// =============================================================================
// --- Delta-Time Based Physics ---
// =============================================================================

export const GRAVITY_ACCELERATION = 700; // Pixels per second per second
export const MAX_FALL_SPEED = 450; // Pixels per second - General max fall speed unless overridden
export const MAX_DELTA_TIME = 0.05; // Max time step (seconds) to prevent physics glitches (~1/20th second or 20fps min simulation rate)
// --- Step-up allowance ---
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // Max height for effortless step (approx 0.33)
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2; // Max height for slowed step (approx 0.5)
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.4; // Horizontal velocity multiplier after completing a Tier 2 step, retain 40% of horizontal speed
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
export const WATER_UPDATES_PER_FRAME = 500; // Max number of water cells to process per frame

// =============================================================================
// --- Audio Constants ---
// =============================================================================
export const AUDIO_SFX_POOL_SIZE = 8; // Number of simultaneous sound effects allowed
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4; // Default volume for game music (TODO: make adjustable)
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;   // Default volume for UI music
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;  // Default volume for sound effects
export const AUDIO_TRACKS = {
// --- Music ---
    // title: 'assets/audio/title_music.mp3', // TODO: Add title music
    pause: 'assets/audio/music/Pause.mp3',
    // gameOver: 'assets/audio/gameover_music.mp3', // TODO: Add game over music
    victory: 'assets/audio/music/Victory.mp3',
// ---Sound Effects ---
    // player_hit: 'assets/audio/sfx/player_hit.wav', // TODO: Add sfx
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
    // portal_hit: 'assets/audio/sfx/portal_hit.wav', // TODO: Add sfx
    // portal_destroyed: 'assets/audio/sfx/portal_destroyed.wav', // TODO: Add sfx
};

// =============================================================================
// --- Camera / Viewport ---
// =============================================================================

export const MIN_CAMERA_SCALE = 0.25; // min zoom level (zoom out)
export const MAX_CAMERA_SCALE = 3.0;  // max zoom level (zoom in)
export const ZOOM_SPEED_FACTOR = 0.001; // how fast scrolling zooms

// =============================================================================
// --- Block Parameters ---
// =============================================================================

// --- Block Size ---
export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE; // should be 4, calculation done at top of file
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE;
export const INVENTORY_MATERIALS = ['wood', 'stone', 'metal', 'dirt', 'sand', 'bone']; // be sure to add any new types here
// --- Type ID ---
export const BLOCK_AIR = 0;
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_GRASS = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD = 6;
export const BLOCK_METAL = 7;
export const BLOCK_BONE = 8; // TODO: Glass, specific ores, etc.
// --- Orientation IDs ---
export const ORIENTATION_FULL = 0;
export const ORIENTATION_SLOPE_BL = 1; // Bottom-Left triangle solid
export const ORIENTATION_SLOPE_BR = 2; // Bottom-Right triangle solid
export const ORIENTATION_SLOPE_TR = 3; // Top-Right triangle solid
export const ORIENTATION_SLOPE_TL = 4; // Top-Left triangle solid
// --- HP ---
export const BLOCK_HP = {
    [BLOCK_WATER]: Infinity,
    [BLOCK_SAND]: 30,
    [BLOCK_DIRT]: 50,
    [BLOCK_GRASS]: 50,
    [BLOCK_STONE]: 300,
    [BLOCK_WOOD]: 100,
    [BLOCK_METAL]: 500,
    [BLOCK_BONE]: 120, // TODO: Add HP for other types later
};
// --- Colors ---
export const BLOCK_COLORS = { // BLOCK_AIR is background color
    [BLOCK_WATER]: 'rgb(50, 100, 200)',
    [BLOCK_SAND]: 'rgb(210, 180, 140)',
    [BLOCK_DIRT]: 'rgb(130, 82, 45)',
    [BLOCK_GRASS]: 'rgb(80, 180, 80)',
    [BLOCK_STONE]: 'rgb(140, 140, 140)',
    [BLOCK_WOOD]: 'rgb(160, 110, 70)',
    [BLOCK_METAL]: 'rgb(190, 190, 200)',
    [BLOCK_BONE]: 'rgb(200, 190, 170)',
};
// --- Placement ---
export const MATERIAL_TO_BLOCK_TYPE = { // Map inventory material strings to block type constants
    'dirt': BLOCK_DIRT,
    'stone': BLOCK_STONE,
    'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND,
    'metal': BLOCK_METAL,
    'bone': BLOCK_BONE, // Add other placeable materials here if needed
};
// --- Ghost and Future build options ---
export const GHOST_BLOCK_ALPHA = 0.5; // transparency level of preview block
export const CAN_PLACE_IN_WATER = false; // potential future enhancement
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)'; // outline colour of player-placed blocks
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 1; // 1 pixel thickness

// =============================================================================
// --- Portal Parameters ---
// =============================================================================

export const PORTAL_COLOR = 'rgb(100, 100, 255)'; // Blueish color
export const PORTAL_WIDTH = Math.floor(8 * BASE_BLOCK_PIXEL_SIZE); // e.g., 32 pixels
export const PORTAL_HEIGHT = Math.floor(10 * BASE_BLOCK_PIXEL_SIZE); // e.g., 40 pixels
export const PORTAL_INITIAL_HEALTH = 500;
export const PORTAL_SAFETY_RADIUS = Math.floor(30 * BASE_BLOCK_PIXEL_SIZE); // e.g., 120 pixels radius
export const PORTAL_RADIUS_GROWTH_PER_WAVE = 25; // Increase radius by 25 pixels each intermission
export const PORTAL_SPAWN_Y_OFFSET_BLOCKS = 8; // How many blocks above mean ground level to spawn the top of the portal

// =============================================================================
// --- Player Parameters ---
// =============================================================================

export const PLAYER_COLOR = 'rgb(200, 50, 50)';
export const PLAYER_WIDTH = Math.max(5, Math.floor(2.5 * BLOCK_WIDTH)); // Approx 10px (adjust if block size changes)
export const PLAYER_HEIGHT = Math.max(8, Math.floor(5 * BLOCK_HEIGHT)); // Approx 20px (adjust if block size changes)
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2; // Spawn Position
export const PLAYER_START_Y = (WORLD_GROUND_LEVEL_MEAN * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT); // slightly above mean ground
export const PLAYER_INITIAL_HEALTH = 100; // --- Health  ---
export const PLAYER_MAX_HEALTH_DISPLAY = 100;
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds
export const PLAYER_MOVE_ACCELERATION = 800; // --- Physics --- // Pixels per second per second
export const PLAYER_MAX_SPEED_X = 120; // Pixels per second
export const PLAYER_FRICTION_BASE = 0.04; // Base friction multiplier (Lower = stronger friction)
export const PLAYER_JUMP_VELOCITY = 200; // Pixels per second (Initial upward velocity)
export const PLAYER_INTERACTION_RANGE = 100; // Player range for block interaction (digging/placing)
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE;

// =============================================================================
// --- Items & Weapons ---
// =============================================================================

export const ITEM_BOBBLE_AMOUNT = 0.15; // How much items bob (relative to height)
export const ITEM_BOBBLE_SPEED = 2.0;   // Radians per second for bobbing cycle
// --- Weapons ---
export const WEAPON_TYPE_UNARMED = 'unarmed';
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear'
// --- Shovel ---
export const SHOVEL_WIDTH = Math.floor(2.5 * BLOCK_WIDTH);   // Visual size: Keep factors as is for now ~10px (Matches new player width)
export const SHOVEL_HEIGHT = Math.floor(1.5 * BLOCK_HEIGHT);  // ~6px
export const SHOVEL_COLOR = 'rgb(160, 160, 160)'; // Grey color
export const PLAYER_SHOVEL_ATTACK_DAMAGE = 5; // Damage: Keep as is, Very low damage vs enemies
export const PLAYER_SHOVEL_BLOCK_DAMAGE = 25; // High damage vs blocks
export const PLAYER_SHOVEL_ATTACK_REACH_X = Math.floor(2.5 * BLOCK_WIDTH);  // Hitbox: Adjust reach and size for 1-block horiz, 2-block vert from player center approx // ~10px from player center (~1 block beyond player edge)
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
export const SPEAR_WIDTH = Math.floor(4 * BLOCK_WIDTH);      // Longer item ~16px
export const SPEAR_HEIGHT = Math.floor(0.75 * BLOCK_HEIGHT);  // Thinner item ~3px
export const SPEAR_COLOR = 'rgb(210, 180, 140)'; // Wood-like color
export const PLAYER_SPEAR_ATTACK_DAMAGE = 8; // Slightly less damage than sword
export const PLAYER_SPEAR_BLOCK_DAMAGE = 0; // Spears don't break blocks
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
    'dirt': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_DIRT] },
    'sand': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_SAND] },
    'wood': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_WOOD] },
    'stone': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_STONE] },
    'metal': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_METAL] },
    'bone': { width: Math.floor(1 * BLOCK_WIDTH), height: Math.floor(1 * BLOCK_HEIGHT), color: BLOCK_COLORS[BLOCK_BONE] },
// don't forget to add here if there are other items (material drops)
};

// =============================================================================
// --- Enemy Parameters ---
// =============================================================================

export const MAX_ENEMIES = 100;
export const ENEMY_SPAWN_EDGE_MARGIN = 80; // Pixels away from screen edge to attempt spawning
export const ENEMY_FLASH_DURATION = 0.15; // Seconds enemy flashes when hit
// --- Default  Size ---
export const DEFAULT_ENEMY_WIDTH = Math.floor(1.5 * BLOCK_WIDTH);
export const DEFAULT_ENEMY_HEIGHT = Math.floor(2.25 * BLOCK_HEIGHT);
// --- Default Separation Behavior ---
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // How close before pushing (factor of width)
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = 60; // How hard they push (pixels/sec velocity boost)
// --- Type Identifiers ---
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker';
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod'; // Add new type constants here: export const ENEMY_TYPE_FLYER = 'flyer';
// NEW: Tetrapod specific constants (including damage values)
export const TETRAPOD_WATER_CONTACT_DAMAGE = 1; // Damage when player touches Tetrapod in water
export const TETRAPOD_LAND_FLOP_DAMAGE = 1;     // Damage when player touches Tetrapod during a land hop
export const TETRAPOD_LAND_STILL_DAMAGE = 0;    // Damage when player touches Tetrapod on land but not hopping
export const TETRAPOD_FLOP_ATTACK_DURATION = 0.2; // How long the land flop damage window is active (seconds)
export const TETRAPOD_LAND_HOP_COOLDOWN_BASE = 1.5; // Base seconds between land hops
export const TETRAPOD_LAND_HOP_COOLDOWN_VARIATION = 1.0; // Random variation added to base cooldown
export const TETRAPOD_LAND_HOP_HORIZONTAL_FORCE = 50; // Horizontal velocity applied during a flop hop

// --- Detailed Stats ---
export const ENEMY_STATS = {
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod",
        aiType: 'flopAI',
        color: 'rgb(100, 120, 80)',
        width: DEFAULT_ENEMY_WIDTH,
        height: DEFAULT_ENEMY_HEIGHT,
        health: 1, // Very fragile
        contactDamage: 0, // <-- Base contact damage is 0. Logic in Enemy.js determines actual damage.
        applyGravity: true,
        gravityFactor: 1.0,
        maxSpeedX: 15, // Reduced land speed (only applies during hop action timer if AI sets vx)
        maxSpeedY: 50, // Used for vertical movement in water/air by Enemy.js
        swimSpeed: 70, // Max speed for swimming (used by AI for targetVx/Vy)
        canJump: true, // <-- Enable jumping for land hops
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.25, // <-- Set jump strength for flops
        canSwim: true, // Good in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2, // slightly more space
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.8, // less pushy
        dropTable: [
                { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 },
            ],
    },
    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker", // For potential UI/debugging
        aiType: 'seekCenter', // Key to match an AI Strategy class (to be implemented)
        color: 'rgb(80, 150, 80)', // Visual color
        width: DEFAULT_ENEMY_WIDTH, // Use default size
        height: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX: 40, // Movement speed (pixels/sec)
        health: 1, // Starting health points
        contactDamage: 10, // Damage dealt on player collision
        applyGravity: true, // Does gravity affect this enemy?
        gravityFactor: 1.0, // Multiplier for gravity (1.0 = normal)
        canJump: true, // Can this enemy initiate a jump?
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.5, // Meaningful jump strength relative to player
        canSwim: false, // Default land creature
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // Use default separation
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [
            { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 },
        ],
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
    },
        //     [ENEMY_TYPE_FLYER]: {
        // displayName: "Flyer",
        // aiType: 'flyPatrol', // A new AI strategy
        // color: 'lightblue',
        // width: DEFAULT_ENEMY_WIDTH,
        // height: DEFAULT_ENEMY_HEIGHT * 0.8, // Shorter?
        // maxSpeedX: 70,
        // maxSpeedY: 50, // Flyers need vertical speed control
        // health: 15,
        // contactDamage: 5,
        // applyGravity: false, // IMPORTANT for default state if canFly is true
        // canJump: false,
        // canSwim: false,
        // canFly: true, // The key flag
        // dropTable: [],
        // --- Future properties ---
        // attackType: 'none', // 'melee', 'ranged', 'aura', 'special'
        // Could have a bite attack
        // attackDamage: 1,
        // attackRange: 5,
        // attackCooldown: 1.5,
        // projectileType: null, // Key for projectile config if attackType is 'ranged'
        // immunities: [], // e.g., ['fire', 'poison'] - strings matching damage types
        // resistances: { 'physical': 0.1 }, // e.g., 10% physical resistance (0.0 to 1.0)
        // vulnerabilities: { 'fire': 1.5 }, // e.g., 50% extra fire damage
        // specialFlags: [], // e.g., ['explodes_on_death', 'teleports']
        // attackType: 'melee',
        //     }
};



// =============================================================================
// --- Wave Scripting ---
// =============================================================================

export const WAVE_START_DELAY = 10.0; // Seconds before the very first wave starts
export const WARPPHASE_DURATION = 5.0; // Fixed duration for the warp/cleanup phase

export const WAVE_ENEMY_SPAWN_DELAY = 0.5; // Default delay if not specified in group
export const WAVES = [
    { // === Wave 1 ===
        mainWaveNumber: 1, // for UI references
        duration: 117, // total wave duration in seconds
        intermissionDuration: 15.0, // total duration of the intermission *after* this wave
        audioTrack: 'assets/audio/music/Wave1-350.mp3',
        subWaves: [
            { // --- 1.1 ---
                enemyGroups: [
                    { type: ENEMY_TYPE_TETRAPOD, count: 10, delayBetween: 1.8, startDelay: 0.0 },
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.7, startDelay: 8.0 },
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 3, delayBetween: 0.5, startDelay: 15.0 },
                ]
            },
            { // --- 1.2 ---
                enemyGroups: [
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 4, delayBetween: 0.6, startDelay: 1.0 },
                    { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 3.0 }
                ]
            },
            { // --- 1.3 ---
                enemyGroups: [
                    { type: ENEMY_TYPE_CENTER_SEEKER, count: 6, delayBetween: 0.4, startDelay: 0.5 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 1, delayBetween: 1.5, startDelay: 4.0 }
                ]
            }
        ]
    },
    { // === Wave 2 ===
        mainWaveNumber: 2,
        duration: 137,
        intermissionDuration: 20.0,
        audioTrack: 'assets/audio/music/Wave2-300.mp3',
        subWaves: [
            { // --- 2.1 ---
                 enemyGroups: [
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 4, delayBetween: 1.2, startDelay: 1.0 },
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.6, startDelay: 3.0 },
                 ]
            },
            { // --- 2.2 ---
                 enemyGroups: [
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 10, delayBetween: 0.3, startDelay: 0.0 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 3, delayBetween: 1.0, startDelay: 5.0 },
                 ]
            },
            { // --- 2.3 ---
                 enemyGroups: [
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 5, delayBetween: 0.9, startDelay: 0.5 },
                     { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.5, startDelay: 1.5 },
                     { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 6.0 },
                 ]
            }
        ]
    },
    { // === Wave 3 ===
        mainWaveNumber: 3,
        duration: 90,
        intermissionDuration: 25.0, // Shorter intermission after wave 3
        audioTrack: 'assets/audio/music/wave3.mp3', // <-- need to add music track here
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    }
    // ===  ... 7ish more waves afterwards ===
];

// =============================================================================
// --- Epoch Mapping & Display ---
// =============================================================================
// Map wave number (1-based) to the epoch year (in millions of years)
export const EPOCH_MAP = {
    1: 350, // Wave 1 corresponds to 350 Million Years Ago
    2: 300, // Wave 2 corresponds to 300 Million Years Ago
    3: 90,  // Wave 3 corresponds to 90 Million Years Ago
    // Add mappings for subsequent waves as needed
};
// Duration the epoch text is displayed for each wave start (in seconds)
export const EPOCH_DISPLAY_DURATION = 4.0;

// =============================================================================
// --- Projectile Parameters (Future Use) ---
// =============================================================================
// Example:
// export const PROJECTILE_TYPES = {
//     ENEMY_SPIT: {
//         speed: 200,
//         damage: 5,
//         color: 'green',
//         width: 5,
//         height: 5,
//         lifetime: 3, // seconds
//         applyGravity: true,
//     }
// };