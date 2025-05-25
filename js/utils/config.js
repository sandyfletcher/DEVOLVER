// -----------------------------------------------------------------------------
// root/js/config.js - Centralized Game Configuration
// -----------------------------------------------------------------------------

// --- Cutscene Parameters ---

export const CUTSCENE_IMAGE_DURATION = 3.0; // seconds image displayed
export const CUTSCENE_SLIDES = [
    { imagePath: 'assets/cut1.png', text: "In the near future, dolphins master nuclear fusion and seize control of the planet." },
    { imagePath: 'assets/cut2.jpg', text: "As an elite triple-agent SEAL team 7 operative, you inflitrated their lab compound and harnessed their technology to send yourself back in time." },
    { imagePath: 'assets/cut3.png', text: "Use your military and ballet training, along with knowledge of modern technology, to defeat any threats to humanity that attempt to breach your position." },
    { imagePath: 'assets/cut4.png', text: "Only one thing has followed you back in time - a simple shovel. Will that be enough?" }
];

// --- Camera / Viewport ---

export const MIN_CAMERA_SCALE = 0.25; // min zoom level (zoomed out to 1/4 size)
export const MAX_CAMERA_SCALE = 3.0; // max zoom level (zoomed in 3x)
export const ZOOM_SPEED_FACTOR = 0.001; // sensitivity of mouse wheel
// PLAYER_INTERACTION_RANGE_MIN_VISUAL_CLAMP is no longer directly used for weapon drawing

// --- Game Grid ---

export const BACKGROUND_COLOR = 'rgb(135, 206, 235)'; // TODO: develop background images with moving parts
export const BASE_BLOCK_PIXEL_SIZE = 16; // size in pixels of one side of square block
export const BLOCK_WIDTH = BASE_BLOCK_PIXEL_SIZE;
export const BLOCK_HEIGHT = BASE_BLOCK_PIXEL_SIZE;
export const GRID_COLS = 400; // # of columns in world grid
export const GRID_ROWS = 200; // # of rows
export const CANVAS_WIDTH = GRID_COLS * BLOCK_WIDTH; // internal canvas dimensions in pixels
export const CANVAS_HEIGHT = GRID_ROWS * BLOCK_HEIGHT;

// --- Block Parameters ---

export const BLOCK_DAMAGE_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.9)';
export const BLOCK_DAMAGE_INDICATOR_LINE_WIDTH = 2;
export const BLOCK_DAMAGE_THRESHOLD_SLASH = 0.7; // show / when HP <= 70%
export const BLOCK_DAMAGE_THRESHOLD_X = 0.3; // show X when HP <= 30%
export const GHOST_BLOCK_ALPHA = 0.5; // placement preview transparency
export const PLAYER_BLOCK_OUTLINE_COLOR = 'rgba(255, 255, 255, 0.8)';
export const PLAYER_BLOCK_OUTLINE_THICKNESS = 3; // in pixels
export const VEGETATION_PIXEL_DENSITY = 0.6;
export const BLOCK_AIR = 0;
export const BLOCK_WATER = 1;
export const BLOCK_SAND = 2;
export const BLOCK_DIRT = 3;
export const BLOCK_VEGETATION = 4;
export const BLOCK_STONE = 5;
export const BLOCK_WOOD = 6;
export const BLOCK_METAL = 7;
export const BLOCK_BONE = 8;
export const BLOCK_ROPE = 9;
export const BLOCK_PROPERTIES = {
    [BLOCK_AIR]: {
        name: 'AIR',
        hp: Infinity,
        color: null,
        translucency: 1.0,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: null,
        droppedItemConfig: null,
        isPlayerPlaceableAsMaterial: false,
    },
    [BLOCK_WATER]: {
        name: 'WATER',
        hp: Infinity,
        color: 'rgb(38, 77, 154)',
        translucency: 0.9,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: null,
        droppedItemConfig: null,
        isPlayerPlaceableAsMaterial: false,
    },
    [BLOCK_SAND]: {
        name: 'SAND',
        hp: 30,
        color: 'rgb(210, 180, 140)',
        translucency: 0.1,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'sand',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(210, 180, 140)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_DIRT]: {
        name: 'DIRT',
        hp: 50,
        color: 'rgb(130, 82, 45)',
        translucency: 0.1,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'dirt',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(130, 82, 45)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_VEGETATION]: {
        name: 'VEGETATION',
        hp: 25,
        color: 'rgb(80, 180, 80)',
        translucency: 0.5,
        isSolidForPhysics: false, // Vegetation is not solid for physics
        isSolidForPlacementSupport: false, // Vegetation does not support other blocks
        isRope: false,
        isVegetation: true,
        isWood: false,
        droppedItemType: 'vegetation',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(80, 180, 80)' },
        isPlayerPlaceableAsMaterial: true, // Player can place vegetation blocks if they have the material
    },
    [BLOCK_STONE]: {
        name: 'STONE',
        hp: 300,
        color: 'rgb(140, 140, 140)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'stone',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(140, 140, 140)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_WOOD]: {
        name: 'WOOD',
        hp: 100,
        color: 'rgb(160, 110, 70)',
        translucency: 0.0,
        isSolidForPhysicsConfig: { base: true, naturalOverride: false }, // Player-placed wood is solid, natural wood is not
        isSolidForPlacementSupport: true, // All wood can support other blocks
        isRope: false,
        isVegetation: false,
        isWood: true,
        droppedItemType: 'wood',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(160, 110, 70)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_METAL]: {
        name: 'METAL',
        hp: 500,
        color: 'rgb(190, 190, 200)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'metal',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(190, 190, 200)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_BONE]: {
        name: 'BONE',
        hp: 120,
        color: 'rgb(200, 190, 170)',
        translucency: 0.0,
        isSolidForPhysics: true,
        isSolidForPlacementSupport: true,
        isRope: false,
        isVegetation: false,
        isWood: false,
        droppedItemType: 'bone',
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(200, 190, 170)' },
        isPlayerPlaceableAsMaterial: true,
    },
    [BLOCK_ROPE]: {
        name: 'ROPE',
        hp: 25,
        color: 'rgb(80, 180, 80)', // Visually similar to vegetation
        translucency: 0.9,
        isSolidForPhysics: false,
        isSolidForPlacementSupport: false,
        isRope: true,
        isVegetation: false, // Not vegetation itself, though placed using vegetation material
        isWood: false,
        droppedItemType: 'vegetation', // Drops vegetation material when destroyed
        droppedItemConfig: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, color: 'rgb(80, 180, 80)' }, // Dropped item looks like vegetation
        isPlayerPlaceableAsMaterial: false, // Player uses 'vegetation' material to place ropes
    },
};
export const AGING_MATERIAL_CONVERSION_FACTORS = {
    [BLOCK_DIRT]: 1.0,
    [BLOCK_VEGETATION]: 1.0,
    [BLOCK_STONE]: 1.0,
    [BLOCK_BONE]: 1.0,
    [BLOCK_WOOD]: 1.0,
    [BLOCK_METAL]: 1.0,
};
export const INVENTORY_MATERIALS = [ 'dirt', 'vegetation', 'sand', 'stone', 'wood', 'bone', 'metal'];
export const MATERIAL_TO_BLOCK_TYPE = {
    'dirt': BLOCK_DIRT,
    'stone': BLOCK_STONE,
    'wood': BLOCK_WOOD,
    'sand': BLOCK_SAND,
    'metal': BLOCK_METAL,
    'bone': BLOCK_BONE,
    'vegetation': BLOCK_VEGETATION, // Note: Placing 'vegetation' material could result in either VEGETATION block or ROPE block based on context
};

// --- Landmass Generation ---

export const ISLAND_WIDTH_MIN = 0.75; // minimum width of island
export const ISLAND_WIDTH_MAX = 0.85; // as percentage of GRID_COLS
export const WATER_LEVEL_FRACTION = 0.25; // % of bottom GRID_ROWS water covers
export const WATER_LEVEL = Math.floor(GRID_ROWS * (1.0 - WATER_LEVEL_FRACTION)); // calculate target row for water surface
export const MEAN_GROUND_LEVEL = WATER_LEVEL - Math.floor(GRID_ROWS * 0.20); // mean row for ground surface
export const AVERAGE_SUBSURFACE_LANDMASS_THICKNESS = (GRID_ROWS - 1) - MEAN_GROUND_LEVEL;
export const DIRT_LAYER_THICKNESS_FACTOR = 0.7;
export const STONE_DEPTH_BELOW_GROUND = Math.max(3, Math.round(DIRT_LAYER_THICKNESS_FACTOR * AVERAGE_SUBSURFACE_LANDMASS_THICKNESS)); // # of rows deep stone starts below average ground level
export const MEAN_STONE_LEVEL = MEAN_GROUND_LEVEL + STONE_DEPTH_BELOW_GROUND; // mean row for top of stone layer
export const WORLD_GROUND_VARIATION = 4; // Variation in rows for ground level noise
export const WORLD_STONE_VARIATION = 2; // Variation in rows for stone level noise
export const WORLD_NOISE_SCALE = 0.03; // Scale factor for Perlin noise used in terrain generation
export const GROUND_NOISE_OCTAVES = 4; // Number of octaves for ground surface noise
export const GROUND_NOISE_PERSISTENCE = 0.5; // Amplitude multiplier for each subsequent octave
export const GROUND_NOISE_LACUNARITY = 2.0; // Frequency multiplier for each subsequent octave
export const STONE_NOISE_OCTAVES = 3; // Number of octaves for stone layer noise
export const STONE_NOISE_PERSISTENCE = 0.45;
export const STONE_NOISE_LACUNARITY = 2.2;

// --- Cave Formation ---

export const ENABLE_CAVES = true;
export const CAVE_NOISE_SCALE_X = 0.08; // Scale for 2D Perlin noise for caves (adjust for smaller/larger caves)
export const CAVE_NOISE_SCALE_Y = 0.07; // Can be different for X and Y to stretch caves
export const CAVE_THRESHOLD = 0.5; // Noise values above this threshold become air (range typically [-1,1] or [0,1] - adjust based on noise2D output) - If noise2D outputs roughly [-1,1], a threshold of 0.6 means ~20% of area could be caves.
export const CAVE_MIN_ROWS_BELOW_SURFACE = 0; // Caves start at least this many rows below the generated surface
export const CAVE_MIN_ROWS_ABOVE_BOTTOM = 15; // Caves stop at least this many rows above the grid bottom
export const CAVE_EDGE_ZONE_PERCENTAGE = 0.20; // Percentage of map width for edge zones (0.0 to 0.5)
export const CAVE_EDGE_WATER_PROTECTION_DEPTH = 3; // How many blocks above/below water level to protect in edge zones

// --- Beach Smoothing ---

export const OCEAN_FLOOR_ROW_NEAR_ISLAND = WATER_LEVEL + 5; // Target row for ocean floor near the island
export const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8; // Target row for ocean stone near the island
export const DEEP_OCEAN_BASE_ROW_OFFSET = Math.floor(GRID_ROWS * 0.1); // Offset in rows for deep ocean from water level
export const DEEP_OCEAN_MAX_ROW = GRID_ROWS - 3; // Maximum row depth for the deep ocean floor
export const DEEP_OCEAN_FLOOR_START_ROW = Math.min(DEEP_OCEAN_MAX_ROW, WATER_LEVEL + DEEP_OCEAN_BASE_ROW_OFFSET); // Starting row for deep ocean floor
export const DEEP_OCEAN_STONE_START_ROW = DEEP_OCEAN_FLOOR_START_ROW + 8; // Starting row for deep ocean stone
export const EDGE_TAPER_WIDTH_FACTOR = 0.15; // Percentage of GRID_COLS for edge tapering
export const EDGE_STONE_LEVEL_TARGET_ROW_OFFSET = 15; // Target stone level offset (in rows) at the absolute world edge
export const EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET = 20; // Target floor level offset (in rows) at the absolute world edge
export const ISLAND_CENTER_TAPER_WIDTH_COLS = 80; // Width in columns for tapering from island edge inward

// --- Tree Parameters ---

export const MIN_TREE_SPACING_RADIUS = 8; // minimum block distance between tree trunk formation
export const TREE_MIN_HEIGHT_TO_FORM_ORGANIC = 4; // trunk height for canopy formation
export const MAX_NATURAL_TRUNK_HEIGHT_BEFORE_COLLAPSE = 10;
export const TREE_INITIAL_CANOPY_RADIUS = 2; // block radius of initial canopy vegetation
export const TREE_MAX_CANOPY_RADIUS = 4; // max radius canopy can reach

// --- Aging Rules ---

export const AGING_STONEIFICATION_DEPTH_THRESHOLD = Math.floor(GRID_ROWS * 0.45) * BLOCK_HEIGHT; // threshold for stoneification
export const AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH = 4; // max contiguous water blocks influencing probabilities
export const AGING_INITIAL_PASSES = 10; // aging passes on initial world generation
export const AGING_PROB_WATER_EROSION_SAND = 0.0001; // probability per eligible block per pass
export const AGING_PROB_AIR_EROSION_SAND = 0.0001;
export const AGING_PROB_WATER_EROSION_DIRT_VEGETATION = 0.9;
export const AGING_PROB_STONEIFICATION_DEEP = 0.000001;
export const AGING_PROB_HORIZONTAL_SAND_SPREAD = 0.85;
export const AGING_PROB_EROSION_SURFACE_STONE = 0.00001;
export const AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER = 0.9;
export const AGING_PROB_SAND_SEDIMENTATION_BELOW = 0.9;
export const AGING_PROB_AIR_GROWS_VEGETATION_ON_LIT_DIRT = 0.60;
export const AGING_PROB_AIR_GROWS_VEGETATION_ON_LIT_VEGETATION = 0.50;
export const AGING_PROB_UNLIT_VEGETATION_DECAY = 0.9;
export const AGING_PROB_VEGETATION_TO_WOOD_SURROUNDED = 0.7; // chance for vegetation chunk to become tree
export const AGING_PROB_WOOD_GROWS_WOOD_UP = 0.3;
export const AGING_PROB_TREE_CANOPY_GROW = 0.1;
export const AGING_PROB_TREE_CANOPY_DECAY = 0.01;
export const AGING_PROB_TREE_TRUNK_DECAY = 0.001;

// --- Animation Constants ---

export const MAX_FALLING_BLOCKS_AT_ONCE = 10000;
export const NEW_GRAVITY_ANIM_DELAY = 0.00001;
export const GRAVITY_ANIMATION_FALL_SPEED = 1000;
export const AGING_ANIMATION_BLOCKS_AT_ONCE = 10000; // number of simultaneous animations
export const AGING_ANIMATION_NEW_BLOCK_DELAY = 0.00001; // seconds before starting next animation in queue
export const AGING_ANIMATION_SWELL_DURATION = 0.005;
export const AGING_ANIMATION_POP_DURATION = 0.005;
export const AGING_ANIMATION_SWELL_SCALE = 1.5;
export const AGING_ANIMATION_OLD_BLOCK_COLOR = 'rgba(200, 200, 200, 0.7)'; // swell old block
export const AGING_ANIMATION_NEW_BLOCK_COLOR = 'rgba(255, 255, 150, 0.8)'; // briefly flash new block
export const WARPPHASE_DURATION = 8.0; // duration of warp phase
export const ENEMY_DEATH_ANIMATION_DURATION = 0.5; // enemy death animation time in seconds
export const ENEMY_SWELL_DURATION = 0.3;
export const ENEMY_SWELL_SCALE = 1.5;
export const PLAYER_DEATH_ANIMATION_DURATION = 1.5;
export const PLAYER_SPIN_DURATION = 1.0;
export const PLAYER_SPIN_FRAMES = 6;

// --- Lighting Parameters ---

export const MIN_LIGHT_LEVEL_COLOR_FACTOR = 0.7; // 70% of base colour
export const MAX_LIGHT_LEVEL_BRIGHTNESS_FACTOR = 1.3; // 130% of base colour
export const INITIAL_LIGHT_RAY_POWER = 1.0; // starting power of a light ray
export const MIN_LIGHT_THRESHOLD = 0.01; // ray stops if power drops below this
export const SUN_ANIMATION_ENABLED = true; // toggle animation
export const SUN_ANIMATION_COLOR = "rgba(255, 200, 100, 0.9)";
export const SUN_ANIMATION_OUTLINE_COLOR = "rgba(255, 255, 0, 0.7)";
export const SUN_ANIMATION_OUTLINE_WIDTH = 5;
export const SUN_ANIMATION_OUTLINE_BLUR = 15; // blur radius for outline glow
export const SUN_ANIMATION_RADIUS_BLOCKS = 6; // radius of sun
export const SUN_ANIMATION_RAY_COLOR_INNER = "rgba(255, 255, 180, 0.35)";
export const SUN_ANIMATION_RAY_COLOR_OUTER = "rgba(255, 220, 150, 0.15)";
export const SUN_ANIMATION_RAY_LINE_WIDTH = 2;
export const SUN_ANIMATION_RAY_OUTER_WIDTH_FACTOR = 2.0;
export const SUN_ANIMATION_START_X_OFFSET_BLOCKS = 10;
export const SUN_ANIMATION_END_X_OFFSET_BLOCKS = 10;
export const FIXED_SUN_ANIMATION_DURATION = 8.0;
export const SUN_MOVEMENT_Y_ROW_OFFSET = 20;
export const SUN_MOVEMENT_STEP_COLUMNS = 2;
export const MAX_LIGHT_RAY_LENGTH_BLOCKS = Math.floor(GRID_ROWS * 1.2);
export const SUN_RAYS_PER_POSITION = 72;

// --- Delta-Time Physics ---

export const GRAVITY_ACCELERATION = 100 * BLOCK_HEIGHT; // Pixels per second squared.
export const MAX_FALL_SPEED = 120 * BLOCK_HEIGHT; // Pixels per second.
export const MAX_DELTA_TIME = 0.05; // Max time step in seconds to prevent physics glitches (~20fps min simulation).
export const ENTITY_STEP_TIER1_MAX_HEIGHT_FACTOR = 1/3; // Entity step-up allowance, defined as factors of entity height (already relative to scaled entity).
export const ENTITY_STEP_TIER2_MAX_HEIGHT_FACTOR = 1/2;
export const ENTITY_STEP_TIER2_HORIZONTAL_FRICTION = 0.7; // Factor to multiply horizontal velocity by after a tier 2 step.
export const WATER_GRAVITY_FACTOR = 0.4; // Water physics factors (unitless multipliers).
export const WATER_HORIZONTAL_DAMPING = 0.1; // Lower values mean stronger damping.
export const WATER_VERTICAL_DAMPING = 0.05;
export const WATER_MAX_SPEED_FACTOR = 0.6;
export const WATER_ACCELERATION_FACTOR = 0.5;
export const WATER_SWIM_VELOCITY = 50 * BLOCK_HEIGHT; // Pixels per second.
export const WATER_MAX_SWIM_UP_SPEED = 20 * BLOCK_HEIGHT; // Pixels per second.
export const WATER_MAX_SINK_SPEED = 25 * BLOCK_HEIGHT; // Pixels per second.
export const ENEMY_WATER_BUOYANCY_ACCEL = 45 * BLOCK_HEIGHT; // Pixels/sec^2.
export const WATER_JUMP_COOLDOWN_DURATION = 0.2;
export const WATER_PROPAGATION_DELAY = 0.05;
export const WATER_UPDATES_PER_FRAME = 10;

// --- Portal Parameters ---

export const PORTAL_COLOR = 'rgb(100, 100, 255)';
export const PORTAL_BORDER_COLOR = 'silver';
export const PORTAL_BORDER_WIDTH = 10; // Pixel width of the border
export const PORTAL_WIDTH = 6 * BLOCK_WIDTH; // Pixel width.
export const PORTAL_HEIGHT = 8 * BLOCK_HEIGHT; // Pixel height.
export const PORTAL_INITIAL_HEALTH = 500;
export const PORTAL_ABSORB_ANIMATION_DURATION = 0.75; // seconds
export const PORTAL_SAFETY_RADIUS = 30 * BASE_BLOCK_PIXEL_SIZE; // Pixel radius.
export const PORTAL_RADIUS_GROWTH_PER_WAVE = 5 * BASE_BLOCK_PIXEL_SIZE; // Pixel growth.
export const PORTAL_SPAWN_Y_OFFSET_BLOCKS = 8; // Offset in block units above mean ground for portal top.

// --- Player Parameters ---

// export const PLAYER_IMAGE_PATH = 'assets/player.png'; // Will be removed
// export const PLAYER_HITBOX_COLOR = 'rgba(200, 50, 50, 0.3)'; // Will be removed
export const PLAYER_BODY_COLOR = 'rgb(200, 50, 50)'; // Solid color for player's body
export const PLAYER_WIDTH = 3 * BLOCK_WIDTH;
export const PLAYER_HEIGHT = 6 * BLOCK_HEIGHT;
export const PLAYER_SHOULDER_OFFSET_X_FACTOR = 0.25; // How far from the player's edge
export const PLAYER_SHOULDER_OFFSET_Y_FACTOR = 0.25; // How far down from the player's top
export const ARM_COLOR = 'rgb(180, 100, 50)'; // Color for the player's arms
export const ARM_THICKNESS = 6; // Thickness of the arm rectangles in pixels
export const PLAYER_START_X = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2; // Player start position (pixels, derived from block-based world constants).
export const PLAYER_START_Y = (MEAN_GROUND_LEVEL * BLOCK_HEIGHT) - PLAYER_HEIGHT - (5 * BLOCK_HEIGHT);
export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_MAX_HEALTH_DISPLAY = 100;
export const PLAYER_INVULNERABILITY_DURATION = 1.5; // seconds
export const PLAYER_MOVE_ACCELERATION = 200 * BLOCK_WIDTH; // Pixels/sec^2.
export const PLAYER_MAX_SPEED_X = 30 * BLOCK_WIDTH; // Base max horizontal speed
export const PLAYER_FRICTION_BASE = 0.01; // Factor for ground friction (lower means stronger friction).
export const PLAYER_JUMP_VELOCITY = 50 * BLOCK_HEIGHT; // base initial upward velocity
export const PLAYER_INTERACTION_RANGE = 12 * BLOCK_WIDTH; // Pixel range.
export const PLAYER_INTERACTION_RANGE_SQ = PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE; // Squared pixel range.
export const PLAYER_ITEM_ATTRACT_RADIUS = 25 * BLOCK_WIDTH; // Item attraction distance in block units.
export const PLAYER_ITEM_ATTRACT_RADIUS_SQ = PLAYER_ITEM_ATTRACT_RADIUS * PLAYER_ITEM_ATTRACT_RADIUS; // Squared pixel radius.
export const PLAYER_ITEM_ATTRACT_SPEED = 60 * BLOCK_WIDTH; // Base speed for attracted items
export const PLAYER_PLACEMENT_COOLDOWN = 0.01; // seconds between block placement
export const PLAYER_ROPE_CLIMB_SPEED = 30 * BLOCK_HEIGHT;
export const PLAYER_ROPE_SLIDE_SPEED = 45 * BLOCK_HEIGHT;
export const PLAYER_ROPE_HORIZONTAL_DAMPING = 0.001; // very strong damping while on rope
export const PLAYER_ROPE_DETACH_IMPULSE_X = 20 * BLOCK_WIDTH;
export const PLAYER_ROPE_DETACH_JUMP_MULTIPLIER = 0.9; // 90% of normal jump velocity
export const PLAYER_PLACEMENT_RANGE_COLOR = 'rgba(255, 255, 0, 0.3)'; // semi-transparent yellow
export const PLAYER_PLACEMENT_RANGE_LINE_WIDTH = 2; // line thickness in pixels

// --- Audio Constants ---

export const AUDIO_SFX_POOL_SIZE = 8;
export const AUDIO_DEFAULT_GAME_VOLUME = 0.4;
export const AUDIO_DEFAULT_UI_VOLUME = 0.6;
export const AUDIO_DEFAULT_SFX_VOLUME = 0.8;
export const AUDIO_TRACKS = {
MENU: 'assets/audio/music/Menu.mp3',
pause: 'assets/audio/music/Pause.mp3',
gameOver: 'assets/audio/music/GameOver.mp3',
victory: 'assets/audio/music/Victory.mp3',
CUTSCENE: 'assets/audio/music/Cutscene.mp3',
wave1: 'assets/audio/music/Wave1-350.mp3',
wave2: 'assets/audio/music/Wave2-300.mp3',
wave3: 'assets/audio/music/wave3.mp3',
// SFX placeholders
// player_hit: 'assets/audio/sfx/player_hit.wav',
};

// --- Items & Weapons ---

export const ITEM_BOBBLE_AMOUNT = 0.15; // factor relative to item height
export const ITEM_BOBBLE_SPEED = 2.0; // radians per second for bobbing cycle
export const WEAPON_TYPE_UNARMED = 'unarmed';
export const WEAPON_TYPE_SHOVEL = 'shovel';
export const WEAPON_TYPE_SWORD = 'sword';
export const WEAPON_TYPE_SPEAR = 'spear';
export const WEAPON_STATS = {
    [WEAPON_TYPE_UNARMED]: {
        displayName: "Unarmed",
        symbol: "👊",
        width: 1 * BLOCK_WIDTH,
        height: 1 * BLOCK_HEIGHT,
        attackDamage: 1,
        blockDamage: 0,
        attackReachX: PLAYER_WIDTH * 0.2,
        attackReachY: 0,
        attackWidth: PLAYER_WIDTH * 0.5,
        attackHeight: PLAYER_HEIGHT * 0.5,
        attackDuration: 0.1,
        attackCooldown: 0.2,
        attackColor: 'rgba(255, 255, 255, 0.2)',
        visualAnchorOffset: { x: 0, y: 0 },
        shape: [{ type: 'rect', x: -0.5 * BLOCK_WIDTH, y: -0.5 * BLOCK_HEIGHT, w: 1 * BLOCK_WIDTH, h: 1 * BLOCK_HEIGHT, color: 'transparent' }],
        knockbackStrength: 50,
        knockbackStunDuration: 0.1,
        jabDistanceBlocks: 0, // Unarmed doesn't jab
    },
    [WEAPON_TYPE_SHOVEL]: {
        displayName: "Shovel",
        symbol: "⛏️",
        width: 5 * BLOCK_WIDTH,
        height: 2 * BLOCK_HEIGHT,
        outlineColor: 'rgb(75, 75, 75)',
        outlineWidth: 2,
        attackDamage: 5,
        blockDamage: 25,
        attackReachX: 3 * BLOCK_WIDTH,
        attackReachY: PLAYER_HEIGHT * 0.4,
        attackWidth: (1 * BLOCK_WIDTH) * 2,
        attackHeight: (2 * BLOCK_HEIGHT) * 2,
        attackDuration: 0.3,
        attackCooldown: 0.4,
        attackColor: 'rgba(180, 180, 180, 0.5)',
        recipe: [],
        visualAnchorOffset: { x: 1.5 * BLOCK_WIDTH, y: 0 }, // Anchor at the tip of the shovel head
        handPositions: {
            back: { x: -2.0 * BLOCK_WIDTH, y: 0 },
            front: { x: -0.5 * BLOCK_WIDTH, y: 0 }
        },
        shape: [
            { type: 'rect', x: -2.5 * BLOCK_WIDTH, y: -0.25 * BLOCK_HEIGHT, w: 2.5 * BLOCK_WIDTH, h: 0.5 * BLOCK_HEIGHT, color: 'rgb(139, 69, 19)'}, // Handle
            { type: 'triangle', p1: { x: 0, y: -0.75 * BLOCK_WIDTH }, p2: { x: 0, y: 0.75 * BLOCK_WIDTH }, p3: { x: 1.5 * BLOCK_WIDTH, y: 0 }, color: 'rgb(128, 128, 128)', isBlade: true} // Shovel head
        ],
        knockbackStrength: 150,
        knockbackStunDuration: 0.2,
        jabDistanceBlocks: 0.75,
    },
    [WEAPON_TYPE_SWORD]: {
        displayName: "Sword",
        symbol: "⚔️",
        width: 3.5 * BLOCK_WIDTH, // Adjusted for new shape
        height: 1 * BLOCK_HEIGHT,
        outlineColor: 'rgb(100, 100, 110)',
        outlineWidth: 1, // Thinner outline for a sharper look
        attackDamage: 15, blockDamage: 0,
        attackReachX: PLAYER_WIDTH * 0.8, attackReachY: 0, // Base reach for aiming
        attackWidth: PLAYER_WIDTH * 1.5, attackHeight: PLAYER_HEIGHT * 0.9, // AABB for rough checks, true hitbox is swipe
        attackDuration: 0.25, // Slightly longer for a swipe
        attackCooldown: 0.35,
        attackColor: 'rgba(200, 200, 220, 0.4)', // Lighter color for swipe
        recipe: [ { type: 'stone', amount: 5 } ],
        visualAnchorOffset: {x: -0.5 * BLOCK_WIDTH, y: 0 }, // Pivot near the hilt
        shape: [
            // Blade
            { type: 'rect', x: 0, y: -0.15 * BLOCK_HEIGHT, w: 2.5 * BLOCK_WIDTH, h: 0.3 * BLOCK_HEIGHT, color: 'rgb(180, 180, 190)', isBlade: true},
            // Hilt / Crossguard
            { type: 'rect', x: -0.25 * BLOCK_WIDTH, y: -0.4 * BLOCK_HEIGHT, w: 0.25 * BLOCK_WIDTH, h: 0.8 * BLOCK_HEIGHT, color: 'rgb(100,70,50)'},
            { type: 'rect', x: -0.75 * BLOCK_WIDTH, y: -0.1 * BLOCK_HEIGHT, w: 0.5 * BLOCK_WIDTH, h: 0.2 * BLOCK_HEIGHT, color: 'rgb(139,69,19)'}
        ],
        swipeArcDegrees: 120, // Total arc of the swipe
        swipeStartOffsetDegrees: -60, // Starts -60deg from aim, ends +60deg from aim
        knockbackStrength: 200,
        knockbackStunDuration: 0.25,
        jabDistanceBlocks: 0, // Sword uses swipe, not jab
    },
    [WEAPON_TYPE_SPEAR]: {
        displayName: "Spear",
        symbol: "↑",
        width: 6 * BLOCK_WIDTH,
        height: 1 * BLOCK_HEIGHT,
        outlineColor: 'rgb(100, 80, 50)',
        outlineWidth: 1,
        attackDamage: 8,
        blockDamage: 0, // Spear doesn't damage blocks
        attackReachX: 5 * BLOCK_WIDTH, // For aiming
        attackReachY: undefined,
        attackWidth: BLOCK_WIDTH * 0.5, // Approx AABB
        attackHeight: BLOCK_HEIGHT * 1.5, // Approx AABB
        attackDuration: 0.3,
        attackCooldown: 0.5,
        attackColor: 'rgba(220, 220, 180, 0.5)',
        recipe: [ { type: 'wood', amount: 2 }, { type: 'stone', amount: 1 } ],
        visualAnchorOffset: { x: 0.75 * BLOCK_WIDTH, y: 0 }, // Anchor at the spear tip
        handPositions: {
            back: { x: -4.0 * BLOCK_WIDTH, y: 0 },
            front: { x: -1.5 * BLOCK_WIDTH, y: 0 }
        },
        shape: [
            { type: 'rect', x: -4.75 * BLOCK_WIDTH, y: -0.20 * BLOCK_HEIGHT, w: 4.75 * BLOCK_WIDTH, h: 0.40 * BLOCK_HEIGHT, color: 'rgb(180, 130, 90)'}, // Shaft
            { type: 'triangle', p1: { x: 0, y: -0.25 * BLOCK_HEIGHT }, p2: { x: 0, y: 0.25 * BLOCK_HEIGHT }, p3: { x: 0.75 * BLOCK_WIDTH, y: 0 }, color: 'rgb(160, 160, 170)', isBlade: true} // Spearhead
        ],
        knockbackStrength: 250,
        knockbackStunDuration: 0.3,
        jabDistanceBlocks: 1.0,
    }
};

// --- Enemy Parameters ---

export const MAX_ENEMIES = 150; // TODO: determine if necessary or if being restrictive for future spawning logic
export const ENEMY_SPAWN_EDGE_MARGIN = 10 * BLOCK_WIDTH; // Distance from screen edge in block units
export const ENEMY_FLASH_DURATION = 0.15;
export const DEFAULT_ENEMY_WIDTH = 2;
export const DEFAULT_ENEMY_HEIGHT = 2;
export const DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR = 0.9; // Factor of enemy's own width.
export const DEFAULT_ENEMY_SEPARATION_STRENGTH = 15 * BLOCK_WIDTH; // Base push strength
export const ENEMY_TYPE_DUNKLEOSTEUS = 'dunkleosteus';
export const ENEMY_TYPE_CENTER_SEEKER = 'center_seeker';
export const ENEMY_TYPE_PLAYER_CHASER = 'player_chaser';
export const ENEMY_TYPE_TETRAPOD = 'tetrapod';
export const ENEMY_TYPE_SMALL_FISH = 'small_fish';
export const TETRAPOD_WATER_CONTACT_DAMAGE = 1;
export const TETRAPOD_LAND_FLOP_DAMAGE = 1;
export const TETRAPOD_LAND_STILL_DAMAGE = 0;
export const TETRAPOD_FLOP_ATTACK_DURATION = 0.2;
export const TETRAPOD_LAND_HOP_COOLDOWN_BASE = 1.5;
export const TETRAPOD_LAND_HOP_COOLDOWN_VARIATION = 1.0;
export const ENEMY_STATS = {
    [ENEMY_TYPE_TETRAPOD]: {
        displayName: "Tetrapod", aiType: 'flopAI', color: 'rgb(100, 120, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH,
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT,
        health: 1, contactDamage: 0, applyGravity: true, gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 3.75,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 17.5,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 12.5,
        canSwim: true, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.2,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.8,
        landHopHorizontalVelocity_BLOCKS_PER_SEC: 12.5,
        dropTable: [{ type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }],
    },
    [ENEMY_TYPE_CENTER_SEEKER]: {
        displayName: "Seeker", aiType: 'seekCenter', color: 'rgb(80, 150, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH,
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX_BLOCKS_PER_SEC: 10,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 12.5,
        health: 1, contactDamage: 10, applyGravity: true, gravityFactor: 1.0,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 25,
        canSwim: false, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [{ type: 'bone', chance: 1.0, minAmount: 1, maxAmount: 1 }],
    },
    [ENEMY_TYPE_PLAYER_CHASER]: {
        displayName: "Chaser", aiType: 'chasePlayer', color: 'rgb(150, 80, 80)',
        width_BLOCKS: DEFAULT_ENEMY_WIDTH,
        height_BLOCKS: DEFAULT_ENEMY_HEIGHT,
        maxSpeedX_BLOCKS_PER_SEC: 13.75,
        maxSpeedY_BLOCKS_PER_SEC: 12.5,
        swimSpeed_BLOCKS_PER_SEC: 12.5,
        health: 100, contactDamage: 10, applyGravity: true, gravityFactor: 1.0,
        canJump: true,
        jumpVelocity_BLOCKS_PER_SEC: 37.5,
        canSwim: false, canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH,
        dropTable: [{ type: 'wood', chance: 1.0, minAmount: 1, maxAmount: 1 }],
    },
    [ENEMY_TYPE_DUNKLEOSTEUS]: {
        displayName: "Dunkleosteus",
        aiType: 'dunkleosteusAI',
        color: 'rgb(80, 100, 120)',
        width_BLOCKS: 4,
        height_BLOCKS: 2,
        health: 3,
        contactDamage: 15,
        applyGravity: true,
        gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 6.5,
        maxSpeedY_BLOCKS_PER_SEC: 0,
        swimSpeed_BLOCKS_PER_SEC: 15,
        canJump: false,
        jumpVelocity_BLOCKS_PER_SEC: 0,
        canSwim: true,
        canFly: false,
        separationFactor: DEFAULT_ENEMY_SEPARATION_RADIUS_FACTOR * 1.5,
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH * 1.2,
        landHopHorizontalVelocity_BLOCKS_PER_SEC: 0,
        dropTable: [{ type: 'bone', chance: 0.7, minAmount: 2, maxAmount: 3 }, { type: 'metal', chance: 0.2, minAmount: 1, maxAmount: 1 }],
        outOfWaterDamagePerSecond: 15, // damage per second when out of water
    },
    [ENEMY_TYPE_SMALL_FISH]: {
        displayName: "Fish",
        aiType: 'fishAI', 
        color: 'rgb(120, 180, 220)', 
        width_BLOCKS: 1.5,
        height_BLOCKS: 0.75,
        health: 1,
        contactDamage: 0,
        applyGravity: true,
        gravityFactor: 1.0,
        maxSpeedX_BLOCKS_PER_SEC: 5,  
        maxSpeedY_BLOCKS_PER_SEC: 3,  
        swimSpeed_BLOCKS_PER_SEC: 7,  
        canJump: false,
        jumpVelocity_BLOCKS_PER_SEC: 0,
        canSwim: true,
        canFly: false,
        separationFactor: 0.5, 
        separationStrength_BLOCKS_PER_SEC: DEFAULT_ENEMY_SEPARATION_STRENGTH * 0.5,
        dropTable: [], 
        // Visual shape: Defaults to facing RIGHT.
        // Head (circle 'O') is on the right.
        // Tail (triangle '>') is on the left, pointing right.
        visualShape: {
            head: { type: 'circle', radius_BLOCKS: 0.3, offset_BLOCKS: { x: 0.35, y: 0 }, color: 'rgb(100, 160, 200)' }, // Head offset to +X (right)
            bodyColor: 'rgb(120, 180, 220)', 
            // Tail points right: point at x=-0.1, base at x=-0.4
            tail: { type: 'triangle', points_BLOCKS: [{x: -0.1, y:0}, {x: -0.4, y:-0.25}, {x: -0.4, y:0.25}], color: 'rgb(140, 200, 240)' } 
        },
        fleeDistance_BLOCKS: 4, 
        fleeSpeedFactor: 1.8,   
    },
};
// --- Wave Scripting ---
export const WAVE_START_DELAY = 5.0; // seconds before first wave
export const EPOCH_DISPLAY_DURATION = 3.0; // seconds epoch text is displayed
export const MYA_TRANSITION_ANIMATION_DURATION = 6.0; // seconds for the MYA number to animate
export const WAVES = [
    {
    mainWaveNumber: 1,
    mya: 350,
    duration: 117,
    intermissionDuration: 15.0,
    audioTrack: AUDIO_TRACKS.wave1,
    agingPasses: 5,
    subWaves: [
    { enemyGroups: [
    { type: ENEMY_TYPE_TETRAPOD, count: 10, delayBetween: 1.8, startDelay: 0.0 },
    { type: ENEMY_TYPE_SMALL_FISH, count: 10, delayBetween: 0.8, startDelay: 0.0 },
    { type: ENEMY_TYPE_DUNKLEOSTEUS, count: 3, delayBetween: 3.0, startDelay: 5.0 },
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.7, startDelay: 8.0 },
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 3, delayBetween: 0.5, startDelay: 15.0 },
    ]},
    { enemyGroups: [
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 4, delayBetween: 0.6, startDelay: 1.0 },
    { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 3.0 }
    ]},
    { enemyGroups: [
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 6, delayBetween: 0.4, startDelay: 0.5 },
    { type: ENEMY_TYPE_PLAYER_CHASER, count: 1, delayBetween: 1.5, startDelay: 4.0 }
    ]}
    ]
    },
    {
    mainWaveNumber: 2,
    mya: 300,
    duration: 137,
    intermissionDuration: 15.0,
    audioTrack: AUDIO_TRACKS.wave2,
    agingPasses: 5,
    subWaves: [
    { enemyGroups: [
    { type: ENEMY_TYPE_PLAYER_CHASER, count: 4, delayBetween: 1.2, startDelay: 1.0 },
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.6, startDelay: 3.0 },
    { type: ENEMY_TYPE_SMALL_FISH, count: 10, delayBetween: 0.8, startDelay: 0.0 },
    ]},
    { enemyGroups: [
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 10, delayBetween: 0.3, startDelay: 0.0 },
    { type: ENEMY_TYPE_PLAYER_CHASER, count: 3, delayBetween: 1.0, startDelay: 5.0 },
    ]},
    { enemyGroups: [
    { type: ENEMY_TYPE_PLAYER_CHASER, count: 5, delayBetween: 0.9, startDelay: 0.5 },
    { type: ENEMY_TYPE_CENTER_SEEKER, count: 5, delayBetween: 0.5, startDelay: 1.5 },
    { type: ENEMY_TYPE_PLAYER_CHASER, count: 2, delayBetween: 1.5, startDelay: 6.0 },
    ]}
    ]
    },
    {
    mainWaveNumber: 3,
    mya: 250,
    duration: 30,
    intermissionDuration: 15.0,
    audioTrack: AUDIO_TRACKS.wave3,
    agingPasses: 5,
    subWaves: [
    { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
    { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
    ]
    },
    {
    mainWaveNumber: 4,
    mya: 200,
    duration: 30,
    intermissionDuration: 15.0,
    audioTrack: AUDIO_TRACKS.wave3,
    agingPasses: 5,
    subWaves: [
    { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
    { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
    ]
    },
    {
    mainWaveNumber: 5,
    customEpochText: "Present Day!", // sub out mya for custom text
    duration: 30,
    intermissionDuration: 15.0,
    audioTrack: AUDIO_TRACKS.wave3,
    agingPasses: 5,
    subWaves: [
    { enemyGroups: [{ type: ENEMY_TYPE_TETRAPOD, count: 20, delayBetween: 0.5, startDelay: 0.0 }] },
    { enemyGroups: [{ type: ENEMY_TYPE_PLAYER_CHASER, count: 8, delayBetween: 1.0, startDelay: 5.0 }] },
    ]
    }
];