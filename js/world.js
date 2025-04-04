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

// --- Perlin Noise Implementation ---
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
    // Target surface height at the very edge - closer to water level for beaches
    const edgeTargetSurfaceRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + 2; // Just slightly above water target
    // Target stone height at the very edge - maybe a bit deeper than surface
    const edgeTargetStoneRow = edgeTargetSurfaceRow + 8; // e.g., 8 blocks deep stone at edge

    // Define how many blocks wide the taper effect should be
    const taperWidth = 40;

    // Define a very low base for the deep ocean floor (only placed if r >= this)
    // Make deep ocean floor relative to water level, and potentially less flat
    const deepOceanBaseRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1); // e.g., 10% grid height below water target
    const deepOceanMaxRow = Config.GRID_ROWS - 3; // Ensure it doesn't go *right* to the bottom edge
    const deepOceanFloorStartRow = Math.min(deepOceanMaxRow, deepOceanBaseRow);

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
                    const blend = Math.pow(distToNearestEdge / taperWidth, 0.75); // Use Math.pow for non-linear taper (optional, 0.5 = faster drop, 1.0 = linear, 1.5 = slower drop)
                    finalSurfaceRow = Math.round(lerp(blend, edgeTargetSurfaceRow, baseSurfaceRow));
                    finalStoneRow = Math.round(lerp(blend, edgeTargetStoneRow, baseStoneRow));
                    finalStoneRow = Math.max(finalSurfaceRow + 2, finalStoneRow); // Min 2 layers thick at edge
                }

                // Clamp final heights (ensure stone mean fix in config is primary solution)
                finalSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalSurfaceRow));
                finalStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalStoneRow)); // Should be less critical now
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
                // --- Outside Island Area (Ocean Floor - Tapered) ---
                // Calculate distance from the *actual* edge of the grid
                const distToGridEdge = Math.min(c, (Config.GRID_COLS - 1) - c);
                // Taper ocean floor height - start deep at edges, rise towards island taper zone
                // Blend from absolute edge (0) to islandStartCol/islandEndCol
                const oceanTaperStartDist = islandStartCol; // How far from edge taper starts
                let oceanFloorRow = deepOceanFloorStartRow; // Default deep floor
                if (distToGridEdge < oceanTaperStartDist && oceanTaperStartDist > 0) {
                     const oceanBlend = distToGridEdge / oceanTaperStartDist;
                     // Interpolate from deep floor up towards the island's edge target stone height
                     oceanFloorRow = Math.round(lerp(oceanBlend, deepOceanFloorStartRow, edgeTargetStoneRow + 5)); // Blend towards slightly deeper than island edge stone
                }
                 oceanFloorRow = Math.min(Config.GRID_ROWS -1, Math.max(edgeTargetSurfaceRow, oceanFloorRow)); // Clamp & ensure floor below surface target
        
        
                if (r >= oceanFloorRow) {
                     // Optional noise
                     const oceanNoise = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.2 + 500); // Different noise seed/scale
                     if (r >= oceanFloorRow + 1 + Math.round(oceanNoise * 2)) {
                         blockData = createBlock(Config.BLOCK_STONE);
                     } else {
                         blockData = createBlock(Config.BLOCK_DIRT);
                     }
                }
                // Else remains BLOCK_AIR for flood fill
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
        // Basic bounds check (redundant if queueing is correct, but safe)
        if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) {
            continue;
        }
        // Check if it's actually air (might have been filled by another path)
        const currentType = getBlockTypeInternal(c, r);
        if (currentType !== Config.BLOCK_AIR) {
            continue;
        }
        // Fill with water ONLY if at or below the target row
        if (r >= targetWaterRow) {
            setBlockInternal(c, r, Config.BLOCK_WATER);
            // Add neighbors to the queue IF they are valid, AIR, and NOT VISITED
            const neighborCoords = [
                { nc: c, nr: r - 1 }, // Up
                { nc: c, nr: r + 1 }, // Down
                { nc: c - 1, nr: r }, // Left
                { nc: c + 1, nr: r }  // Right
            ];

            for (const { nc, nr } of neighborCoords) {
                const nKey = `${nc},${nr}`;
                // Check bounds, if it's AIR, and not visited
                if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS &&
                    !visited.has(nKey) && getBlockTypeInternal(nc, nr) === Config.BLOCK_AIR)
                {
                    // CRITICAL CHANGE: Only queue neighbors also AT OR BELOW water level
                    if (nr >= targetWaterRow) {
                        visited.add(nKey);
                        queue.push({ c: nc, r: nr });
                    }
                    // We could potentially queue the block directly *at* targetWaterRow - 1
                    // if we want water surface to be perfectly smooth, but let's stick to this simple logic first.
                }
            }
        }
        // If r < targetWaterRow, we simply don't fill it and don't explore from it.
    }    console.log("Flood fill complete.");

}

/**
 * Applies sand generation along water edges after flood fill.
 */
function applySandPass() {
    console.log("Applying sand generation pass (thicker beaches)...");
    const changes = []; // Store {r, c, type} coords to change
    const maxDepth = 3; // How many blocks deep sand can replace dirt/stone
    const maxRaise = 1; // How many blocks above water sand can appear (optional)

    // Iterate relevant grid area
    const startRow = Math.max(0, Config.WORLD_GROUND_LEVEL_MEAN - 30); // Optimize range later
    const endRow = Config.GRID_ROWS;

    for (let r = startRow; r < endRow; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = getBlockTypeInternal(c, r);

            // Check only Dirt or Stone blocks initially
            if (blockType === Config.BLOCK_DIRT || blockType === Config.BLOCK_STONE) {
                let adjacentWater = false;
                // Check neighbors (including diagonals often looks better for beaches)
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r },
                    { nc: c - 1, nr: r - 1 }, { nc: c + 1, nr: r - 1 }, { nc: c - 1, nr: r + 1 }, { nc: c + 1, nr: r + 1 }
                ];

                for (const { nc, nr } of neighborCoords) {
                    if (getBlockTypeInternal(nc, nr) === Config.BLOCK_WATER) {
                        adjacentWater = true;
                        break;
                    }
                }

                if (adjacentWater) {
                    // If adjacent to water, this block *could* become sand
                    // Allow sand slightly above water level and replace dirt/stone downwards
                    if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise) {
                         changes.push({ r, c, type: Config.BLOCK_SAND });
                    }
                }
            }
        }
    }

    // Apply changes - we might overwrite some stone/dirt that was intended.
    // A more complex approach could check distance from water. This is simpler.
    // We could run this multiple times or do a BFS from water edge for true thickness. Let's keep it simple first.

    // --- Second Pass (Optional but Recommended): Smooth Sand Layer ---
    // After initial placement, convert Dirt blocks *under* new Sand blocks into Sand for depth.
    const finalChanges = [...changes]; // Copy initial changes
    for (const change of changes) {
         // Check below the block we just marked as sand
        for (let depth = 1; depth <= maxDepth; depth++) {
            const below_r = change.r + depth;
            const belowType = getBlockTypeInternal(change.c, below_r);
            if (belowType === Config.BLOCK_DIRT || belowType === Config.BLOCK_STONE) {
                 // Only add if not already marked for change to avoid duplicates
                 if (!finalChanges.some(fc => fc.r === below_r && fc.c === change.c)) {
                     finalChanges.push({ r: below_r, c: change.c, type: Config.BLOCK_SAND });
                 }
            } else if (belowType !== Config.BLOCK_SAND) {
                 break; // Stop going deeper if we hit air, water, or something else
            }
        }
    }


    // Apply the final changes
    finalChanges.forEach(change => {
        // Only change if the target block is currently Dirt or Stone
        // This prevents overwriting grass potentially, though grass should be higher.
        const currentType = getBlockTypeInternal(change.c, change.r);
         if (currentType === Config.BLOCK_DIRT || currentType === Config.BLOCK_STONE || currentType === Config.BLOCK_GRASS) {
             setBlockInternal(change.c, change.r, change.type);
         }
    });
    console.log(`Sand pass complete. ${finalChanges.length} potential blocks changed.`);
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
    console.time("WorldInit");
    generateLandmass();       // Step 1: Base terrain
    // Step 2: Add stone variations applyStonePatches();
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET); // Step 3: Water
    applySandPass();          // Step 4: Sand beaches
    gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) Renderer.createGridCanvas(); // Ensure grid canvas is created
    gridCanvas = Renderer.getGridCanvas();
    drawGridLayerOnce();
    console.timeEnd("WorldInit");
    console.log("World initialized with improved procedural generation.");
}

// --- Getters and Setters (Public - Unchanged logic, use internal helpers where needed) ---

export function getBlock(col, row) {
    // Safe public versiond 
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

    // Consider water non-solid only if it's a full block (allows for water slopes later if needed)
    if (block.type === Config.BLOCK_WATER && block.orientation === Config.ORIENTATION_FULL) return false;

    // --- Basic Slope Handling ---
    // Treat all non-air, non-full-water blocks as solid for collision checks.
    // This includes all slope orientations. The checkGridCollision function
    // will snap to the bounding box of the grid cell, which isn't perfect
    // for slopes but prevents falling through initially.
    return true;
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