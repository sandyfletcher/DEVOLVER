// root/js/config.js - Centralized Game Configuration

// =============================================================================
// --- World Generation Parameters ---
// =============================================================================

export const BACKGROUND_COLOR = 'rgb(135, 206, 235)';
export const BASE_BLOCK_PIXEL_SIZE = 4; // desired block size
export const GRID_COLS = 400;
export const GRID_ROWS = 200;
export const CANVAS_WIDTH = GRID_COLS * BASE_BLOCK_PIXEL_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * BASE_BLOCK_PIXEL_SIZE; // canvas height matches grid height
export const WORLD_ISLAND_WIDTH = 0.8; // width of island as a percentage
export const WORLD_WATER_LEVEL = 0.15; // water covers bottom 15%, could be raised for environmental chaos
export const WORLD_WATER_LEVEL_ROW_TARGET = Math.floor(GRID_ROWS * (1.0 - WORLD_WATER_LEVEL)); // water level = +/- row 170
export const WORLD_GROUND_LEVEL_MEAN = WORLD_WATER_LEVEL_ROW_TARGET - Math.floor(GRID_ROWS * 0.10); // mean ground level (surface) = row 150
const STONE_DEPTH_BELOW_GROUND = 15; // how deep stone starts below the average ground level
export const WORLD_STONE_LEVEL_MEAN = WORLD_GROUND_LEVEL_MEAN + STONE_DEPTH_BELOW_GROUND; // mean stone level (row 165)
export const WORLD_GROUND_VARIATION = 3; // variations and noise scale
export const WORLD_STONE_VARIATION = 3; // adjustable noise amount
export const WORLD_NOISE_SCALE = 0.05;
export const OCEAN_FLOOR_ROW_NEAR_ISLAND = WORLD_WATER_LEVEL_ROW_TARGET + 5; // ocean tapering +/- row 175
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8; // +/- row 183
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1); // +/- 20 rows below water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3; // limit deep ocean floor (+/- row 197)
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WORLD_WATER_LEVEL_ROW_TARGET + DEEP_OCEAN_BASE_ROW_OFFSET); // +/- row 190
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8; // +/- row 198
export const EDGE_TAPER_WIDTH_FACTOR = 0.15; // percentage of grid width for edge taper
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 5; // target stone level below map at edge
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 10; // target floor level below deep ocean floor at edge
export const ISLAND_CENTER_TAPER_WIDTH = 80; // width of taper from island edge inward

// =============================================================================
// --- Delta-Time Based Physics ---
// =============================================================================

export const GRAVITY_ACCELERATION = 700; // pixels per second per second
export const MAX_FALL_SPEED = 450; // pixels per second - general max fall speed unless overridden
export const MAX_DELTA_TIME = 0.05; // max time step (seconds) to prevent physics glitches (~1/20th second or 20fps min simulation rate)
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // step-up allowance based on entity height, effortless step at +/- 0.33
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2; // max height for slowed step (+/- 0.5)
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.7; // horizontal velocity multiplier after completing a Tier 2 step, retain 70% of horizontal speed
export const WATER_GRAVITY_FACTOR = 0.4; // // water physics - reduced gravity
export const WATER_HORIZONTAL_DAMPING = 0.1; // strong horizontal drag
export const WATER_VERTICAL_DAMPING = 0.05;  // stronger vertical drag
export const WATER_MAX_SPEED_FACTOR = 0.6; // reduce max horizontal speed
export const WATER_ACCELERATION_FACTOR = 0.5; // reduce horizontal acceleration
export const WATER_SWIM_VELOCITY = 120;    // initial upward speed from a swim 'stroke'
export const WATER_MAX_SWIM_UP_SPEED = 80;  // max speed swimming up
export const WATER_MAX_SINK_SPEED = 100;  // max speed falling down in water
export const ENEMY_WATER_BUOYANCY_ACCEL = 180;
export const WATER_JUMP_COOLDOWN_DURATION = 0.2;
export const WATER_PROPAGATION_DELAY = 0.05; // delay between water spreading/falling updates (lower = faster flow)
export const WATER_UPDATES_PER_FRAME = 500; // max number of water cells to process per frame

// =============================================================================
// --- Audio Constants ---
// =============================================================================
export const AUDIO_SFX_POOL_SIZE = 8; // number of simultaneous sound effects allowed
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4; // default volume for game music (TODO: make adjustable)
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;   // default volume for UI music
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;  // default volume for sound effects
export const AUDIO_TRACKS = {
// --- Music ---
    // title: 'assets/audio/title_music.mp3', // TODO: add title music
    pause: 'assets/audio/music/Pause.mp3',
    // gameOver: 'assets/audio/gameover_music.mp3', // TODO: add game over music
    victory: 'assets/audio/music/Victory.mp3',
// ---Sound Effects ---
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
// --- Camera / Viewport ---
// =============================================================================

export const MIN_CAMERA_SCALE = 0.25; // min zoom level (zoom out)
export const MAX_CAMERA_SCALE = 3.0;  // max zoom level (zoom in)
export const ZOOM_SPEED_FACTOR = 0.001; // how fast scrolling zooms

// =============================================================================
// --- Block Parameters ---
// =============================================================================

export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE; // size should be 4, calculation done at top of file
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE;
export const INVENTORY_MATERIALS = ['wood', 'stone', 'metal', 'dirt', 'sand', 'bone']; // be sure to add any new types here
export const BLOCK_AIR = 0; // type IDs
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_GRASS = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD = 6;
export const BLOCK_METAL = 7;
export const BLOCK_BONE = 8; // TODO: glass, specific ores, etc.
export const BLOCK_HP = { // HP map
    [BLOCK_WATER]: Infinity,
    [BLOCK_SAND]: 30,
    [BLOCK_DIRT]: 50,
    [BLOCK_GRASS]: 50,
    [BLOCK_STONE]: 300,
    [BLOCK_WOOD]: 100,
    [BLOCK_METAL]: 500,
    [BLOCK_BONE]: 120, // TODO: add HP for other types later
};
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
export const MATERIAL_TO_BLOCK_TYPE = { // map inventory material strings to block type constants
    'dirt': BLOCK_DIRT,
    'stone': BLOCK_STONE,
    'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND,
    'metal': BLOCK_METAL,
    'bone': BLOCK_BONE, // add other placeable materials here if needed
};
export const BLOCK_DAMAGE_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black
export const BLOCK_DAMAGE_INDICATOR_LINE_WIDTH = 2; // Thickness of the slash/X
export const BLOCK_DAMAGE_THRESHOLD_SLASH = 0.7; // Show slash when HP <= 70%
export const BLOCK_DAMAGE_THRESHOLD_X = 0.3;     // Show X when HP <= 30%
export const GHOST_BLOCK_ALPHA = 0.5; // transparency level of preview block
export const CAN_PLACE_IN_WATER = false; // potential future power enhancement
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)'; // outline colour of player-placed blocks
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 1; // 1 pixel thick

// =============================================================================
// --- Portal Parameters ---
// =============================================================================

export const PORTAL_COLOR = 'rgb(100, 100, 255)'; // blueish
export const PORTAL_WIDTH = Math.floor(8 * BASE_BLOCK_PIXEL_SIZE); // e.g., 32 pixels (8 blocks)
export const PORTAL_HEIGHT = Math.floor(10 * BASE_BLOCK_PIXEL_SIZE); // e.g., 40 pixels (10 blocks)
export const PORTAL_INITIAL_HEALTH = 500;
export const PORTAL_SAFETY_RADIUS = Math.floor(30 * BASE_BLOCK_PIXEL_SIZE); // e.g., 120 pixels radius (30 blocks)
export const PORTAL_RADIUS_GROWTH_PER_WAVE = 25; // increase radius by 25 pixels each intermission
export const PORTAL_SPAWN_Y_OFFSET_BLOCKS = 8; // how many blocks above mean ground level to spawn the top of the portal

// =============================================================================
// --- Player Parameters ---
// =============================================================================

export const PLAYER_COLOR = 'rgb(200, 50, 50)';
export const PLAYER_WIDTH = 3* BLOCK_WIDTH; // 8 pixels
export const PLAYER_HEIGHT = 6 * BLOCK_HEIGHT; // 16 pixels
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2; // spawn Position
export const PLAYER_START_Y = (WORLD_GROUND_LEVEL_MEAN * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT); // slightly above mean ground
export const PLAYER_INITIAL_HEALTH = 100; // health stats
export const PLAYER_MAX_HEALTH_DISPLAY = 100;
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds
export const PLAYER_MOVE_ACCELERATION = 800; // pixels per second per second
export const PLAYER_MAX_SPEED_X = 120; // pixels per second
export const PLAYER_FRICTION_BASE = 0.03; // base friction multiplier (Lower = stronger friction)
export const PLAYER_JUMP_VELOCITY = 200; // pixels per second (Initial upward velocity)
export const PLAYER_INTERACTION_RANGE = 50; // player range for block interaction (digging/placing)
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE;
export const PLAYER_ITEM_ATTRACT_RADIUS = 100; // pixels - how close player needs to be for attraction
export const PLAYER_ITEM_ATTRACT_STRENGTH = 200; // pixels/sec/sec - how strongly items accelerate towards the player
export const PLAYER_ITEM_ATTRACT_SPEED = 250; // NEW: pixels/sec - direct speed when attracted
export const PLAYER_PLACEMENT_COOLDOWN = 0.15; // seconds per block placement

// =============================================================================
// --- Items & Weapons ---
// =============================================================================

export const ITEM_BOBBLE_AMOUNT = 0.15; // how much items bob (relative to height)
export const ITEM_BOBBLE_SPEED = 2.0;   // radians per second for bobbing cycle
export const WEAPON_TYPE_UNARMED = 'unarmed'; // weapons
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear'
export const SHOVEL_WIDTH = 1 * BLOCK_WIDTH; // shovel: 1x2 blocks
export const SHOVEL_HEIGHT = 2 * BLOCK_HEIGHT; // 4 pixels x 8 pixels
export const SHOVEL_COLOR = 'rgb(160, 160, 160)'; // grey
export const PLAYER_SHOVEL_ATTACK_DAMAGE = 5; // very low damage vs enemies
export const PLAYER_SHOVEL_BLOCK_DAMAGE = 25; // high damage vs blocks
export const PLAYER_SHOVEL_ATTACK_REACH_X = PLAYER_WIDTH + SHOVEL_WIDTH * 0.5; // reach from player center approx (player_w/2 + shovel_w/2) + small buffer? Let's try player_w/2 + shovel_w * 1.5
export const PLAYER_SHOVEL_ATTACK_REACH_Y = PLAYER_HEIGHT * 0.4; // reach vertically down from player center? (player_h/2 + shovel_h*0.5)
export const PLAYER_SHOVEL_ATTACK_WIDTH = SHOVEL_WIDTH * 2; // hitbox width (approx 2 blocks wide)
export const PLAYER_SHOVEL_ATTACK_HEIGHT = SHOVEL_HEIGHT * 2; // hitbox height (approx 4 blocks tall)
export const PLAYER_SHOVEL_ATTACK_DURATION = 0.3; // clunky duration
export const PLAYER_SHOVEL_ATTACK_COOLDOWN = 0.4; // clunky cooldown
export const PLAYER_SHOVEL_ATTACK_COLOR = 'rgba(180, 180, 180, 0.5)'; // greyish
export const SWORD_WIDTH = 3 * BLOCK_WIDTH; // sword: 3x1 blocks
export const SWORD_HEIGHT = 1 * BLOCK_HEIGHT; // 12 pixels x 4 pixels
export const SWORD_COLOR = 'rgb(180, 180, 190)';
export const PLAYER_SWORD_ATTACK_COLOR = 'rgba(255, 255, 255, 0.5)';
export const PLAYER_SWORD_ATTACK_DAMAGE = 15; // good baseline damage 
export const PLAYER_SWORD_BLOCK_DAMAGE = 0; // swords don't break blocks
export const PLAYER_SWORD_ATTACK_REACH_X = PLAYER_WIDTH * 0.8; // reach horizontally from player center (swing arc)
export const PLAYER_SWORD_ATTACK_REACH_Y = PLAYER_HEIGHT * 0; // slight downward offset (relative to player center)
export const PLAYER_SWORD_ATTACK_WIDTH = PLAYER_WIDTH * 1.5; // wide hitbox (arc)
export const PLAYER_SWORD_ATTACK_HEIGHT = PLAYER_HEIGHT * 0.9; // tall hitbox (arc)
export const PLAYER_SWORD_ATTACK_DURATION = 0.2; // faster duration
export const PLAYER_SWORD_ATTACK_COOLDOWN = 0.3; // faster cooldown
export const SPEAR_WIDTH = 4 * BLOCK_WIDTH; // spear: 4x1 blocks 
export const SPEAR_HEIGHT = 1 * BLOCK_HEIGHT; // 16 pixels x 4 pixels
export const SPEAR_COLOR = 'rgb(210, 180, 140)'; // wood-like color
export const PLAYER_SPEAR_ATTACK_DAMAGE = 8; // slightly less damage than sword
export const PLAYER_SPEAR_BLOCK_DAMAGE = 0; // spears don't break blocks
export const PLAYER_SPEAR_ATTACK_REACH_X = PLAYER_WIDTH * 1.2; // long reach horizontally from player center
export const PLAYER_SPEAR_ATTACK_REACH_Y = PLAYER_HEIGHT * 0.1; // slight vertical offset
export const PLAYER_SPEAR_ATTACK_WIDTH = SPEAR_WIDTH * 0.3; // narrow hitbox
export const PLAYER_SPEAR_ATTACK_HEIGHT = SPEAR_HEIGHT * 2; // bit taller hitbox than the spear itself? Or keep narrow? Let's try wider
export const PLAYER_SPEAR_ATTACK_DURATION = 0.3; // moderate duration (thrust lingers)
export const PLAYER_SPEAR_ATTACK_COOLDOWN = 0.5; // moderate/slow cooldown (recovery)
export const PLAYER_SPEAR_ATTACK_COLOR = 'rgba(220, 220, 180, 0.5)'; // different color?
export const ITEM_CONFIG = { // centralized item configuration object ---
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

// =============================================================================
// --- Enemy Parameters ---
// =============================================================================

export const MAX_ENEMIES = 100;
export const ENEMY_SPAWN_EDGE_MARGIN = 80; // pixels away from screen edge to attempt spawning
export const ENEMY_FLASH_DURATION = 0.15; // seconds enemy flashes when hit
export const DEFAULT_ENEMY_WIDTH = 2 * BLOCK_WIDTH; // 8 pixels
export const DEFAULT_ENEMY_HEIGHT = 2 * BLOCK_HEIGHT; // 8 pixels
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // how close before pushing (factor of width)
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = 60; // how hard they push (pixels/sec velocity boost)
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker'; // type identifiers
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod'; // add new type constants here: export const ENEMY_TYPE_FLYER = 'flyer';
export const TETRAPOD_WATER_CONTACT_DAMAGE = 1; // tetrapod specific constants: damage when player touches tetrapod in water
export const TETRAPOD_LAND_FLOP_DAMAGE = 1; // damage when player touches tetrapod during a land hop
export const TETRAPOD_LAND_STILL_DAMAGE = 0; // damage when player touches tetrapod on land but not hopping
export const TETRAPOD_FLOP_ATTACK_DURATION = 0.2; // how long the land flop damage window is active (seconds)
export const TETRAPOD_LAND_HOP_COOLDOWN_BASE = 1.5; // base seconds between land hops
export const TETRAPOD_LAND_HOP_COOLDOWN_VARIATION = 1.0; // random variation added to base cooldown
export const TETRAPOD_LAND_HOP_HORIZONTAL_FORCE = 50; // horizontal velocity applied during a flop hop
export const ENEMY_STATS = { // detailed stats - enemy and AI constructors read from this config
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod",
        aiType: 'flopAI',
        color: 'rgb(100, 120, 80)', // muddy greenish-brown
        width: DEFAULT_ENEMY_WIDTH, // 2 blocks
        height: DEFAULT_ENEMY_HEIGHT, // 2 blocks
        health: 1, // very fragile
        contactDamage: 0, // base damage is 0 - logic in enemy.js determines actual damage
        applyGravity: true,
        gravityFactor: 1.0,
        maxSpeedX: 15, // reduced land speed (only applies during hop action timer if AI sets vx)
        maxSpeedY: 50, // esed for vertical movement in air/water by Enemy.js (vertical limit)
        swimSpeed: 70, // max speed specific to swimming (used by AI for targetVx/Vy)
        canJump: true, // enable jumping for land hops
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.25, // set jump strength for flops
        canSwim: true, // good in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2, // slightly more space
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.8, // less pushy
        dropTable: [
                { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 },
            ],
    },
    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker", // for potential UI/debugging
        aiType: 'seekCenter', // key to match an AI Strategy class (to be implemented)
        color: 'rgb(80, 150, 80)', // visual color
        width: DEFAULT_ENEMY_WIDTH, // use default Size (2 blocks)
        height: DEFAULT_ENEMY_HEIGHT, // use default Size (2 blocks)
        maxSpeedX: 40, // movement speed (pixels/sec)
        maxSpeedY: 50, // ensure maxSpeedY has a default for swimming/flying checks
        swimSpeed: 50, // ensure swimSpeed has a default
        health: 1, // starting health points
        contactDamage: 10, // damage dealt on player collision (base damage)
        applyGravity: true, // does gravity affect this enemy?
        gravityFactor: 1.0, // multiplier for gravity (1.0 = normal)
        canJump: true, // can this enemy initiate a jump?
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.5, // meaningful jump strength relative to player
        canSwim: false, // default land creature
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR, // default separation
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [
            { type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 },
        ],
    },
    [ENEMY_TYPE_PLAYER_CHASER]: {
        displayName: "Chaser",
        aiType: 'chasePlayer', // key for AI strategy
        color: 'rgb(150, 80, 80)',
        width: DEFAULT_ENEMY_WIDTH,
        height: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX: 55, // slightly faster
        maxSpeedY: 50, // ensure maxSpeedY has a default
        swimSpeed: 50, // ensure swimSpeed has a default
        health: 2, // slightly tougher
        contactDamage: 10, // base damage
        applyGravity: true,
        gravityFactor: 1.0,
        canJump: true, // chasers can jump over small obstacles
        jumpVelocity: PLAYER_JUMP_VELOCITY * 0.75, // jump strength relative to player
        canSwim: false, // becomes encumbered in water
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [
            { type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 }, // TODO: change to drop bone after trees are implemented
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
        // --- possible future properties ---
        // attackType: 'none', // 'melee', 'ranged', 'aura', 'special'
        // Could have a bite attack:
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

export const WAVE_START_DELAY = 10.0; // seconds before the very first wave starts
export const WARPPHASE_DURATION = 5.0; // fixed duration for the warp/cleanup phase
export const WAVE_ENEMY_SPAWN_DELAY = 0.5; // default delay if not specified in group
export const WAVES = [
    { // === 1 ===
        mainWaveNumber: 1, // for UI references
        duration: 117, // total wave duration in seconds
        intermissionDuration: 15.0, // total duration of intermission *after* this wave
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
    { // === 2 ===
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
    { // === 3 ===
        mainWaveNumber: 3,
        duration: 90,
        intermissionDuration: 25.0, // shorter intermission
        audioTrack: 'assets/audio/music/wave3.mp3', // <-- TODO: add music track here
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
    1: 350, // Wave 1 = 350 Million Years Ago
    2: 300, // Wave 2 = 300 Million Years Ago
    3: 90,  // Wave 3 = 90 Million Years Ago
    // Add mappings for subsequent waves as needed
};
// Duration the epoch text is displayed for each wave start (in seconds)
export const EPOCH_DISPLAY_DURATION = 4.0;

// =============================================================================
// --- Projectile Parameters (Example for Future Use) ---
// =============================================================================
// 
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