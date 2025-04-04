// -----------------------------------------------------------------------------
// js/world.js - Handles Grid-Based Terrain Data and Drawing (with Procedural Gen)
// -----------------------------------------------------------------------------
console.log("world.js loaded");

import * as Config from './config.js';
import * as Renderer from './renderer.js';

// --- Module State ---
let worldGrid = []; // 2D Array: worldGrid[row][col] = blockObject or BLOCK_AIR(0)
let noiseGenerator = null; // Will hold our noise instance
let gridCanvas = null; // Reference to the off-screen grid canvas

// --- Perlin Noise Implementation (Basic - Unchanged) ---
class PerlinNoise {
    constructor(seed = Math.random()) { this.permutation = []; this.p = new Array(512); this.seed(seed); }
    seed(seed) {
        const random = (() => { let state = Math.floor(seed * 2 ** 32); return () => { state = (1103515245 * state + 12345) | 0; return (state >>> 16) / 65536; }; })();
        this.permutation = Array.from({ length: 256 }, (_, i) => i);
        for (let i = 255; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]; }
        for (let i = 0; i < 512; i++) { this.p[i] = this.permutation[i & 255]; }
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x) { const h = hash & 15; const grad = 1 + (h & 7); return ((h & 8) !== 0 ? -grad : grad) * x; }
    noise(x) {
        const X = Math.floor(x) & 255; const xf = x - Math.floor(x); const u = this.fade(xf);
        const n0 = this.grad(this.p[X], xf); const n1 = this.grad(this.p[X + 1], xf - 1);
        return this.lerp(u, n0, n1) * 2.2; // Keep noise output range consistent
    }
}

// --- Helper functions ---

/**
 * Creates a block object with default properties for a given type.
 * @param {number} type - Block type ID (e.g., Config.BLOCK_DIRT).
 * @param {number} [orientation=Config.ORIENTATION_FULL] - Orientation ID.
 * @returns {object} The block data object { type, orientation, hp, maxHp }.
 */
function createBlock(type, orientation = Config.ORIENTATION_FULL) {
    // Allow creating BLOCK_AIR object if needed, though usually just 0
    if (type === Config.BLOCK_AIR) return Config.BLOCK_AIR;

    const baseHp = Config.BLOCK_HP[type] ?? 0;
    // Water has effectively infinite HP for destruction purposes
    const currentHp = (type === Config.BLOCK_WATER) ? Infinity : baseHp;
    return {
        type: type,
        orientation: orientation,
        hp: currentHp,
        maxHp: baseHp
    };
}

// --- Add a Linear Interpolation helper function ---
function lerp(t, a, b) {
    return a + t * (b - a);
}

/**
 * Gets the block object or BLOCK_AIR at specific grid coordinates - INTERNAL HELPER.
 * Used during initialization passes before full export. Handles boundary checks.
 * @param {number} col
 * @param {number} row
 * @returns {object | number | null} Block object, BLOCK_AIR (0), or null if out of bounds.
 */
function getBlockInternal(c, r) {
    if (r >= 0 && r < Config.GRID_ROWS && c >= 0 && c < Config.GRID_COLS) {
        // Ensure row exists before accessing column
        return worldGrid[r]?.[c] ?? Config.BLOCK_AIR;
    }
    return null; // Out of bounds
}

/**
 * Gets the block *type* ID at specific grid coordinates - INTERNAL HELPER.
 * @param {number} col
 * @param {number} row
 * @returns {number | null} Block type ID or null if out of bounds.
 */
function getBlockTypeInternal(c, r) {
    const block = getBlockInternal(c, r);
    if (block === null) return null;
    return (block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
}

/**
 * Sets a block directly in the grid - INTERNAL HELPER.
 * @param {number} col
 * @param {number} row
 * @param {number} type - Block type ID.
 */
function setBlockInternal(c, r, type) {
     if (r >= 0 && r < Config.GRID_ROWS && c >= 0 && c < Config.GRID_COLS) {
        worldGrid[r][c] = createBlock(type);
     }
}

/**
 * Generates the initial landmass (Stone/Dirt/Grass) and fills the rest with Air.
 */
function generateLandmass() {
    console.log("Generating landmass with tapered island edges...");
    worldGrid = [];
    noiseGenerator = new PerlinNoise();

    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    // Define the target height for island edges to taper towards (e.g., 1 block above water)
    const edgeTargetSurfaceRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + 1;
    const edgeTargetStoneRow = edgeTargetSurfaceRow + 5; // Stone depth at the edge

    // Define how many blocks wide the taper effect should be
    const taperWidth = 10; // Adjust as needed (e.g., 5 to 15)

    // Define a very low base for the deep ocean floor (only placed if r >= this)
    const deepOceanFloorRow = Config.GRID_ROWS - 5; // e.g., solid floor only in bottom 5 rows outside island

    for (let r = 0; r < Config.GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < Config.GRID_COLS; c++) {

            let blockData = Config.BLOCK_AIR; // Default to air

            if (c >= islandStartCol && c < islandEndCol) {
                // --- Inside Island Area (with Tapering) ---

                // Calculate base Perlin heights
                const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
                const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
                let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;

                const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
                const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
                let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
                baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow); // Ensure stone below surface

                // --- Apply Tapering ---
                const distToLeftEdge = c - islandStartCol;
                const distToRightEdge = (islandEndCol - 1) - c;
                const distToNearestEdge = Math.min(distToLeftEdge, distToRightEdge);

                let finalSurfaceRow = baseSurfaceRow;
                let finalStoneRow = baseStoneRow;

                if (distToNearestEdge < taperWidth && taperWidth > 0) {
                    // Calculate blend factor (0 at edge, 1 at taperWidth distance)
                    const blend = distToNearestEdge / taperWidth;
                    // Interpolate towards the target edge height
                    finalSurfaceRow = Math.round(lerp(blend, edgeTargetSurfaceRow, baseSurfaceRow));
                    finalStoneRow = Math.round(lerp(blend, edgeTargetStoneRow, baseStoneRow));
                    // Ensure interpolated stone is still below interpolated surface
                    finalStoneRow = Math.max(finalSurfaceRow + 2, finalStoneRow); // Min 2 layers thick at edge
                }

                // Clamp final heights
                finalSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalSurfaceRow));
                finalStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalStoneRow));
                finalStoneRow = Math.max(finalSurfaceRow + 1, finalStoneRow); // Final check


                // --- Determine Block Type for Island ---
                if (r >= finalStoneRow) {
                    blockData = createBlock(Config.BLOCK_STONE);
                } else if (r > finalSurfaceRow) {
                    blockData = createBlock(Config.BLOCK_DIRT);
                } else if (r === finalSurfaceRow) {
                    blockData = createBlock(Config.BLOCK_GRASS);
                }
                // Else remains BLOCK_AIR (for overhangs or if generation is very low)

            } else {
                // --- Outside Island Area (Ocean Floor - Minimal Blocks) ---
                // Only place solid blocks very deep down. Leave the rest as AIR for flood fill.
                if (r >= deepOceanFloorRow) {
                     // Optionally add slight noise to the deep floor
                     const oceanNoise = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.1);
                     if (r >= deepOceanFloorRow + Math.round(oceanNoise * 2)) {
                         blockData = createBlock(Config.BLOCK_STONE);
                     } else {
                         blockData = createBlock(Config.BLOCK_DIRT); // Thin layer of dirt on deep stone
                     }
                }
                // Else remains BLOCK_AIR - this is the key change!
            }

            row.push(blockData);
        }
        worldGrid.push(row);
    }
    console.log("Landmass generation complete (tapered edges, air oceans).");
}

/**
 * Fills connected air blocks below the target water level with water using Flood Fill (BFS).
 * @param {number} targetWaterRow - The highest row index (inclusive) that water should reach.
 */
function applyFloodFill(targetWaterRow) {
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // Track visited cells to prevent cycles and redundant checks

    // Start flood fill from all air blocks at or below the target water row on the edges and bottom
    // Bottom edge:
    for (let c = 0; c < Config.GRID_COLS; c++) {
        for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
             const blockType = getBlockTypeInternal(c, r);
             const key = `${c},${r}`;
             if (blockType === Config.BLOCK_AIR && !visited.has(key)) {
                 queue.push({ c, r });
                 visited.add(key);
             }
        }
    }
    // Side edges (below target water row):
    for (let r = 0; r < targetWaterRow; r++) {
        const keyLeft = `0,${r}`;
        if (getBlockTypeInternal(0, r) === Config.BLOCK_AIR && !visited.has(keyLeft)) {
             queue.push({ c: 0, r });
             visited.add(keyLeft);
        }
        const keyRight = `${Config.GRID_COLS - 1},${r}`;
        if (getBlockTypeInternal(Config.GRID_COLS - 1, r) === Config.BLOCK_AIR && !visited.has(keyRight)) {
             queue.push({ c: Config.GRID_COLS - 1, r });
             visited.add(keyRight);
        }
    }


    // Breadth-First Search
    while (queue.length > 0) {
        const { c, r } = queue.shift();

        // Check bounds and if it's air (should be if added correctly, but safety check)
        if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || getBlockTypeInternal(c, r) !== Config.BLOCK_AIR) {
             continue;
        }

        // Fill with water only if at or below the target row
        if (r >= targetWaterRow) {
             setBlockInternal(c, r, Config.BLOCK_WATER);
        } else {
             // It's above the target water row, but was connected from below.
             // Fill it IF it's connected to a water source below.
             // This allows filling "upwards" into depressions slightly above the main water line.
             // Check neighbors: if any neighbor below targetWaterRow is already water, fill this too.
             const neighbors = [
                 getBlockTypeInternal(c, r + 1), // Check below
                 getBlockTypeInternal(c - 1, r), // Check left
                 getBlockTypeInternal(c + 1, r)  // Check right
                 // Don't check up usually for water filling from bottom/sides
             ];
             // If connected to water below the line, fill it.
             if (getBlockTypeInternal(c, r+1) === Config.BLOCK_WATER && r + 1 >= targetWaterRow) {
                setBlockInternal(c, r, Config.BLOCK_WATER);
             }
             // If connected horizontally to water that is at the target line or below
             else if (neighbors.includes(Config.BLOCK_WATER) && (getBlockInternal(c-1,r)?.type === Config.BLOCK_WATER || getBlockInternal(c+1,r)?.type === Config.BLOCK_WATER) ){
                // Find the row of the adjacent water block to check its height
                 let neighborWaterIsLowEnough = false;
                 if(getBlockTypeInternal(c-1,r) === Config.BLOCK_WATER && r >= targetWaterRow) neighborWaterIsLowEnough = true;
                 if(getBlockTypeInternal(c+1,r) === Config.BLOCK_WATER && r >= targetWaterRow) neighborWaterIsLowEnough = true;

                 if(neighborWaterIsLowEnough) {
                     setBlockInternal(c, r, Config.BLOCK_WATER);
                 }
             }
        }

        // Add neighbors to the queue if they are valid, AIR, and not visited
        const neighborCoords = [
            { nc: c, nr: r - 1 }, // Up
            { nc: c, nr: r + 1 }, // Down
            { nc: c - 1, nr: r }, // Left
            { nc: c + 1, nr: r }  // Right
        ];

        for (const { nc, nr } of neighborCoords) {
            const nKey = `${nc},${nr}`;
            if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS && !visited.has(nKey) && getBlockTypeInternal(nc, nr) === Config.BLOCK_AIR)
            {
                // Crucially: Only queue neighbours that are *at or below* the target water level
                // OR slightly above if we want lakes to form fully in depressions
                // Let's allow filling slightly above for now if connected
                 if (nr >= targetWaterRow - 5) { // Allow filling up to 5 blocks above target if connected
                    visited.add(nKey);
                    queue.push({ c: nc, r: nr });
                 }
            }
        }
    }
    console.log("Flood fill complete.");
}


/**
 * Applies sand generation along water edges after flood fill.
 */
function applySandPass() {
    console.log("Applying sand generation pass...");
    const changes = []; // Store {r, c} coords to change

    // Iterate through the grid, focusing on areas around the likely water level
    // Can optimize the range later, for now check a generous area
    const startRow = Math.max(0, Config.WORLD_GROUND_LEVEL_MEAN - 20);
    const endRow = Config.GRID_ROWS;

    for (let r = startRow; r < endRow; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = getBlockInternal(c, r);
            // Check if it's a land block (Dirt or Grass)
            if (block && block !== Config.BLOCK_AIR && (block.type === Config.BLOCK_DIRT || block.type === Config.BLOCK_GRASS)) {
                // Check neighbors for water
                const neighbors = [
                    getBlockTypeInternal(c, r - 1), // Above
                    getBlockTypeInternal(c, r + 1), // Below
                    getBlockTypeInternal(c - 1, r), // Left
                    getBlockTypeInternal(c + 1, r)  // Right
                ];
                if (neighbors.includes(Config.BLOCK_WATER)) {
                    // Check diagonal neighbors too for slightly nicer beaches (optional)
                    // const diagNeighbors = [
                    //     getBlockTypeInternal(c - 1, r - 1), getBlockTypeInternal(c + 1, r - 1),
                    //     getBlockTypeInternal(c - 1, r + 1), getBlockTypeInternal(c + 1, r + 1)
                    // ];
                    // if (neighbors.includes(Config.BLOCK_WATER) || diagNeighbors.includes(Config.BLOCK_WATER)) {
                    changes.push({ r, c });
                }
            }
        }
    }

    // Apply the changes
    changes.forEach(change => {
        setBlockInternal(change.c, change.r, Config.BLOCK_SAND);
    });
    console.log(`Sand pass complete. ${changes.length} blocks changed.`);
}

/**
 * Draws the static grid lines onto the off-screen grid canvas (once).
 * (Unchanged)
 */
function drawGridLayerOnce() {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx || !gridCanvas) { console.error("World.drawGridLayerOnce: Grid context/canvas missing!"); return; }
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Faint grid lines
    gridCtx.lineWidth = 0.5;
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            gridCtx.strokeRect(c * Config.BLOCK_WIDTH, r * Config.BLOCK_HEIGHT, Config.BLOCK_WIDTH, Config.BLOCK_HEIGHT);
        }
    }
    gridCtx.restore();
    console.log("Static grid layer drawn.");
}

// --- PUBLIC EXPORTED FUNCTIONS ---

export function init() {
    console.time("WorldInit"); // Start timer

    generateLandmass(); // Step 1: Create Stone/Dirt/Grass/Air

    // Step 2: Fill air below water level with water, creating oceans and lakes
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);

    // Step 3: Convert land adjacent to water into sand
    applySandPass();

    // Step 4: Prepare rendering resources
    gridCanvas = Renderer.getGridCanvas(); // Get reference to the canvas
    drawGridLayerOnce(); // Pre-render grid lines

    console.timeEnd("WorldInit"); // End timer
    console.log("World initialized with new procedural generation.");
}

// --- Getters and Setters (Public - Unchanged logic, use internal helpers where needed) ---

export function getBlock(col, row) {
    // Safe public version
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        return worldGrid[row]?.[col] ?? Config.BLOCK_AIR;
    }
    return null; // Out of bounds
}

export function getBlockType(col, row) {
    const block = getBlock(col, row);
    if (block === null) return null;
    return (block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
}

// Public setBlock - use this for gameplay changes (breaking/placing)
export function setBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
     if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        worldGrid[row][col] = createBlock(blockType, orientation);
        // TODO: Add logic here to mark this block/chunk as "dirty" for optimized drawing
    } else { /* console.warn(`Set block out of bounds: ${row}, ${col}`); */ }
}


// --- Drawing (Unchanged) ---
export function draw(ctx) {
    if (!ctx) { console.error("World.draw: No context!"); return; }

    // 1. Draw Static Grid Layer
    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0);
    }

    // 2. Draw Dynamic Blocks
    // TODO: Optimize to only draw visible/dirty blocks/chunks
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r][c];
            if (block === Config.BLOCK_AIR) continue; // Skip air

            const blockType = block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) continue; // Skip if no color defined

            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block.orientation; // Already an object

            if (orientation === Config.ORIENTATION_FULL) {
                ctx.fillStyle = blockColor;
                // Use Math.floor for coords, Math.ceil for size for pixel-perfect grid covering
                ctx.fillRect( Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT) );
            }
            // TODO: Add drawing logic for slopes based on orientation
        }
    }
}

// --- Collision and Utilities (Unchanged logic, but relies on correct block types) ---

export function isSolid(col, row) {
    const block = getBlock(col, row);
    if (block === null || block === Config.BLOCK_AIR) return false;
    // Only FULL water blocks are non-solid for collision. Might change later.
    if (block.type === Config.BLOCK_WATER && block.orientation === Config.ORIENTATION_FULL) return false;
    // TODO: Add slope logic based on orientation
    return true; // All other non-air blocks are solid for now
}

export function worldToGridCoords(worldX, worldY) {
    const col = Math.floor(worldX / Config.BLOCK_WIDTH);
    const row = Math.floor(worldY / Config.BLOCK_HEIGHT);
    return { col, row };
}

// This function might be less useful now with varied terrain, but kept for potential use
export function getCollisionSurfaceY(col) {
    if (col < 0 || col >= Config.GRID_COLS) return Config.CANVAS_HEIGHT;
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (isSolid(col, r)) return r * Config.BLOCK_HEIGHT;
    }
    return Config.CANVAS_HEIGHT; // No solid block found
}

// Collision check logic remains the same structure, relies on isSolid
export function checkGridCollision(entity) {
    let collidedX = false, collidedY = false, isOnGround = false;
    // Use entity properties directly if they are exposed (e.g., entity.x, entity.width)
    const { x, y, width, height, vx, vy } = entity;

    // --- Vertical Collision ---
    const targetY = y + vy;
    if (vy > 0) { // Moving Down
        const checkRow = worldToGridCoords(x, targetY + height).row;
        const feetY = targetY + height;
        // Check points along bottom edge
        const colLeft = worldToGridCoords(x + 1, feetY).col; // Slight inset
        const colRight = worldToGridCoords(x + width - 1, feetY).col; // Slight inset
        if (isSolid(colLeft, checkRow) || isSolid(colRight, checkRow)) {
            const groundSurfaceY = checkRow * Config.BLOCK_HEIGHT;
             // Check if entity was already intersecting or just about to
            if (y + height <= groundSurfaceY + 0.1) { // Use small tolerance
                entity.y = groundSurfaceY - height; // Snap position
                entity.vy = 0;                      // Stop vertical velocity
                collidedY = true;
                isOnGround = true;
            }
         }
    } else if (vy < 0) { // Moving Up
        const checkRow = worldToGridCoords(x, targetY).row;
        const headY = targetY;
        // Check points along top edge
        const colLeft = worldToGridCoords(x + 1, headY).col;
        const colRight = worldToGridCoords(x + width - 1, headY).col;
        if (isSolid(colLeft, checkRow) || isSolid(colRight, checkRow)) {
            const ceilingSurfaceY = (checkRow + 1) * Config.BLOCK_HEIGHT;
            // Check if entity was already intersecting or just about to
            if (y >= ceilingSurfaceY - 0.1) { // Use small tolerance
                entity.y = ceilingSurfaceY; // Snap position
                entity.vy = 0;              // Stop vertical velocity
                collidedY = true;
            }
        }
    }

    // --- Horizontal Collision ---
    const targetX = x + vx;
    if (vx > 0) { // Moving Right
        const checkCol = worldToGridCoords(targetX + width, y).col;
        const rightEdgeX = targetX + width;
        // Check points along right edge
        const rowTop = worldToGridCoords(rightEdgeX, y + 1).row; // Slight inset
        const rowMiddle = worldToGridCoords(rightEdgeX, y + height / 2).row;
        const rowBottom = worldToGridCoords(rightEdgeX, y + height - 1).row; // Slight inset
        if (isSolid(checkCol, rowTop) || isSolid(checkCol, rowMiddle) || isSolid(checkCol, rowBottom)) {
            const wallSurfaceX = checkCol * Config.BLOCK_WIDTH;
             // Check if entity was already intersecting or just about to
            if (x + width <= wallSurfaceX + 0.1) { // Use small tolerance
                entity.x = wallSurfaceX - width; // Snap position
                entity.vx = 0;                   // Stop horizontal velocity
                collidedX = true;
            }
        }
    } else if (vx < 0) { // Moving Left
        const checkCol = worldToGridCoords(targetX, y).col;
        const leftEdgeX = targetX;
         // Check points along left edge
        const rowTop = worldToGridCoords(leftEdgeX, y + 1).row;
        const rowMiddle = worldToGridCoords(leftEdgeX, y + height / 2).row;
        const rowBottom = worldToGridCoords(leftEdgeX, y + height - 1).row;
        if (isSolid(checkCol, rowTop) || isSolid(checkCol, rowMiddle) || isSolid(checkCol, rowBottom)) {
            const wallSurfaceX = (checkCol + 1) * Config.BLOCK_WIDTH;
             // Check if entity was already intersecting or just about to
            if (x >= wallSurfaceX - 0.1) { // Use small tolerance
                entity.x = wallSurfaceX; // Snap position
                entity.vx = 0;           // Stop horizontal velocity
                collidedX = true;
            }
        }
    }

     // --- Final Ground Check (needed if vx changes caused loss of ground contact) ---
     // Check slightly below the entity's current position if not already determined to be on ground
     if (!isOnGround && vy >= 0) { // Only check if standing still or falling
         const checkRowBelow = worldToGridCoords(x, y + height + 1).row; // Check 1 pixel below
         const colLeftFinal = worldToGridCoords(x + 1, y + height).col;
         const colRightFinal = worldToGridCoords(x + width - 1, y + height).col;
         // Check if the block directly below either foot is solid
         if (isSolid(colLeftFinal, checkRowBelow) || isSolid(colRightFinal, checkRowBelow)) {
             // Added check: ensure the entity is *very close* to the ground surface before setting isOnGround
             const groundSurfaceBelowY = checkRowBelow * Config.BLOCK_HEIGHT;
             if (Math.abs((y + height) - groundSurfaceBelowY) < 1.0) { // Allow tolerance (e.g., 1 pixel)
                 isOnGround = true;
                 // Optional: Snap Y exactly if slightly off? Only if vy === 0?
                 // if (vy === 0) entity.y = groundSurfaceBelowY - height;
             }
         }
     }

    return { collidedX, collidedY, isOnGround };
}

// --- Update function (for world effects like grass spread, water flow - future) ---
export function update(dt) {
    // Placeholder for future world simulation logic
    // e.g., grass spreading to adjacent dirt
    // e.g., basic water physics (cellular automata)
}