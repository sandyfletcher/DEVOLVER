// -----------------------------------------------------------------------------
// root/js/player.js - Player Character Class
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';
import * as WorldManager from './worldManager.js';
import * as WorldData from './utils/worldData.js';

// Helper function to check if a target world position is within the player's interaction range.
export function isTargetWithinRange(player, targetWorldPos) {
    if (!player || !targetWorldPos) return false;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const dx = targetWorldPos.x - playerCenterX;
    const dy = targetWorldPos.y - playerCenterY;
    const distSq = dx * dx + dy * dy;
    // Compare squared distance to avoid square root calculation
    return distSq <= Config.PLAYER_INTERACTION_RANGE_SQ;
}

// Helper function to check if a grid cell has an adjacent solid block (needed for placement).
function hasSolidNeighbor(col, row) {
    const neighbors = [
        { c: col, r: row - 1 }, // Above
        { c: col, r: row + 1 }, // Below
        { c: col - 1, r: row }, // Left
        { c: col + 1, r: row }  // Right
    ];

    for (const n of neighbors) {
        // Use GridCollision.isSolid which handles boundary checks and block type checks
        if (GridCollision.isSolid(n.c, n.r)) {
            return true; // Found a solid neighbor
        }
    }
    return false; // No solid neighbors found
}

export class Player {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        // Physics state (velocity)
        this.vx = 0; // Velocity in pixels per second
        this.vy = 0; // Velocity in pixels per second
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0; // Cooldown timer for water jumps/strokes
        // --- Weapon & Inventory State ---
        this.hasShovel = false;
        this.hasSword = false;
        this.hasSpear = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Start unarmed
        this.inventory = {}; // Stores counts of materials: { 'dirt': 10, 'stone': 5 }
        // --- Combat State ---
        this.isAttacking = false;    // Is the attack animation/hitbox active?
        this.attackTimer = 0;        // Duration timer for the current attack
        this.attackCooldown = 0;     // Cooldown timer until the next attack is possible
        this.hitEnemiesThisSwing = []; // Tracks enemies hit during the current attack swing
        this.hitBlocksThisSwing = [];  // Tracks blocks hit during the current attack swing ("col,row" keys)
        // --- Health State ---
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY; // Max health for UI display
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH; // Starting health
        this.isInvulnerable = false; // Is the player currently immune to damage?
        this.invulnerabilityTimer = 0; // Timer for invulnerability duration
        // --- Targeting State ---
        this.targetWorldPos = { x: 0, y: 0 }; // Mouse position in world coordinates
        this.targetGridCell = { col: 0, row: 0 }; // Grid cell the mouse is over
        this.lastDirection = 1; // Facing direction (1 for right, -1 for left), used as fallback for aiming
    }

    /**
     * Updates the player's state based on input, physics, and environment interactions.
     * @param {number} dt - Delta time (time elapsed since last frame in seconds).
     * @param {object} inputState - Current input state (left, right, jump, attack flags).
     * @param {object} targetWorldPos - Current mouse position in world coordinates {x, y}.
     * @param {object} targetGridCell - Current grid cell under mouse {col, row}.
     */
    update(dt, inputState, targetWorldPos, targetGridCell) {
        // Update targeting state from input parameters
        this.targetWorldPos = targetWorldPos;
        this.targetGridCell = targetGridCell;

        // Update Player Facing Direction based on Target Position relative to player center
        const playerCenterX = this.x + this.width / 2;
        const targetDeltaX = this.targetWorldPos.x - playerCenterX;
        // Only update direction if the target isn't extremely close horizontally to avoid rapid flipping
        if (Math.abs(targetDeltaX) > 1) { // Use a small threshold
             this.lastDirection = Math.sign(targetDeltaX);
        }
        // If target is directly above/below or very close, keep the previous direction.

        // --- 1. Update Environmental Status (Water) ---
        const wasInWater = this.isInWater; // Store previous state for potential logic changes
        this.isInWater = GridCollision.isEntityInWater(this); // Check if currently in water

        // Reset water jump cooldown if player just exited water
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0;
        }

        // --- Determine Current Physics Parameters based on Environment ---
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
        const currentMaxSpeedX = this.isInWater ? Config.PLAYER_MAX_SPEED_X * Config.WATER_MAX_SPEED_FACTOR : Config.PLAYER_MAX_SPEED_X;
        const currentAcceleration = this.isInWater ? Config.PLAYER_MOVE_ACCELERATION * Config.WATER_ACCELERATION_FACTOR : Config.PLAYER_MOVE_ACCELERATION;
        // Damping factors approach 0 as dt increases, causing velocity reduction. Factor of 1 means no damping.
        const horizontalDampingFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : 1;
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;

        // --- Update Timers ---
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) { // Attack duration ended
                this.isAttacking = false;
                this.hitEnemiesThisSwing = []; // Clear hit targets for the next swing
                this.hitBlocksThisSwing = [];
            }
        }
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) { // Invulnerability ended
                this.isInvulnerable = false;
            }
        }
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt; // Decrement water jump cooldown

        // --- Input Handling & Horizontal Movement ---
        let targetVx = 0; // Target horizontal velocity based on input
        if (inputState.left && !inputState.right) {
            targetVx = -currentMaxSpeedX; // Move left up to max speed for current environment
        } else if (inputState.right && !inputState.left) {
            targetVx = currentMaxSpeedX; // Move right up to max speed
        }

        // Apply acceleration towards the target velocity
        if (targetVx !== 0) {
            // Accelerate based on environment-specific acceleration
            this.vx += Math.sign(targetVx) * currentAcceleration * dt;
            // Clamp velocity to the maximum speed for the current environment
            if (Math.abs(this.vx) > currentMaxSpeedX) {
                this.vx = Math.sign(this.vx) * currentMaxSpeedX;
            }
        } else {
            // Apply friction if on ground and not in water
            if (!this.isInWater && this.isOnGround) {
                const frictionFactor = Math.pow(Config.PLAYER_FRICTION_BASE, dt); // Friction slows down exponentially
                this.vx *= frictionFactor;
            }
            // Stop completely if velocity becomes very small (in air or water)
            if (Math.abs(this.vx) < 1) {
                this.vx = 0;
            }
        }

        // Apply horizontal water damping regardless of input if in water
        if (this.isInWater) {
            this.vx *= horizontalDampingFactor;
        }

        // --- Jumping / Swimming ---
        if (inputState.jump) { // Check if jump input is currently active
            if (this.isInWater) {
                // Perform a swim stroke (upward impulse) if cooldown allows
                if (this.waterJumpCooldown <= 0) {
                    this.vy = -Config.WATER_SWIM_VELOCITY; // Apply upward velocity
                    this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION; // Start cooldown
                    this.isOnGround = false; // Ensure not considered on ground when swimming up
                }
            } else if (this.isOnGround) {
                // Perform a normal jump from the ground (only if not in water)
                this.vy = -Config.PLAYER_JUMP_VELOCITY; // Apply upward velocity
                this.isOnGround = false; // Player is no longer on the ground
            }
            // Jump input is typically consumed implicitly by checking state each frame,
            // unless specific single-press logic is needed.
        }

        // --- Block Placement Logic ---
// Check if attack input is active AND a placeable material is selected
if (inputState.attack && this.isMaterialSelected()) {
    const materialType = this.selectedItem; // Get the selected material

    // 1. Check if player has the material in inventory
    if ((this.inventory[materialType] || 0) > 0) {
        // 2. Check if the target location is within interaction range
        if (isTargetWithinRange(this, targetWorldPos)) { // isTargetWithinRange helper is local, ok.
            // 3. Check if the target grid cell is valid for placement
            const targetCol = targetGridCell.col;
            const targetRow = targetGridCell.row;
            const targetBlockType = WorldData.getBlockType(targetCol, targetRow);
            // Can place in Air, or in Water if config allows
            const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);

            if (canPlaceHere) {
                // 4. Check if placing the block would overlap the player
                if (!this.checkPlacementOverlap(targetCol, targetRow)) {
                    // 5. Check if the target cell has an adjacent solid block for support
                    if (hasSolidNeighbor(targetCol, targetRow)) { // hasSolidNeighbor helper is local, ok.
                        // ALL CHECKS PASSED - PLACE THE BLOCK!
                        const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[materialType];
                        if (blockTypeToPlace !== undefined) {
                            // *** CHANGE THIS LINE ***
                            // Attempt to place the block using WorldManager's player-specific method
                            // if (WorldManager.setBlock(targetCol, targetRow, blockTypeToPlace)) { // Old line
                            if (WorldManager.placePlayerBlock(targetCol, targetRow, blockTypeToPlace)) { // New line, marks block as player placed
                                this.decrementInventory(materialType); // Reduce inventory count
                                inputState.attack = false; // Consume the attack input *only on successful placement*
                                // Optional: Add a short cooldown after placing?
                                // this.attackCooldown = 0.1;
                            } else {
                                // Placement failed at the WorldManager level (should be rare if checks passed)
                                // console.warn(`WorldManager failed to place player block ${materialType} at [${targetCol}, ${targetRow}]`);
                            }
                        } else {
                            // console.warn(`No block type mapping found for material ${materialType}`);
                        }
                    } // else: No adjacent support. Log commented out for performance.
                } // else: Player overlap. Log commented out.
            } // else: Target cell not empty/placeable. Log commented out.
        } // else: Out of range. Log commented out.
    } // else: Not enough material. Log commented out.

    // Consume attack input if a material was selected, even if placement failed,
    // to prevent accidentally swinging a weapon immediately after a failed placement attempt.
    // Keep this consumption logic.
    if (inputState.attack) { inputState.attack = false; }
}

        // --- Attack Triggering (Weapon Only) ---
        // Execute only if:
        // - attack input is still true (i.e., not consumed by placement)
        // - a weapon is selected (not unarmed or a material)
        // - attack is not on cooldown
        // - player is not already in the middle of an attack swing
        if (inputState.attack && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.attackCooldown <= 0 && !this.isAttacking) {
            this.isAttacking = true; // Start the attack state
            this.hitEnemiesThisSwing = []; // Reset hit lists for this swing
            this.hitBlocksThisSwing = [];

            // Set attack duration and cooldown based on the equipped weapon type
            switch (this.selectedItem) {
                case Config.WEAPON_TYPE_SWORD:
                    this.attackTimer = Config.PLAYER_SWORD_ATTACK_DURATION;
                    this.attackCooldown = Config.PLAYER_SWORD_ATTACK_COOLDOWN;
                    break;
                case Config.WEAPON_TYPE_SPEAR:
                    this.attackTimer = Config.PLAYER_SPEAR_ATTACK_DURATION;
                    this.attackCooldown = Config.PLAYER_SPEAR_ATTACK_COOLDOWN;
                    break;
                case Config.WEAPON_TYPE_SHOVEL:
                    this.attackTimer = Config.PLAYER_SHOVEL_ATTACK_DURATION;
                    this.attackCooldown = Config.PLAYER_SHOVEL_ATTACK_COOLDOWN;
                    break;
                default:
                    // Fallback for potentially new/undefined weapons
                    this.attackTimer = 0.1;
                    this.attackCooldown = 0.2;
                    break;
            }
            inputState.attack = false; // Consume the attack input after successfully starting the attack
        } else if (inputState.attack) {
            // Consume attack input if it couldn't trigger (e.g., on cooldown, unarmed, placement failed)
            inputState.attack = false;
        }

        // --- Physics Step 1: Apply Gravity ---
        // Apply gravity if the player is not considered on the ground
        if (!this.isOnGround) {
            this.vy += currentGravity * dt;
        } else if (this.vy > 0) {
            // If player is on ground but has slight downward velocity (e.g., from previous frame), reset it
            this.vy = 0;
        }

        // --- Apply Vertical Damping and Speed Clamping in Water ---
        if (this.isInWater) {
            this.vy *= verticalDampingFactor; // Apply vertical drag
            // Clamp vertical speed while swimming/sinking
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED); // Limit upward speed
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);   // Limit downward speed (sinking)
        } else {
            // Clamp maximum falling speed in air
            if (this.vy > Config.MAX_FALL_SPEED) {
                this.vy = Config.MAX_FALL_SPEED;
            }
        }

        // --- Calculate Potential Movement based on current velocities ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision Detection and Resolution ---
        // Use the utility function to handle collisions with the world grid
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status based on collision result

        // Zero out velocity component if a collision occurred on that axis
        if (collisionResult.collidedX) this.vx = 0;
        if (collisionResult.collidedY) {
            // Only zero vy if it was significant, prevents micro-bouncing issues
            if (Math.abs(this.vy) > 0.1) { this.vy = 0; }
        }

        // --- Screen Boundary Checks ---
        // Prevent moving outside the horizontal bounds of the world
        if (this.x < 0) {
            this.x = 0;
            if (this.vx < 0) this.vx = 0; // Stop velocity if hitting left edge
        }
        if (this.x + this.width > Config.CANVAS_WIDTH) {
            this.x = Config.CANVAS_WIDTH - this.width;
            if (this.vx > 0) this.vx = 0; // Stop velocity if hitting right edge
        }

        // --- Reset if Falling Out of World ---
        // If player falls too far below the screen, reset position and apply damage
        if (this.y > Config.CANVAS_HEIGHT + 200) { // Check against a buffer below the canvas
            console.warn("Player fell out of world!");
            this.resetPosition(); // Move player back to start
             // Apply damage for falling out? (Optional penalty)
             this.takeDamage(10); // Example damage amount
        }
    } // --- End of update method ---

    /**
     * Calculates information needed to draw the placement ghost block preview.
     * @returns {object | null} Object { col, row, color } or null if placement is invalid.
     */
    getGhostBlockInfo() {
        // Can only show ghost if a material is selected
        if (!this.isMaterialSelected()) return null;
        // Need valid target grid cell data
        if (!this.targetGridCell || typeof this.targetGridCell.col !== 'number') return null;

        const { col, row } = this.targetGridCell;

        // Perform the same checks as actual placement:
        if (!isTargetWithinRange(this, this.targetWorldPos)) return null; // Must be in range
        const targetBlockType = WorldData.getBlockType(col, row);
        const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);
        if (!canPlaceHere) return null; // Target must be empty (or water if allowed)
        if (this.checkPlacementOverlap(col, row)) return null; // Cannot place overlapping player
        if (!hasSolidNeighbor(col, row)) return null; // Must have adjacent support

        // If all checks pass, determine the block type and color
        const materialType = this.selectedItem;
        const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[materialType];
        if (blockTypeToPlace === undefined) return null; // Invalid material mapping
        const blockColor = Config.BLOCK_COLORS[blockTypeToPlace];
        if (!blockColor) return null; // No color defined for this block type

        // Return information needed for drawing
        return { col: col, row: row, color: blockColor };
    }

    /**
     * Draws the player character, held weapon visual, and attack hitbox/ghost block if applicable.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    draw(ctx) {
        if (!ctx) {
            console.error("Player.draw: Rendering context not provided!");
            return;
        }

        // Handle invulnerability flashing (draw player only on even intervals)
        let shouldDrawPlayer = true;
        if (this.isInvulnerable) {
            // Simple flash effect: draw every other 100ms interval
            shouldDrawPlayer = Math.floor(performance.now() / 100) % 2 === 0;
        }

        // Draw Player Body
        if (shouldDrawPlayer) {
            ctx.fillStyle = this.color;
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

            // Draw Held Weapon Visual (if weapon equipped and not currently attacking)
            if (!this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
                ctx.save(); // Save context state before transformations

                const playerCenterX = this.x + this.width / 2;
                const playerCenterY = this.y + this.height / 2;
                let weaponConfig = Config.ITEM_CONFIG[this.selectedItem];
                let visualOffsetX = 0; // Distance from player center to weapon visual pivot

                // Determine offset based on weapon type (adjust as needed for visuals)
                if (this.selectedItem === Config.WEAPON_TYPE_SWORD) visualOffsetX = this.width * 0.6;
                else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) visualOffsetX = this.width * 0.7;
                else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) visualOffsetX = this.width * 0.5;

                if (weaponConfig) {
                    const weaponWidth = weaponConfig.width * 0.8; // Slightly smaller visual representation
                    const weaponHeight = weaponConfig.height * 0.8;
                    const weaponColor = weaponConfig.color;

                    // Calculate angle towards the target mouse position
                    const targetDeltaX = this.targetWorldPos.x - playerCenterX;
                    const targetDeltaY = this.targetWorldPos.y - playerCenterY;
                    const angle = Math.atan2(targetDeltaY, targetDeltaX); // Angle in radians

                    // Calculate position for the weapon visual based on angle and offset
                    const weaponPosX = playerCenterX + Math.cos(angle) * visualOffsetX;
                    const weaponPosY = playerCenterY + Math.sin(angle) * visualOffsetX; // Keep offset along the same axis

                    // Apply transformations: translate to position, rotate
                    ctx.translate(weaponPosX, weaponPosY);
                    ctx.rotate(angle); // Rotate context to point weapon towards target

                    // Draw the weapon centered at the new (0,0) relative origin
                    ctx.fillStyle = weaponColor;
                    ctx.fillRect(-weaponWidth / 2, -weaponHeight / 2, weaponWidth, weaponHeight);
                }
                ctx.restore(); // Restore context state (removes translation/rotation)
            }
        } // End if(shouldDrawPlayer)

        // Draw Attack Hitbox Visual (if currently attacking with a weapon)
        if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
            const hitbox = this.getAttackHitbox(); // Calculate current hitbox position/size
            if (hitbox) {
                // Determine hitbox color based on weapon
                let hitboxColor = Config.PLAYER_SWORD_ATTACK_COLOR; // Default
                if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) hitboxColor = Config.PLAYER_SPEAR_ATTACK_COLOR;
                else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) hitboxColor = Config.PLAYER_SHOVEL_ATTACK_COLOR;

                // Draw the semi-transparent hitbox rectangle
                ctx.fillStyle = hitboxColor;
                ctx.fillRect(Math.floor(hitbox.x), Math.floor(hitbox.y), Math.ceil(hitbox.width), Math.ceil(hitbox.height));
            }
        }
    }

    /**
     * Draws the semi-transparent ghost block preview if placement is valid.
     * @param {CanvasRenderingContext2D} ctx - The drawing context.
     */
    drawGhostBlock(ctx) {
        if (!ctx) return; // Don't draw if no context

        const ghostInfo = this.getGhostBlockInfo(); // Check if/where ghost should be drawn

        if (ghostInfo) {
            // Calculate pixel coordinates from grid coordinates
            const ghostX = ghostInfo.col * Config.BLOCK_WIDTH;
            const ghostY = ghostInfo.row * Config.BLOCK_HEIGHT;

            ctx.save(); // Save context state before changing alpha

            // Set alpha and color for the ghost block
            ctx.globalAlpha = Config.GHOST_BLOCK_ALPHA; // Use config value for transparency
            ctx.fillStyle = ghostInfo.color;

            // Draw the semi-transparent rectangle
            ctx.fillRect(
                Math.floor(ghostX),
                Math.floor(ghostY),
                Math.ceil(Config.BLOCK_WIDTH),  // Use ceil for width/height for pixel snapping
                Math.ceil(Config.BLOCK_HEIGHT)
            );

            ctx.restore(); // Restore context state (resets globalAlpha)
        }
    }

    /**
     * Applies damage to the player, handles invulnerability, and triggers death.
     * @param {number} amount - The amount of damage to take.
     */
    takeDamage(amount) {
        // Ignore damage if already invulnerable or dead
        if (this.isInvulnerable || this.currentHealth <= 0) return;

        this.currentHealth -= amount;
        // console.log(`Player took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`);

        if (this.currentHealth <= 0) {
            this.currentHealth = 0; // Prevent negative health
            this.die(); // Trigger death sequence
        } else {
            // Apply invulnerability period after taking damage
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
        }
    }

    /** Handles the player's death state. */
    die() {
        console.log("Player died!");
        // Stop movement
        this.vx = 0;
        this.vy = 0;
        // Game over state transition is handled in the main game loop (main.js)
        // by checking player health. This function might be used for death animations later.
    }

    /** Resets the player's state completely for a new game or restart. */
    reset() {
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH; // Reset to initial health value
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY; // Ensure max health is correct
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.inventory = {}; // Clear inventory
        this.lastDirection = 1; // Reset facing direction
        this.hitEnemiesThisSwing = []; // Clear hit lists
        this.hitBlocksThisSwing = [];
        this.hasSword = false; // Reset weapon possession flags
        this.hasSpear = false;
        this.hasShovel = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Reset equipped item to unarmed
    }

    /** Resets only the player's position and physics state (e.g., after falling out). */
    resetPosition() {
        // console.log("Player position reset (fell out).");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false; // Reset physics state too
        this.isInWater = false;
        this.waterJumpCooldown = 0;
    }

    /**
     * Calculates the position and dimensions of the attack hitbox based on the equipped weapon and target direction.
     * @returns {object | null} Hitbox rectangle { x, y, width, height } or null if not attacking/no weapon.
     */
    getAttackHitbox() {
        // Cannot have a hitbox if not attacking or not using a weapon
        if (!this.isAttacking || !this.isWeaponSelected() || this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
            return null;
        }

        // Player center coordinates
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        // Target world coordinates (from mouse)
        const targetX = this.targetWorldPos.x;
        const targetY = this.targetWorldPos.y;
        // Vector from player center to target
        const dx = targetX - playerCenterX;
        const dy = targetY - playerCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy); // Distance to target

        // Get hitbox dimensions and reach offsets from config based on equipped weapon
        let hitboxWidth, hitboxHeight, reachX, reachY;
        switch (this.selectedItem) {
            case Config.WEAPON_TYPE_SWORD:
                hitboxWidth = Config.PLAYER_SWORD_ATTACK_WIDTH; hitboxHeight = Config.PLAYER_SWORD_ATTACK_HEIGHT;
                reachX = Config.PLAYER_SWORD_ATTACK_REACH_X; reachY = Config.PLAYER_SWORD_ATTACK_REACH_Y;
                break;
            case Config.WEAPON_TYPE_SPEAR:
                hitboxWidth = Config.PLAYER_SPEAR_ATTACK_WIDTH; hitboxHeight = Config.PLAYER_SPEAR_ATTACK_HEIGHT;
                reachX = Config.PLAYER_SPEAR_ATTACK_REACH_X; reachY = Config.PLAYER_SPEAR_ATTACK_REACH_Y;
                break;
            case Config.WEAPON_TYPE_SHOVEL:
                hitboxWidth = Config.PLAYER_SHOVEL_ATTACK_WIDTH; hitboxHeight = Config.PLAYER_SHOVEL_ATTACK_HEIGHT;
                reachX = Config.PLAYER_SHOVEL_ATTACK_REACH_X; reachY = Config.PLAYER_SHOVEL_ATTACK_REACH_Y;
                break;
            default: return null; // Should not happen if checks passed, but safety first
        }

        // Calculate hitbox center position
        let hitboxCenterX, hitboxCenterY;
        if (dist > 1e-6) { // If target is not exactly on player center, use normalized direction
            const normX = dx / dist; // Normalized direction vector X component
            const normY = dy / dist; // Normalized direction vector Y component
            // Position hitbox center along the direction vector based on weapon reach
            hitboxCenterX = playerCenterX + normX * reachX;
            // Position hitbox center vertically based on normalized direction and Y reach offset
            // Note: reachY is often 0 for simple horizontal reach, but allows vertical adjustment
            hitboxCenterY = playerCenterY + normY * reachX + reachY; // Example: Offset along direction vector *and* apply vertical offset
        } else {
            // Fallback: If target is too close, use last known facing direction
            hitboxCenterX = playerCenterX + this.lastDirection * reachX;
            hitboxCenterY = playerCenterY + reachY; // Apply Y offset regardless of direction
        }

        // Calculate top-left corner of the hitbox from its center and dimensions
        const hitboxX = hitboxCenterX - hitboxWidth / 2;
        const hitboxY = hitboxCenterY - hitboxHeight / 2;

        return { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };
    }

    /**
     * Handles picking up an item. Updates inventory or weapon possession state.
     * @param {Item} item - The item object being picked up.
     * @returns {boolean} True if the item was successfully picked up, false otherwise.
     */
    pickupItem(item) {
        if (!item || !item.type) return false; // Invalid item
        let pickedUp = false;

        // Check item type and update player state accordingly
        if (item.type === Config.WEAPON_TYPE_SWORD) {
            if (!this.hasSword) { this.hasSword = true; console.log("Player picked up the sword!"); pickedUp = true; }
        } else if (item.type === Config.WEAPON_TYPE_SPEAR) {
            if (!this.hasSpear) { this.hasSpear = true; console.log("Player picked up the spear!"); pickedUp = true; }
        } else if (item.type === Config.WEAPON_TYPE_SHOVEL) {
            if (!this.hasShovel) { this.hasShovel = true; console.log("Player picked up the shovel!"); pickedUp = true; }
        } else if (Config.INVENTORY_MATERIALS.includes(item.type)) {
            // Add material to inventory, initializing count if necessary
            this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
            // console.log(`Player picked up ${item.type}. Count: ${this.inventory[item.type]}`);
            pickedUp = true;
        } else {
            // console.warn(`Player encountered unknown item type: ${item.type}`);
        }

        // If a weapon was just picked up, equip it immediately ONLY if player is currently unarmed
        if (pickedUp && this.isWeaponType(item.type) && this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
            this.equipItem(item.type); // Equip the newly picked up weapon
        }
        return pickedUp; // Return whether the item was processed
    }

    /** Checks if the player possesses a specific weapon type. */
    hasWeapon(weaponType) {
        switch (weaponType) {
            case Config.WEAPON_TYPE_SWORD: return this.hasSword;
            case Config.WEAPON_TYPE_SPEAR: return this.hasSpear;
            case Config.WEAPON_TYPE_SHOVEL: return this.hasShovel;
            default: return false; // Not a known weapon type
        }
    }

    /**
     * Equips an item (weapon or material) if the player possesses it / has stock.
     * @param {string} itemType - The type of item to equip.
     */
    equipItem(itemType) {
        let canEquip = false;
        // Check if the item type is valid and if the player can equip it
        if (itemType === Config.WEAPON_TYPE_UNARMED) {
            canEquip = true; // Can always switch to unarmed
        } else if (this.isWeaponType(itemType)) {
            canEquip = this.hasWeapon(itemType); // Check possession for weapons
        } else if (Config.INVENTORY_MATERIALS.includes(itemType)) {
            canEquip = (this.inventory[itemType] || 0) > 0; // Check inventory count for materials
        }

        // Equip the item if possible and not already equipped
        if (canEquip && this.selectedItem !== itemType) {
            this.selectedItem = itemType;
            this.isAttacking = false; // Cancel current attack animation on switch
            this.attackTimer = 0;     // Reset attack timer
            // console.log(`Player equipped ${itemType}.`); // Optional log
            // UI update to show the new selection happens in the main loop via updatePlayerInfo
        }
        // else if (!canEquip) { console.log(`Cannot equip ${itemType}.`); } // Log if needed
        // else { /* console.log(`Already equipped ${itemType}.`); */ } // Optional log
    }

    /** Decrements the inventory count for a given material type. */
    decrementInventory(itemType) {
        if (Config.INVENTORY_MATERIALS.includes(itemType) && this.inventory[itemType] > 0) {
            this.inventory[itemType]--;
            // If the count reaches 0 and this material was the selected item, switch to unarmed
            if (this.inventory[itemType] === 0 && this.selectedItem === itemType) {
                 this.equipItem(Config.WEAPON_TYPE_UNARMED); // Switch to unarmed
                 // console.log(`${itemType} depleted, switching to unarmed.`);
            }
            return true; // Decrement successful
        }
        return false; // Material not found or count already 0
    }

    // --- Collision Tracking Helpers ---
    /** Checks if a specific enemy has already been hit during the current attack swing. */
    hasHitEnemyThisSwing(enemy) { return this.hitEnemiesThisSwing.includes(enemy); }
    /** Registers an enemy as hit during the current swing to prevent multiple hits. */
    registerHitEnemy(enemy) { if (!this.hasHitEnemyThisSwing(enemy)) { this.hitEnemiesThisSwing.push(enemy); } }
    /** Checks if a specific block has already been hit during the current attack swing. */
    hasHitBlockThisSwing(col, row) { const blockKey = `${col},${row}`; return this.hitBlocksThisSwing.includes(blockKey); }
    /** Registers a block as hit during the current swing. */
    registerHitBlock(col, row) { const blockKey = `${col},${row}`; if (!this.hasHitBlockThisSwing(col, row)) { this.hitBlocksThisSwing.push(blockKey); } }

    // --- Simple Getters for Player State ---
    getRect() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    getPosition() { return { x: this.x, y: this.y }; }
    getCurrentHealth() { return this.currentHealth; }
    getMaxHealth() { return this.maxHealth; }
    getInventory() { return this.inventory; }
    getShovelStatus() { return this.hasShovel; }
    getSwordStatus() { return this.hasSword; }
    getSpearStatus() { return this.hasSpear; }
    getCurrentlySelectedItem() { return this.selectedItem; }
    /** Returns the selected material type if a material is selected, otherwise null. Used by UI. */
     getActiveInventoryMaterial() {
         return this.isMaterialSelected() ? this.selectedItem : null;
     }
     /** Returns the selected weapon type if a weapon is selected, otherwise null. Used by UI. */
     getActiveWeaponType() {
         return this.isWeaponSelected() ? this.selectedItem : null;
     }


    // --- Get Damage Output Based on Equipped Item ---
    /** Returns the damage dealt to enemies by the currently equipped weapon. */
    getCurrentAttackDamage() {
        if (!this.isWeaponSelected()) return 0; // No damage if unarmed or material selected
        switch (this.selectedItem) {
            case Config.WEAPON_TYPE_SWORD: return Config.PLAYER_SWORD_ATTACK_DAMAGE;
            case Config.WEAPON_TYPE_SPEAR: return Config.PLAYER_SPEAR_ATTACK_DAMAGE;
            case Config.WEAPON_TYPE_SHOVEL: return Config.PLAYER_SHOVEL_ATTACK_DAMAGE; // Shovel does low enemy damage
            default: return 0;
        }
    }
    /** Returns the damage dealt to blocks by the currently equipped item (usually tools). */
    getCurrentBlockDamage() {
        // Only certain items damage blocks
        if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) return Config.PLAYER_SHOVEL_BLOCK_DAMAGE;
        // Add other tools like pickaxes here later
        // Weapons (Sword, Spear) and unarmed do 0 block damage
        return 0;
    }

    // --- Type Check Helpers ---
    /** Checks if an item type string corresponds to a known weapon type. */
    isWeaponType(itemType) {
         return [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL].includes(itemType);
    }
    /** Checks if the currently selected item is a weapon (and not unarmed). */
    isWeaponSelected() {
        return this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.isWeaponType(this.selectedItem);
    }
    /** Checks if the currently selected item is a placeable material. */
    isMaterialSelected() {
        return Config.INVENTORY_MATERIALS.includes(this.selectedItem);
    }

    /** Checks if placing a block at target coordinates would overlap the player's bounding box. */
    checkPlacementOverlap(targetCol, targetRow) {
        // Check for invalid grid coordinates first
        if (targetCol < 0 || targetRow < 0 || targetCol >= Config.GRID_COLS || targetRow >= Config.GRID_ROWS) return true; // Overlap if placing out of bounds

        // Define the rectangle for the block to be placed
        const blockRect = {
            x: targetCol * Config.BLOCK_WIDTH,
            y: targetRow * Config.BLOCK_HEIGHT,
            width: Config.BLOCK_WIDTH,
            height: Config.BLOCK_HEIGHT
        };
        // Get the player's current rectangle
        const playerRect = this.getRect();

        // Standard Axis-Aligned Bounding Box (AABB) overlap check
        const overlap = playerRect.x < blockRect.x + blockRect.width &&
                        playerRect.x + playerRect.width > blockRect.x &&
                        playerRect.y < blockRect.y + blockRect.height &&
                        playerRect.y + playerRect.height > blockRect.y;
        return overlap; // Return true if overlapping, false otherwise
    }

    // --- Methods for UI Interaction (called by UI event listeners) ---
    /** Equips a material if available. Called when a material slot is clicked in the UI. */
    setActiveInventoryMaterial(materialType) {
         if (Config.INVENTORY_MATERIALS.includes(materialType)) {
             // Check if player actually has the material before equipping
             if ((this.inventory[materialType] || 0) > 0) {
                 this.equipItem(materialType); // Use the main equip logic
             } else {
                 // console.log(`Cannot select ${materialType}, count is 0.`);
                 // Optionally switch to unarmed if trying to select an empty slot?
                 // this.equipItem(Config.WEAPON_TYPE_UNARMED);
             }
         } else {
             console.warn(`Attempted to set invalid material type via UI: ${materialType}`);
         }
     }

     /** Equips a weapon if possessed. Called when a weapon slot is clicked in the UI. */
     setActiveWeapon(weaponType) {
         if (this.isWeaponType(weaponType)) {
             if (this.hasWeapon(weaponType)) {
                 this.equipItem(weaponType); // Use the main equip logic
             } else {
                 // console.log(`Cannot select ${weaponType}, player does not possess it.`);
             }
         } else {
             console.warn(`Attempted to set invalid weapon type via UI: ${weaponType}`);
         }
     }

} // End of Player Class