// root/js/config.js - Centralized Game Configuration

// =============================================================================
// --- Core Block / Pixel Size ---
// =============================================================================
// Define the base size of a block in pixels. This is the fundamental unit.
export const BASE_BLOCK_PIXEL_SIZE = 4; // desired block size (4px, 8px, 16px, etc.)

// Derived block dimensions (should always be equal to BASE_BLOCK_PIXEL_SIZE)
// Keeping these separate allows for potential non-square blocks later if needed.
export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE;
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE;


// =============================================================================
// --- World Generation Parameters ---
// =============================================================================

export const BACKGROUND_COLOR = 'rgb(135, 206, 235)';
// Canvas dimensions derived from grid size and block size
export const GRID_COLS = 400;
export const GRID_ROWS = 200; // Increased rows for deeper world
export const CANVAS_WIDTH = GRID_COLS * BLOCK_WIDTH;
export const CANVAS_HEIGHT = GRID_ROWS * BLOCK_HEIGHT; // canvas height matches grid height

export const WORLD_ISLAND_WIDTH = 0.8; // width of island as a percentage
export const WORLD_WATER_LEVEL_FRACTION = 0.15; // water covers bottom 15%
export const WORLD_WATER_LEVEL_ROW_TARGET = Math.floor(GRID_ROWS * (1.0 - WORLD_WATER_LEVEL_FRACTION)); // water level = +/- row 170

// Mean ground level (surface) defined in rows relative to the grid height
export const WORLD_GROUND_LEVEL_MEAN_ROW = WORLD_WATER_LEVEL_ROW_TARGET - Math.floor(GRID_ROWS * 0.10); // mean ground level (surface) = row 150
// Mean stone level defined in rows relative to the grid height
export const WORLD_STONE_DEPTH_BELOW_GROUND_ROWS = 15; // how many rows deep stone starts below the average ground level
export const WORLD_STONE_LEVEL_MEAN_ROW = WORLD_GROUND_LEVEL_MEAN_ROW + WORLD_STONE_DEPTH_BELOW_GROUND_ROWS; // mean stone level (row 165)

export const WORLD_GROUND_VARIATION = 3; // variations and noise scale (in rows)
export const WORLD_STONE_VARIATION = 3; // adjustable noise amount (in rows)
export const WORLD_NOISE_SCALE = 0.05;

// These determine the shape of the ocean floor/stone layers, defined in rows
export const OCEAN_FLOOR_ROW_NEAR_ISLAND = WORLD_WATER_LEVEL_ROW_TARGET + 5; // ocean tapering +/- row 175
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8; // +/- row 183
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1); // +/- 20 rows below water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3; // limit deep ocean floor (+/- row 197)
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WORLD_WATER_LEVEL_ROW_TARGET + DEEP_OCEAN_BASE_ROW_OFFSET); // +/- row 190
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8; // +/- row 198

export const EDGE_TAPER_WIDTH_FACTOR = 0.15; // percentage of grid width for edge taper
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 5; // target stone level below map at edge (in rows)
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 10; // target floor level below deep ocean floor at edge (in rows)
export const ISLAND_CENTER_TAPER_WIDTH_COLS = 80; // width of taper from island edge inward (in columns)

// =============================================================================
// --- World Aging Parameters ---
// =============================================================================

export const AGING_BASE_INTENSITY = 1.0; // default algorithm intensity
export const AGING_NOISE_SCALE = 0.03; // Scale for aging noise (controls patch size)

// Probabilities (remain between 0 and 1)
export const AGING_PROB_GRASS_GROWTH = 0.9; // Chance for DIRT -> GRASS if exposed to AIR and NOT WATER
export const AGING_PROB_SAND_SEDIMENTATION_BELOW = 0.9; // chance for Air/Water below waterline to become SAND
export const AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER = 0.9; // chance for Air/Water below waterline to become SAND
export const AGING_PROB_WATER_EROSION_DIRT_GRASS = 0.9; // chance for DIRT/GRASS -> SAND if exposed to WATER
export const AGING_PROB_WATER_EROSION_SAND = 0.00001; // Chance for SAND -> WATER/AIR if exposed to WATER (Sand erodes faster underwater)
export const AGING_PROB_AIR_EROSION_SAND = 0.0001; // Chance for SAND -> AIR if exposed to AIR (Wind erosion)
export const AGING_PROB_STONEIFICATION_DEEP = 0.000001; // Decreased from 0.00002
export const AGING_PROB_EROSION_SURFACE_STONE = 0.00001; // Small chance for exposed STONE -> AIR (very slow weathering)

// Depth threshold for stoneification, defined in pixels based on rows
export const AGING_STONEIFICATION_DEPTH_THRESHOLD_ROWS = Math.floor(GRID_ROWS * 0.45); // Stoneification below ~45% of grid height (row 90 for 200 rows)
export const AGING_STONEIFICATION_DEPTH_THRESHOLD = AGING_STONEIFICATION_DEPTH_THRESHOLD_ROWS * BLOCK_HEIGHT;

export const AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH = 4; // Max contiguous water depth above to influence probability (in blocks)
export const AGING_INITIAL_PASSES = 35; // Number of aging passes when the world is first generated
export const AGING_DEFAULT_PASSES_PER_WAVE = 5; // Default number of aging passes between waves if not specified per wave

export const WARPPHASE_DURATION = 5.0; // fixed duration of WARP PHASE in seconds (time-based, no pixel scaling)

// =============================================================================
// --- Camera / Viewport ---
// =============================================================================
export const MIN_CAMERA_SCALE = 0.25; // min zoom level (zoom out)
export const MAX_CAMERA_SCALE = 3.0; // max zoom level (zoom in)
export const ZOOM_SPEED_FACTOR = 0.001; // how fast scrolling zooms (should be relative to deltaY, not pixels directly, likely fine as is)

// =============================================================================
// --- Animation Parameters ---
// =============================================================================
// Enemy Death Animation (Time-based, no pixel scaling needed)
export const ENEMY_DEATH_ANIMATION_DURATION = 0.5; // Total time for enemy death (swell + pop)
export const ENEMY_SWELL_DURATION = 0.3; // Time for the swell part (peak reached at 0.3s)
export const ENEMY_SWELL_SCALE = 1.5; // Max scale factor during the swell
// Player Death Animation (Time-based, no pixel scaling needed)
export const PLAYER_DEATH_ANIMATION_DURATION = 1.5; // Total time for player death (spin + swell + pop)
export const PLAYER_SPIN_DURATION = 1.0; // Time for the spinning part
export const PLAYER_SPIN_FRAMES = 6; // Number of visual steps in the spin (e.g., 6 steps for 60-degree increments)

// =============================================================================
// --- Delta-Time Based Physics ---
// =============================================================================
// Gravity acceleration (pixels per second per second), scaled by block height
export const GRAVITY_ACCELERATION_BLOCKS_PER_SEC_SQ = 100; // Accelerate by 100 block heights/sec, per sec
export const GRAVITY_ACCELERATION = GRAVITY_ACCELERATION_BLOCKS_PER_SEC_SQ * BLOCK_HEIGHT;

// Max fall speed (pixels per second), scaled by block height
export const MAX_FALL_SPEED_BLOCKS_PER_SEC = 120; // Max fall speed of 120 block heights per second
export const MAX_FALL_SPEED = MAX_FALL_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT;

export const MAX_DELTA_TIME = 0.05; // max time step (seconds) to prevent physics glitches (~1/20th second or 20fps min simulation rate)

// Entity step-up allowance, defined as factors of entity height (already relative)
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // effortless step at +/- 0.33
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2; // max height for slowed step (+/- 0.5)
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.7; // horizontal velocity multiplier after completing a tier 2 step, retain 70% of horizontal speed

// Water physics factors (remain as factors)
export const WATER_GRAVITY_FACTOR = 0.4; // reduced gravity in water
export const WATER_HORIZONTAL_DAMPING = 0.1; // strong horizontal drag
export const WATER_VERTICAL_DAMPING = 0.05; // stronger vertical drag
export const WATER_MAX_SPEED_FACTOR = 0.6; // reduce max horizontal speed in water
export const WATER_ACCELERATION_FACTOR = 0.5; // reduce horizontal acceleration in water

// Water movement speeds (pixels per second), scaled by block height
export const WATER_SWIM_VELOCITY_BLOCKS_PER_SEC = 50; // initial upward speed from a swim 'stroke' (50 block heights/sec)
export const WATER_SWIM_VELOCITY = WATER_SWIM_VELOCITY_BLOCKS_PER_SEC * BLOCK_HEIGHT;

export const WATER_MAX_SWIM_UP_SPEED_BLOCKS_PER_SEC = 20; // max speed swimming up (20 block heights/sec)
export const WATER_MAX_SWIM_UP_SPEED = WATER_MAX_SWIM_UP_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT;

export const WATER_MAX_SINK_SPEED_BLOCKS_PER_SEC = 25; // max speed falling down in water (25 block heights/sec)
export const WATER_MAX_SINK_SPEED = WATER_MAX_SINK_SPEED_BLOCKS_PER_SEC * BLOCK_HEIGHT;

// Enemy water buoyancy acceleration (pixels per second per second), scaled by block height
export const ENEMY_WATER_BUOYANCY_ACCEL_BLOCKS_PER_SEC_SQ = 45; // Buoyancy acceleration equivalent to 45 block heights/sec^2
export const ENEMY_WATER_BUOYANCY_ACCEL = ENEMY_WATER_BUOYANCY_ACCEL_BLOCKS_PER_SEC_SQ * BLOCK_HEIGHT;

export const WATER_JUMP_COOLDOWN_DURATION = 0.2; // Time-based, no pixel scaling
export const WATER_PROPAGATION_DELAY = 0.05; // Time-based, no pixel scaling
export const WATER_UPDATES_PER_FRAME = 500; // Number of cells, no pixel scaling

// =============================================================================
// --- Audio Constants --- (Time/Volume based, no pixel scaling needed)
// =============================================================================
export const AUDIO_SFX_POOL_SIZE = 8;
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4;
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;
export const AUDIO_TRACKS = {
    // --- Music ---
    // title: 'assets/audio/title_music.mp3', // TODO: add title music
    pause: 'assets/audio/music/Pause.mp3',
    // gameOver: 'assets/audio/gameover_music.mp3', // TODO: add game over music
    victory: 'assets/audio/music/Victory.mp3',
    // introMusic: 'assets/audio/music/Intro.mp3', // TODO: Add intro music track
    // Wave Music
    wave1: 'assets/audio/music/Wave1-350.mp3', // Map audio tracks to wave numbers or states
    wave2: 'assets/audio/music/Wave2-300.mp3',
    wave3: 'assets/audio/music/wave3.mp3', // Added track for wave 3

    // --- Sound Effects ---
    // player_hit: 'assets/audio/sfx/player_hit.wav', // TODO: add sfx
    // enemy_hit: 'assets/audio/sfx/enemy_hit.wav',
    // enemy_death: 'assets/audio/sfx/enemy_death.wav',
    // block_break_dirt: 'assets/audio/sfx/block_break_dirt.wav',
    // block_break_stone: 'assets/audio/sfx/block_break_stone.wav',
    // item_pickup: 'assets/audio/sfx/item_pickup.wav',
    // button_click: 'assets/audio/sfx/button_click.wav',
    // player_jump: 'assets/audio/sfx/player_jump.wav', // for ground jump
    // player_water_stroke: 'assets/audio/sfx/player_water_stroke.wav', // for water "jump"
    // player_attack_swing: 'assets/audio/sfx/attack_swing.wav', // generic attack sound
    // player_attack_hit: 'assets/audio/sfx/attack_hit.wav', // sound when player attack hits something
    // portal_hit: 'assets/audio/sfx/portal_hit.wav', // TODO: add sfx
    // portal_destroyed: 'assets/audio/sfx/portal_destroyed.wav', // TODO: add sfx
};

// =============================================================================
// --- Block Parameters ---
// =============================================================================
// BLOCK_WIDTH and BLOCK_HEIGHT are already defined at the top, equal to BASE_BLOCK_PIXEL_SIZE.

export const BLOCK_DAMAGE_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.5)'; // semi-transparent black
export const BLOCK_DAMAGE_INDICATOR_LINE_WIDTH = 2; // thickness of the slash/X (in pixels, relative thickness might be better?) - Let's keep as fixed pixels for visual consistency relative to screen.
export const BLOCK_DAMAGE_THRESHOLD_SLASH = 0.7; // slash when HP <= 70%
export const BLOCK_DAMAGE_THRESHOLD_X = 0.3; // X when HP <= 30%
export const GHOST_BLOCK_ALPHA = 0.5; // transparency level of preview block
export const CAN_PLACE_IN_WATER = false; // TODO: future power enhancement
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)'; // outline colour of player-placed blocks
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 1; // 1 pixel thick (keep as fixed pixel value)

export const INVENTORY_MATERIALS = ['wood', 'stone', 'metal', 'dirt', 'sand', 'bone']; // TODO: add new types here

// Block Type IDs (remain constants)
export const BLOCK_AIR = 0;
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_GRASS = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD = 6;
export const BLOCK_METAL = 7;
export const BLOCK_BONE = 8; // TODO: glass, specific ores, etc.

// Block HP (remain fixed, not scaled by block size)
export const BLOCK_HP = {
    [BLOCK_WATER]: Infinity,
    [BLOCK_SAND]: 30,
    [BLOCK_DIRT]: 50,
    [BLOCK_GRASS]: 50,
    [BLOCK_STONE]: 300,
    [BLOCK_WOOD]: 100,
    [BLOCK_METAL]: 500,
    [BLOCK_BONE]: 120, // TODO: add HP for other types later
};
// Block Colors (remain fixed)
export const BLOCK_COLORS = {
    [BLOCK_WATER]: 'rgb(50, 100, 200)',
    [BLOCK_SAND]: 'rgb(210, 180, 140)',
    [BLOCK_DIRT]: 'rgb(130, 82, 45)',
    [BLOCK_GRASS]: 'rgb(80, 180, 80)',
    [BLOCK_STONE]: 'rgb(140, 140, 140)',
    [BLOCK_WOOD]: 'rgb(160, 110, 70)',
    [BLOCK_METAL]: 'rgb(190, 190, 200)',
    [BLOCK_BONE]: 'rgb(200, 190, 170)',
};
// Material to Block Type mapping (remain fixed)
export const MATERIAL_TO_BLOCK_TYPE = {
    'dirt': BLOCK_DIRT,
    'stone': BLOCK_STONE,
    'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND,
    'metal': BLOCK_METAL,
    'bone': BLOCK_BONE, // TODO: add other placeable materials here if needed
};
// Sand Sedimentation Below Convertible Materials (remain fixed)
export const AGING_MATERIAL_CONVERSION_FACTORS = { // Materials below sand that can be converted. Factors set to 1.0 for equal chance.
    [BLOCK_DIRT]: 1.0, // Dirt is convertible
    [BLOCK_GRASS]: 1.0, // Grass is convertible
    [BLOCK_STONE]: 1.0, // Stone is convertible (with equal chance now)
    [BLOCK_BONE]: 1.0, // Bone is convertible
    [BLOCK_WOOD]: 1.0, // Wood is convertible
    [BLOCK_METAL]: 1.0, // Metal is convertible? (Decide if metal should be convertible)
    // Add factors for other materials here if they can be converted by sand.
    // Materials not listed implicitly have a factor of 0 (cannot be converted by this rule)
};

// =============================================================================
// --- Portal Parameters ---
// =============================================================================
export const PORTAL_COLOR = 'rgb(100, 100, 255)'; // blueish
// Portal dimensions defined in blocks, then scaled to pixels
export const PORTAL_WIDTH_BLOCKS = 8; // 8 blocks wide
export const PORTAL_HEIGHT_BLOCKS = 10; // 10 blocks tall
export const PORTAL_WIDTH = PORTAL_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PORTAL_HEIGHT = PORTAL_HEIGHT_BLOCKS * BLOCK_HEIGHT;

export const PORTAL_INITIAL_HEALTH = 500;

// Portal safety radius defined in blocks, then scaled to pixels
export const PORTAL_SAFETY_RADIUS_BLOCKS = 30; // 30 blocks radius
export const PORTAL_SAFETY_RADIUS = PORTAL_SAFETY_RADIUS_BLOCKS * BASE_BLOCK_PIXEL_SIZE; // Scales directly with BASE_BLOCK_PIXEL_SIZE

// Portal radius growth per wave, defined in pixels (could also be blocks, but small pixel increments work)
// Let's keep this as pixels for now for finer control, or change to blocks if needed.
// Keeping as pixels means the *absolute pixel growth* is constant, not relative to block size.
// If you want it relative, define in blocks:
export const PORTAL_RADIUS_GROWTH_PER_WAVE_BLOCKS = 6; // Grow radius by 6 blocks per intermission
export const PORTAL_RADIUS_GROWTH_PER_WAVE = PORTAL_RADIUS_GROWTH_PER_WAVE_BLOCKS * BASE_BLOCK_PIXEL_SIZE; // Scaled by BASE_BLOCK_PIXEL_SIZE

export const PORTAL_SPAWN_Y_OFFSET_BLOCKS = 8; // how many blocks above mean ground level to spawn the top of the portal (in blocks)

// =============================================================================
// --- Player Parameters ---
// =============================================================================
export const PLAYER_COLOR = 'rgb(200, 50, 50)';
// Player dimensions defined in blocks, then scaled to pixels
export const PLAYER_WIDTH_BLOCKS = 3; // 3 blocks wide
export const PLAYER_HEIGHT_BLOCKS = 6; // 6 blocks tall
export const PLAYER_WIDTH = PLAYER_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_HEIGHT = PLAYER_HEIGHT_BLOCKS * BLOCK_HEIGHT;

// Player start position calculations use grid rows scaled to pixels, already implicitly scaled.
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2; // spawn Position
export const PLAYER_START_Y = (WORLD_GROUND_LEVEL_MEAN_ROW * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT); // slightly above mean ground

export const PLAYER_INITIAL_HEALTH = 100; // health stats (remain fixed)
export const PLAYER_MAX_HEALTH_DISPLAY = 100; // max health for UI display (remain fixed)
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds (time-based)

// Player movement parameters (scaled to pixels per second)
export const PLAYER_MOVE_ACCELERATION_BLOCKS_PER_SEC_SQ = 200; // Accelerate at 200 block lengths/sec^2
export const PLAYER_MOVE_ACCELERATION = PLAYER_MOVE_ACCELERATION_BLOCKS_PER_SEC_SQ * BLOCK_WIDTH;

export const PLAYER_MAX_SPEED_X_BLOCKS_PER_SEC = 30; // Max horizontal speed of 30 block lengths/sec
export const PLAYER_MAX_SPEED_X = PLAYER_MAX_SPEED_X_BLOCKS_PER_SEC * BLOCK_WIDTH;

export const PLAYER_FRICTION_BASE = 0.01; // Example: Retain 1% of velocity per second when not accelerating (adjust this value)

// Player jump velocity (scaled to pixels per second)
export const PLAYER_JUMP_VELOCITY_BLOCKS_PER_SEC = 50; // Initial upward velocity of 50 block heights per second
export const PLAYER_JUMP_VELOCITY = PLAYER_JUMP_VELOCITY_BLOCKS_PER_SEC * BLOCK_HEIGHT;

// Player interaction range (scaled to pixels)
export const PLAYER_INTERACTION_RANGE_BLOCKS = 12; // Player can interact up to 12 blocks away
export const PLAYER_INTERACTION_RANGE = PLAYER_INTERACTION_RANGE_BLOCKS * BLOCK_WIDTH;
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE; // Pre-calculate squared value

// Player item attraction radius (scaled to pixels)
export const PLAYER_ITEM_ATTRACT_RADIUS_BLOCKS = 25; // Items attract from 25 blocks away
export const PLAYER_ITEM_ATTRACT_RADIUS = PLAYER_ITEM_ATTRACT_RADIUS_BLOCKS * BLOCK_WIDTH;
export const PLAYER_ITEM_ATTRACT_RADIUS_SQ = PLAYER_ITEM_ATTRACT_RADIUS * PLAYER_ITEM_ATTRACT_RADIUS; // Pre-calculate squared value

// Player item attraction speed (scaled to pixels per second)
export const PLAYER_ITEM_ATTRACT_SPEED_BLOCKS_PER_SEC = 60; // Attracted items move at 60 block lengths/sec
export const PLAYER_ITEM_ATTRACT_SPEED = PLAYER_ITEM_ATTRACT_SPEED_BLOCKS_PER_SEC * BLOCK_WIDTH;

export const PLAYER_PLACEMENT_COOLDOWN = 0.15; // seconds per block placement (time-based)

// =============================================================================
// --- Items & Weapons ---
// =============================================================================
export const ITEM_BOBBLE_AMOUNT = 0.15; // how much items bob (relative to item height) - remains relative factor
export const ITEM_BOBBLE_SPEED = 2.0; // radians per second for bobbing cycle (time-based)

// Weapon types (remain strings)
export const WEAPON_TYPE_UNARMED = 'unarmed';
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear';

// Weapon dimensions defined in blocks, then scaled to pixels
export const SHOVEL_WIDTH_BLOCKS = 1; export const SHOVEL_HEIGHT_BLOCKS = 2;
export const SHOVEL_WIDTH = SHOVEL_WIDTH_BLOCKS * BLOCK_WIDTH;
export const SHOVEL_HEIGHT = SHOVEL_HEIGHT_BLOCKS * BLOCK_HEIGHT;

export const SWORD_WIDTH_BLOCKS = 3; export const SWORD_HEIGHT_BLOCKS = 1;
export const SWORD_WIDTH = SWORD_WIDTH_BLOCKS * BLOCK_WIDTH;
export const SWORD_HEIGHT = SWORD_HEIGHT_BLOCKS * BLOCK_HEIGHT;

export const SPEAR_WIDTH_BLOCKS = 4; export const SPEAR_HEIGHT_BLOCKS = 1;
export const SPEAR_WIDTH = SPEAR_WIDTH_BLOCKS * BLOCK_WIDTH;
export const SPEAR_HEIGHT = SPEAR_HEIGHT_BLOCKS * BLOCK_HEIGHT;

// Weapon colors (remain fixed)
export const SHOVEL_COLOR = 'rgb(160, 160, 160)'; // grey
export const SWORD_COLOR = 'rgb(180, 180, 190)';
export const SPEAR_COLOR = 'rgb(210, 180, 140)'; // wood-like color

// Player attack damage/reach (scaled to pixels or damage values)
export const PLAYER_SHOVEL_ATTACK_DAMAGE = 5; // vs enemies (remain fixed)
export const PLAYER_SHOVEL_BLOCK_DAMAGE = 25; // vs blocks (remain fixed)
export const PLAYER_SHOVEL_ATTACK_REACH_X_BLOCKS = PLAYER_WIDTH_BLOCKS/2 + SHOVEL_WIDTH_BLOCKS*1.5; // Reach X in blocks
export const PLAYER_SHOVEL_ATTACK_REACH_X = PLAYER_SHOVEL_ATTACK_REACH_X_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SHOVEL_ATTACK_REACH_Y_BLOCKS = PLAYER_HEIGHT_BLOCKS*0.4; // Reach Y in blocks
export const PLAYER_SHOVEL_ATTACK_REACH_Y = PLAYER_SHOVEL_ATTACK_REACH_Y_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SHOVEL_ATTACK_WIDTH_BLOCKS = SHOVEL_WIDTH_BLOCKS * 2; // Hitbox width in blocks
export const PLAYER_SHOVEL_ATTACK_WIDTH = PLAYER_SHOVEL_ATTACK_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SHOVEL_ATTACK_HEIGHT_BLOCKS = SHOVEL_HEIGHT_BLOCKS * 2; // Hitbox height in blocks
export const PLAYER_SHOVEL_ATTACK_HEIGHT = PLAYER_SHOVEL_ATTACK_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SHOVEL_ATTACK_DURATION = 0.3; // seconds (time-based)
export const PLAYER_SHOVEL_ATTACK_COOLDOWN = 0.4; // seconds (time-based)
export const PLAYER_SHOVEL_ATTACK_COLOR = 'rgba(180, 180, 180, 0.5)';

export const PLAYER_SWORD_ATTACK_DAMAGE = 15; // vs enemies (remain fixed)
export const PLAYER_SWORD_BLOCK_DAMAGE = 0; // vs blocks (remain fixed)
export const PLAYER_SWORD_ATTACK_REACH_X_BLOCKS = PLAYER_WIDTH_BLOCKS * 0.8; // Reach X in blocks
export const PLAYER_SWORD_ATTACK_REACH_X = PLAYER_SWORD_ATTACK_REACH_X_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SWORD_ATTACK_REACH_Y_BLOCKS = PLAYER_HEIGHT_BLOCKS * 0; // Reach Y in blocks
export const PLAYER_SWORD_ATTACK_REACH_Y = PLAYER_SWORD_ATTACK_REACH_Y_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SWORD_ATTACK_WIDTH_BLOCKS = PLAYER_WIDTH_BLOCKS * 1.5; // Hitbox width in blocks
export const PLAYER_SWORD_ATTACK_WIDTH = PLAYER_SWORD_ATTACK_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SWORD_ATTACK_HEIGHT_BLOCKS = PLAYER_HEIGHT_BLOCKS * 0.9; // Hitbox height in blocks
export const PLAYER_SWORD_ATTACK_HEIGHT = PLAYER_SWORD_ATTACK_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SWORD_ATTACK_DURATION = 0.2; // seconds (time-based)
export const PLAYER_SWORD_ATTACK_COOLDOWN = 0.3; // seconds (time-based)
export const PLAYER_SWORD_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';

export const PLAYER_SPEAR_ATTACK_DAMAGE = 8; // vs enemies (remain fixed)
export const PLAYER_SPEAR_BLOCK_DAMAGE = 0; // vs blocks (remain fixed)
export const PLAYER_SPEAR_ATTACK_REACH_X_BLOCKS = PLAYER_WIDTH_BLOCKS * 1.2; // Reach X in blocks
export const PLAYER_SPEAR_ATTACK_REACH_X = PLAYER_SPEAR_ATTACK_REACH_X_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SPEAR_ATTACK_REACH_Y_BLOCKS = PLAYER_HEIGHT_BLOCKS * 0.1; // Reach Y in blocks
export const PLAYER_SPEAR_ATTACK_REACH_Y = PLAYER_SPEAR_ATTACK_REACH_Y_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SPEAR_ATTACK_WIDTH_BLOCKS = SPEAR_WIDTH_BLOCKS * 0.3; // Hitbox width in blocks
export const PLAYER_SPEAR_ATTACK_WIDTH = PLAYER_SPEAR_ATTACK_WIDTH_BLOCKS * BLOCK_WIDTH;
export const PLAYER_SPEAR_ATTACK_HEIGHT_BLOCKS = SPEAR_HEIGHT_BLOCKS * 2; // Hitbox height in blocks
export const PLAYER_SPEAR_ATTACK_HEIGHT = PLAYER_SPEAR_ATTACK_HEIGHT_BLOCKS * BLOCK_HEIGHT;
export const PLAYER_SPEAR_ATTACK_DURATION = 0.3; // seconds (time-based)
export const PLAYER_SPEAR_ATTACK_COOLDOWN = 0.5; // seconds (time-based)
export const PLAYER_SPEAR_ATTACK_COLOR = 'rgba(220, 220, 180, 0.5)';

// Item configuration (uses dimensions defined above)
export const ITEM_CONFIG = {
    [WEAPON_TYPE_SHOVEL]: { width: SHOVEL_WIDTH, height: SHOVEL_HEIGHT, color: SHOVEL_COLOR },
    [WEAPON_TYPE_SWORD]: { width: SWORD_WIDTH, height: SWORD_HEIGHT, color: SWORD_COLOR },
    [WEAPON_TYPE_SPEAR]: { width: SPEAR_WIDTH, height: SPEAR_HEIGHT, color: SPEAR_COLOR },
    'dirt': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_DIRT] },
    'sand': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_SAND] },
    'wood': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_WOOD] },
    'stone': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_STONE] },
    'metal': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_METAL] },
    'bone': { width: 1 * BLOCK_WIDTH, height: 1 * BLOCK_HEIGHT, color: BLOCK_COLORS[BLOCK_BONE] }, // TODO: don't forget to add here if there are other items (material drops)
};

// Crafting recipes (remain fixed)
export const CRAFTING_RECIPES = {
    [WEAPON_TYPE_SWORD]: [
        { type: 'stone', amount: 5 }
    ],
    [WEAPON_TYPE_SPEAR]: [
        { type: 'wood', amount: 2 },
        { type: 'stone', amount: 1 }
    ],
    // add other craftable items here
};

// =============================================================================
// --- Enemy Parameters ---
// =============================================================================
export const MAX_ENEMIES = 100;

// Enemy spawn edge margin (scaled to pixels)
export const ENEMY_SPAWN_EDGE_MARGIN_BLOCKS = 20; // Spawn 20 blocks away from screen edge
export const ENEMY_SPAWN_EDGE_MARGIN = ENEMY_SPAWN_EDGE_MARGIN_BLOCKS * BLOCK_WIDTH;

export const ENEMY_FLASH_DURATION = 0.15; // seconds (time-based)

// Default enemy dimensions defined in blocks, then scaled to pixels
export const DEFAULT_ENEMY_WIDTH_BLOCKS = 2; // 2 blocks wide
export const DEFAULT_ENEMY_HEIGHT_BLOCKS = 2; // 2 blocks tall
export const DEFAULT_ENEMY_WIDTH = DEFAULT_ENEMY_WIDTH_BLOCKS * BLOCK_WIDTH;
export const DEFAULT_ENEMY_HEIGHT = DEFAULT_ENEMY_HEIGHT_BLOCKS * BLOCK_HEIGHT;

// Default enemy separation parameters (scaled to factors and pixels/sec)
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // how close before pushing (factor of width) - remains factor
export const DEFAULT_ENEMY_SEPARATION_STRENGTH_PIXELS_PER_SEC = 60; // how hard they push (pixels/sec velocity boost) - scaled by block width
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = DEFAULT_ENEMY_SEPARATION_STRENGTH_PIXELS_PER_SEC * BLOCK_WIDTH; // Scale strength

// Enemy types (remain strings)
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker';
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod'; // add new type constants here: export const ENEMY_TYPE_FLYER = 'flyer';

// Tetrapod specific constants (damage remains fixed, velocity scaled)
export const TETRAPOD_WATER_CONTACT_DAMAGE = 1; // damage when player touches tetrapod in water
export const TETRAPOD_LAND_FLOP_DAMAGE = 1; // damage when player touches tetrapod during a land hop
export const TETRAPOD_LAND_STILL_DAMAGE = 0; // damage when player touches tetrapod on land but not hopping
export const TETRAPOD_FLOP_ATTACK_DURATION = 0.2; // how long the land flop damage window is active (seconds) (time-based)
export const TETRAPOD_LAND_HOP_COOLDOWN_BASE = 1.5; // base seconds between land hops (time-based)
export const TETRAPOD_LAND_HOP_COOLDOWN_VARIATION = 1.0; // random variation added to base cooldown (time-based)

// Enemy Stats - Define speeds/velocities/forces relative to BASE_BLOCK_PIXEL_SIZE (e.g., original 4px)
// These values will be scaled in enemy.js based on the *current* BLOCK_WIDTH/HEIGHT.
export const ENEMY_STATS = { // detailed stats - enemy and AI constructors read from this config
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod",
        aiType: 'flopAI',
        color: 'rgb(100, 120, 80)', // muddy greenish-brown
        width: DEFAULT_ENEMY_WIDTH_BLOCKS, // Define width in blocks
        height: DEFAULT_ENEMY_HEIGHT_BLOCKS, // Define height in blocks
        health: 1, // remain fixed
        contactDamage: 0, // base damage is 0 - logic in enemy.js determines actual damage
        applyGravity: true, // boolean
        gravityFactor: 1.0, // factor (remain factor)
        maxSpeedX: 15, // Define maxSpeedX relative to 4px block width
        maxSpeedY: 50, // Define maxSpeedY relative to 4px block height (esed for vertical movement in air/water by Enemy.js)
        swimSpeed: 70, // Define swimSpeed relative to 4px block height
        canJump: true, // enable jumping for land hops
        jumpVelocity: 200 * 0.25, // Define jumpVelocity relative to 4px block height
        canSwim: true, // good in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2, // slightly more space (remain factor)
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH_PIXELS_PER_SEC * 0.8, // less pushy (relative to 4px)
        landHopHorizontalVelocity: 50, // Horizontal velocity impulse during hop (relative to 4px block width)
        dropTable: [
            { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 },
        ],
    },
    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker", // for potential UI/debugging
        aiType: 'seekCenter', // key to match an AI Strategy class (to be implemented)
        color: 'rgb(80, 150, 80)', // visual color
        width: DEFAULT_ENEMY_WIDTH_BLOCKS, // Define width in blocks
        height: DEFAULT_ENEMY_HEIGHT_BLOCKS, // Define height in blocks
        maxSpeedX: 40, // movement speed (pixels/sec) (relative to 4px)
        maxSpeedY: 50, // ensure maxSpeedY has a default for swimming/flying checks (relative to 4px)
        swimSpeed: 50, // ensure swimSpeed has a default (relative to 4px)
        health: 1, // starting health points (remain fixed)
        contactDamage: 10, // damage dealt on player collision (base damage) (remain fixed)
        applyGravity: true, // boolean
        gravityFactor: 1.0, // multiplier for gravity (1.0 = normal) (remain factor)
        canJump: true, // can this enemy initiate a jump?
        jumpVelocity: 200 * 0.5, // meaningful jump strength relative to player (relative to 4px)
        canSwim: false, // default land creature
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // remain factor
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH_PIXELS_PER_SEC, // relative to 4px
        dropTable: [
            { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 },
        ],
    },
    [ENEMY_TYPE_PLAYER_CHASER]: {
        displayName: "Chaser",
        aiType: 'chasePlayer', // key for AI strategy
        color: 'rgb(150, 80, 80)',
        width: DEFAULT_ENEMY_WIDTH_BLOCKS, // Define width in blocks
        height: DEFAULT_ENEMY_HEIGHT_BLOCKS, // Define height in blocks
        maxSpeedX: 55, // slightly faster (relative to 4px)
        maxSpeedY: 50, // ensure maxSpeedY has a default (relative to 4px)
        swimSpeed: 50, // ensure swimSpeed has a default (relative to 4px)
        health: 2, // slightly tougher (remain fixed)
        contactDamage: 10, // base damage (remain fixed)
        applyGravity: true, // boolean
        gravityFactor: 1.0, // factor
        canJump: true, // chasers can jump over small obstacles
        jumpVelocity: 200 * 0.75, // jump strength relative to player (relative to 4px)
        canSwim: false, // becomes encumbered in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // remain factor
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH_PIXELS_PER_SEC, // relative to 4px
        dropTable: [
            { type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 }, // TODO: change to drop bone after trees are implemented
        ],
    },
    // [ENEMY_TYPE_FLYER]: {
    // displayName: "Flyer",
    // aiType: 'flyPatrol', // A new AI strategy
    // color: 'lightblue',
    // width: DEFAULT_ENEMY_WIDTH_BLOCKS, // Define width in blocks
    // height: DEFAULT_ENEMY_HEIGHT_BLOCKS * 0.8, // Shorter? (define height in blocks)
    // maxSpeedX: 70, // relative to 4px
    // maxSpeedY: 50, // Flyers need vertical speed control (relative to 4px)
    // health: 15, // remain fixed
    // contactDamage: 5, // remain fixed
    // applyGravity: false, // IMPORTANT for default state if canFly is true
    // canJump: false,
    // canSwim: false,
    // canFly: true, // The key flag
    // dropTable: [],
    // separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // remain factor
    // separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH_PIXELS_PER_SEC, // relative to 4px
    // }
};

// =============================================================================
// --- Wave Scripting --- (Time-based, no pixel scaling needed, except epoch map)
// =============================================================================
export const WAVE_START_DELAY = 5.0; // seconds before the very first wave starts
// Map wave numbers to epoch years (or display names)
export const EPOCH_MAP = {
    0: "Origin", // Before first wave
    1: "The Emergence", // Start of wave 1
    2: "The Shifting Tides", // Start of wave 2
    3: "The Great Sinking", // Start of wave 3 (example name)
    // Add entries for subsequent waves...
    // Config.WAVES.length + 1: "Victory" // Optional: Map victory to an epoch
};
export const EPOCH_DISPLAY_DURATION = 3.0; // seconds epoch text is displayed

export const WAVES = [
    { // === 1 ===
        mainWaveNumber: 1, // for UI references
        duration: 117, // total wave duration in seconds
        intermissionDuration: 15.0, // total duration of intermission after this wave
        audioTrack: AUDIO_TRACKS.wave1, // Use track from AUDIO_TRACKS
        agingIntensity: 1.0, // Can be specified per wave
        agingPasses: 50, // Number of aging passes for the INTERMISSION after this wave
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
    { // === 2 ===
        mainWaveNumber: 2,
        duration: 137,
        intermissionDuration: 20.0,
        audioTrack: AUDIO_TRACKS.wave2, // Use track from AUDIO_TRACKS
        agingIntensity: 1.2, // Example: Wave 2 could have slightly more aging
        agingPasses: 100, // More aging passes
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
    { // === 3 ===
        mainWaveNumber: 3,
        duration: 90,
        intermissionDuration: 25.0, // shorter intermission
        audioTrack: AUDIO_TRACKS.wave3, // <-- TODO: add music track here
        agingIntensity: 1.0, // Back to base intensity
        agingPasses: 150, // Even more aging
        subWaves: [
            { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
            { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
        ]
    }
    // === ... 7ish more waves afterwards ===
];

// =============================================================================
// --- Projectile Parameters (Future Use) ---
// =============================================================================
// Projectile speeds/dimensions would also need scaling.
//
// export const PROJECTILE_TYPES = {
//     ENEMY_SPIT: {
//         speed_BLOCKS_PER_SEC: 50, // Speed in blocks/sec
//         speed: 50 * BLOCK_WIDTH, // Calculated pixel speed
//         damage: 5, // remain fixed
//         width_BLOCKS: 1, // Width in blocks
//         height_BLOCKS: 1, // Height in blocks
//         width: 1 * BLOCK_WIDTH, // Calculated pixel width
//         height: 1 * BLOCK_HEIGHT, // Calculated pixel height
//         lifetime: 3, // seconds (time-based)
//         applyGravity: true, // boolean
//     }
// };

// =============================================================================
// --- Cutscene Parameters --- (Time/Image based, no pixel scaling needed)
// =============================================================================
export const CUTSCENE_IMAGE_PATHS = [
    'assets/gendimage1.png', // replace
    'assets/gendimage2.png',
    'assets/gendimage1.png',
    'assets/gendimage2.png',
];
export const CUTSCENE_IMAGE_DURATION = 5.0; // Seconds each image is displayed

// =============================================================================
// --- Debug/Development Flags ---
// =============================================================================
export const DEBUG_SKIP_CUTSCENE = false; // Set to true to skip the cutscene for faster testing