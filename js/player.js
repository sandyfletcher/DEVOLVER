// -----------------------------------------------------------------------------
// root/js/player.js - Player Character Class
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js'; // Import GridCollision for physics and solid checks
import { hasSolidNeighbor } from './utils/gridCollision.js'; // Import the moved helper
import * as WorldManager from './worldManager.js';
import * as WorldData from './utils/worldData.js';

export class Player {
    constructor(x, y, width, height, color) {
        // Initialize all properties with default or starting values
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

        // Initial position validation
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Player CONSTRUCTOR ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }

    /**
     * Updates the player's state based on input, physics, and environment interactions.
     * This method orchestrates the update process by calling private helper methods.
     * @param {number} dt - Delta time (time elapsed since last frame in seconds).
     * @param {object} inputState - Current input state (left, right, jump, attack flags).
     * @param {object} targetWorldPos - Current mouse position in world coordinates {x, y}.
     * @param {object} targetGridCell - Current grid cell under mouse {col, row}.
     */
    update(dt, inputState, targetWorldPos, targetGridCell) {
        // Ensure dt is a valid number
        if (typeof dt !== 'number' || isNaN(dt) || dt < 0) {
            console.warn("Player Update: Invalid delta time.", dt);
            return;
        }
        // Ensure inputState is a valid object
        if (typeof inputState !== 'object' || inputState === null) {
             console.warn("Player Update: Invalid input state object.", inputState);
             inputState = {}; // Use an empty object to prevent errors
        }
         // Ensure target positions are valid objects with numbers
        if (typeof targetWorldPos !== 'object' || targetWorldPos === null || typeof targetWorldPos.x !== 'number' || typeof targetWorldPos.y !== 'number' || isNaN(targetWorldPos.x) || isNaN(targetWorldPos.y)) {
             console.warn("Player Update: Invalid targetWorldPos object.", targetWorldPos);
             this.targetWorldPos = { x: this.x + this.width / 2 + this.lastDirection * 50, y: this.y + this.height / 2 }; // Default to slightly in front of player
         } else {
              this.targetWorldPos = targetWorldPos;
         }
         if (typeof targetGridCell !== 'object' || targetGridCell === null || typeof targetGridCell.col !== 'number' || typeof targetGridCell.row !== 'number' || isNaN(targetGridCell.col) || isNaN(targetGridCell.row)) {
             console.warn("Player Update: Invalid targetGridCell object.", targetGridCell);
             this.targetGridCell = GridCollision.worldToGridCoords(this.targetWorldPos.x, this.targetWorldPos.y); // Calculate from valid world pos
         } else {
             this.targetGridCell = targetGridCell;
         }

        // Update Player Facing Direction based on Target Position relative to player center
        const playerCenterX = this.x + this.width / 2;
        const targetDeltaX = this.targetWorldPos.x - playerCenterX;
        // Only update direction if the target isn't extremely close horizontally to avoid rapid flipping
        if (Math.abs(targetDeltaX) > 1) { // Use a small threshold
             this.lastDirection = Math.sign(targetDeltaX);
        }

        // Update environment state (water)
        this.isInWater = GridCollision.isEntityInWater(this);
        // Reset water jump cooldown if just exited water (for non-swimmers)
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0;
        }

        // Update timers (attack, invulnerability, water jump)
        this._updateTimers(dt);

        // Handle Player Input (movement, jump, attack, placement)
        this._handleInput(dt, inputState);

        // Apply Physics (gravity, damping, velocity calculation, collision resolution)
        this._applyPhysics(dt);

        // Check Screen Boundaries and Falling Out
        this._checkBoundaries();

        // Ensure health doesn't go negative
        this.currentHealth = Math.max(0, this.currentHealth);
    }

    // --- Private Update Helper Methods ---

    /** Updates various timers for cooldowns and effects. */
    _updateTimers(dt) {
        if (this.attackCooldown > 0) {
             this.attackCooldown -= dt;
             if (this.attackCooldown < 0) this.attackCooldown = 0; // Ensure non-negative
        }
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
        if (this.waterJumpCooldown > 0) {
             this.waterJumpCooldown -= dt;
             if (this.waterJumpCooldown < 0) this.waterJumpCooldown = 0; // Ensure non-negative
        }
    }

    /** Handles player input and sets desired movement/action flags/velocities. */
    _handleInput(dt, inputState) {
        this._handleMovement(dt, inputState);
        // Handle attack/placement input - prioritize placement if material is selected
        if (inputState.attack && this.isMaterialSelected()) {
             this._handlePlacement(inputState); // Placement attempts consume attack input
        } else if (inputState.attack) {
             this._handleAttack(inputState); // Weapon attack attempts consume attack input
        }
         // Jump input is handled within _handleMovement now
         // _handleJumping(inputState); // Now integrated into _handleMovement
    }

    /** Handles horizontal movement and jumping/swimming input. */
     _handleMovement(dt, inputState) {
         const currentMaxSpeedX = this.isInWater ? Config.PLAYER_MAX_SPEED_X * Config.WATER_MAX_SPEED_FACTOR : Config.PLAYER_MAX_SPEED_X;
         const currentAcceleration = this.isInWater ? Config.PLAYER_MOVE_ACCELERATION * Config.WATER_ACCELERATION_FACTOR : Config.PLAYER_MOVE_ACCELERATION;

         let targetVx = 0; // Target horizontal velocity based on input
         if (inputState.left && !inputState.right) {
             targetVx = -currentMaxSpeedX;
         } else if (inputState.right && !inputState.left) {
             targetVx = currentMaxSpeedX;
         }

         // Apply acceleration towards the target velocity
         if (targetVx !== 0) {
             // Simple acceleration: move current velocity towards target velocity
             const acceleration = Math.sign(targetVx) * currentAcceleration;
             this.vx += acceleration * dt;
             // Clamp velocity to max speed for current environment, respecting direction
             this.vx = Math.max(-currentMaxSpeedX, Math.min(currentMaxSpeedX, this.vx));
         } else {
             // Apply friction if on ground and not in water
             if (!this.isInWater && this.isOnGround) {
                 const frictionFactor = Math.pow(Config.PLAYER_FRICTION_BASE, dt);
                 this.vx *= frictionFactor;
             }
             // Stop completely if velocity becomes very small
             if (Math.abs(this.vx) < 1) { // Use a small threshold to prevent jittering
                 this.vx = 0;
             }
         }

         // Apply horizontal water damping regardless of input if in water
         if (this.isInWater) {
             const horizontalDampingFactor = Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt);
             this.vx *= horizontalDampingFactor;
         }


         // --- Jumping / Swimming Input ---
         // Only respond to jump input if player is not already in the middle of a jump/stroke or on cooldown
         if (inputState.jump) { // Check if the jump button is pressed
             let jumpTriggered = false;
             if (this.isOnGround && !this.isInWater) {
                 // Perform a normal jump from the ground
                 this.vy = -Config.PLAYER_JUMP_VELOCITY;
                 this.isOnGround = false; // Player is no longer on the ground
                 jumpTriggered = true;
             } else if (this.isInWater && this.waterJumpCooldown <= 0) {
                  // Perform a swim stroke (upward impulse) if in water and off cooldown
                  this.vy = -Config.WATER_SWIM_VELOCITY; // Apply upward velocity
                  this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION; // Start cooldown
                  this.isOnGround = false; // Ensure not considered on ground when swimming up
                  jumpTriggered = true;
             }

             // Consume the jump input immediately upon successful jump/stroke start
             if (jumpTriggered) {
                 inputState.jump = false;
             }
             // If jump input is active but couldn't trigger (e.g., airborne, on cooldown), it remains true until released or conditions are met.
         }
     }

    /** Handles attack input and triggers weapon swing if possible. */
    _handleAttack(inputState) {
        // Execute only if:
        // - attack input is active
        // - a weapon is selected (not unarmed or a material)
        // - attack is not on cooldown
        // - player is not already in the middle of an attack swing
        if (this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.attackCooldown <= 0 && !this.isAttacking) {
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
             // Consume the attack input after successfully starting the attack
            inputState.attack = false; // THIS IS CRITICAL TO PREVENT MULTIPLE SWINGS FROM ONE CLICK/TAP
        } else if (inputState.attack) {
            // If attack input is active but couldn't trigger (e.g., on cooldown, unarmed), consume it.
             // This prevents the attack flag from staying true if the button is held down during cooldown.
            inputState.attack = false;
        }
    }

    /** Handles placement input and attempts to place a block if possible. */
    _handlePlacement(inputState) {
        // Assumes attack input is active and a material is selected (checked in _handleInput)
        const materialType = this.selectedItem; // Get the selected material

        // 1. Check if player has the material in inventory
        if ((this.inventory[materialType] || 0) > 0) {
            // 2. Check if the target location is within interaction range using the private helper
            if (this._isTargetWithinRange(this.targetWorldPos)) {
                // 3. Check if the target grid cell is valid for placement
                const targetCol = this.targetGridCell.col;
                const targetRow = this.targetGridCell.row;
                const targetBlockType = WorldData.getBlockType(targetCol, targetRow);

                // Can place in Air, or in Water if config allows
                const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);

                if (canPlaceHere) {
                    // 4. Check if placing the block would overlap the player
                    if (!this.checkPlacementOverlap(targetCol, targetRow)) {
                        // 5. Check if the target cell has an adjacent solid block for support (using the imported helper)
                        if (hasSolidNeighbor(targetCol, targetRow)) {
                            // ALL CHECKS PASSED - PLACE THE BLOCK!
                            const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[materialType];
                            if (blockTypeToPlace !== undefined) {
                                // Attempt to place the block using WorldManager's player-specific method
                                if (WorldManager.placePlayerBlock(targetCol, targetRow, blockTypeToPlace)) {
                                    this.decrementInventory(materialType); // Reduce inventory count
                                    // Placement successful, attack input will be consumed below
                                } // else: Placement failed at the WorldManager level (e.g., out of bounds, already solid)
                            } // else: No block type mapping found for material
                        } // else: No adjacent support.
                    } // else: Player overlap.
                } // else: Target cell not empty/placeable.
            } // else: Out of range.
        } // else: Not enough material.

        // Consume attack input if a material was selected, regardless of placement success
        inputState.attack = false; // THIS IS CRITICAL FOR PLACEMENT
    }


    /** Applies gravity, damping, and resolves collisions with the grid. */
    _applyPhysics(dt) {
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
        // Damping factors approach 0 as dt increases, causing velocity reduction. Factor of 1 means no damping.
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;

        // --- Apply Gravity ---
        // Apply gravity if the player is not considered on the ground
        if (!this.isOnGround) {
            this.vy += currentGravity * dt;
        } else if (this.vy > 0) {
            // If player is on ground but has slight downward velocity (e.g., from previous frame), reset it
            // Use a small threshold to avoid micro-adjustments
            if (this.vy > 0.1) this.vy = 0;
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

        // --- Grid Collision Detection and Resolution ---
        // Use the utility function to handle collisions with the world grid
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);

        // Update ground status based on collision result
        this.isOnGround = collisionResult.isOnGround;

        // Zero out velocity component if a collision occurred on that axis, UNLESS stepped up horizontally
        if (collisionResult.collidedX && !collisionResult.didStepUp) {
             this.vx = 0;
        }
        // Only zero vy if a Y collision occurred and velocity was significant, prevents micro-bouncing
        if (collisionResult.collidedY && Math.abs(this.vy) > 0.1) {
             this.vy = 0;
        }

         // If player stepped up, adjust vertical position slightly if they ended up *just* above ground
         // This is a final check to ensure they land cleanly if the step-up put them slightly off the ground surface.
         if (collisionResult.didStepUp && !this.isOnGround) {
            const checkDist = 2.0; // Check a few pixels below
            const yBelow = this.y + this.height + checkDist;
            const rowBelow = Math.floor(yBelow / Config.BLOCK_HEIGHT);
            const colCheck = Math.floor((this.x + this.width/2) / Config.BLOCK_WIDTH); // Check center column
            if (GridCollision.isSolid(colCheck, rowBelow)) {
                const groundSurfaceY = rowBelow * Config.BLOCK_HEIGHT;
                 if ((this.y + this.height) < groundSurfaceY + checkDist) { // If slightly above ground surface
                     this.y = groundSurfaceY - this.height; // Snap down
                     this.isOnGround = true;
                     this.vy = 0;
                 }
            }
         }

    }

    /** Checks and enforces screen boundaries and falling out of world. */
    _checkBoundaries() {
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
             // this.takeDamage(10); // Example damage amount
        }
    }

    // --- Helper Methods ---

    /**
     * Checks if a target world position is within the player's interaction range.
     * Made this a private method as it's specific to the player instance.
     * @param {object} targetWorldPos - The target world position {x, y}.
     * @returns {boolean} True if target is within range.
     */
    _isTargetWithinRange(targetWorldPos) {
        if (!targetWorldPos) return false;
        // Ensure player position and target position are valid numbers
         if (typeof this.x !== 'number' || typeof this.y !== 'number' ||
             typeof this.width !== 'number' || typeof this.height !== 'number' ||
             typeof targetWorldPos.x !== 'number' || typeof targetWorldPos.y !== 'number' ||
             isNaN(this.x) || isNaN(this.y) || isNaN(this.width) || isNaN(this.height) ||
             isNaN(targetWorldPos.x) || isNaN(targetWorldPos.y)) {
              console.warn("_isTargetWithinRange: Invalid player or target data.", this, targetWorldPos);
              return false;
         }
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        const dx = targetWorldPos.x - playerCenterX;
        const dy = targetWorldPos.y - playerCenterY;
        const distSq = dx * dx + dy * dy;
        // Compare squared distance to avoid square root calculation
        return distSq <= Config.PLAYER_INTERACTION_RANGE_SQ;
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

    // --- Drawing Methods ---

    /**
     * Calculates information needed to draw the placement ghost block preview.
     * @returns {object | null} Object { col, row, color } or null if placement is invalid.
     */
    getGhostBlockInfo() {
        // Can only show ghost if a material is selected
        if (!this.isMaterialSelected()) return null;
        // Need valid target grid cell data
        if (!this.targetGridCell || typeof this.targetGridCell.col !== 'number' || typeof this.targetGridCell.row !== 'number' || isNaN(this.targetGridCell.col) || isNaN(this.targetGridCell.row)) return null;

        const { col, row } = this.targetGridCell;

        // Perform the same checks as actual placement:
        if (!this._isTargetWithinRange(this.targetWorldPos)) return null; // Must be in range
        const targetBlockType = WorldData.getBlockType(col, row); // Handles out of bounds for block type
        // Cannot place out of bounds or if block type is null
        if (targetBlockType === null) return null;

        const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);
        if (!canPlaceHere) return null; // Target must be empty (or water if allowed)
        if (this.checkPlacementOverlap(col, row)) return null; // Cannot place overlapping player
        // Use the imported helper function
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
         // Ensure player coordinates are valid before drawing
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Player DRAW ERROR: Preventing draw due to NaN coordinates! x:${this.x}, y:${this.y}`);
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
                    ctx.fillRect(Math.floor(-weaponWidth / 2), Math.floor(-weaponHeight / 2), Math.ceil(weaponWidth), Math.ceil(weaponHeight));
                }
                ctx.restore(); // Restore context state (removes translation/rotation)
            }
        } // End if(shouldDrawPlayer)

        // Draw Attack Hitbox Visual (if currently attacking with a weapon)
        if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
            const hitbox = this.getAttackHitbox(); // Calculate current hitbox position/size
            if (hitbox) {
                 // Ensure hitbox coordinates and dimensions are valid before drawing
                 if (typeof hitbox.x === 'number' && typeof hitbox.y === 'number' &&
                     typeof hitbox.width === 'number' && typeof hitbox.height === 'number' &&
                     !isNaN(hitbox.x) && !isNaN(hitbox.y) && !isNaN(hitbox.width) && !isNaN(hitbox.height))
                 {
                    // Determine hitbox color based on weapon
                    let hitboxColor = Config.PLAYER_SWORD_ATTACK_COLOR; // Default
                    if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) hitboxColor = Config.PLAYER_SPEAR_ATTACK_COLOR;
                    else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) hitboxColor = Config.PLAYER_SHOVEL_ATTACK_COLOR;

                    // Draw the semi-transparent hitbox rectangle
                    ctx.fillStyle = hitboxColor;
                    ctx.fillRect(Math.floor(hitbox.x), Math.floor(hitbox.y), Math.ceil(hitbox.width), Math.ceil(hitbox.height));
                 } else {
                      console.warn(`Player.draw: Invalid hitbox coordinates/dimensions for ${this.selectedItem}`, hitbox);
                 }
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

             // Ensure ghost coordinates are valid before drawing
             if (typeof ghostX !== 'number' || typeof ghostY !== 'number' || isNaN(ghostX) || isNaN(ghostY)) {
                 console.warn("Player.drawGhostBlock: Invalid ghost coordinates.", ghostX, ghostY);
                 return;
             }

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


    // --- Combat and Health Methods ---

    /**
     * Applies damage to the player, handles invulnerability, and triggers death.
     * @param {number} amount - The amount of damage to take.
     */
    takeDamage(amount) {
         // Ensure amount is a valid number
         if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
             // console.warn("Player takeDamage: Invalid damage amount.", amount); // Keep console less noisy
             return;
         }

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
        // Stop movement
        this.vx = 0;
        this.vy = 0;
        // Game over state transition is handled in the main game loop (main.js)
        // by checking player health. This function might be used for death animations later.
    }

    // Calculates the position and dimensions of the attack hitbox based on the equipped weapon and target direction.
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
        // Use a small epsilon for distance check to avoid division by zero or erratic behavior when mouse is exactly on player center
        const E_EPSILON = 1e-6; // Define locally or import if needed elsewhere
        if (dist > E_EPSILON) {
            const normX = dx / dist; // Normalized direction vector X component
            const normY = dy / dist; // Normalized direction vector Y component
            // Position hitbox center along the direction vector based on horizontal reach (reachX)
            hitboxCenterX = playerCenterX + normX * reachX;
            // Position hitbox center vertically based on the fixed vertical offset (reachY)
            hitboxCenterY = playerCenterY + reachY; // Keep offset along the same vertical axis
        } else {
            // Fallback: If target is too close, use last known facing direction for X, and fixed Y offset
            hitboxCenterX = playerCenterX + this.lastDirection * reachX;
            hitboxCenterY = playerCenterY + reachY;
        }
        // Calculate top-left corner of the hitbox from its center and dimensions
        const hitboxX = hitboxCenterX - hitboxWidth / 2;
        const hitboxY = hitboxCenterY - hitboxHeight / 2;

        return { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };
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

    // --- Inventory & Item Methods ---

    // Handles picking up an item. Updates inventory or weapon possession state.
    pickupItem(item) {
        if (!item || !item.type) return false; // Invalid item
        let pickedUp = false;
        // Check item type and update player state accordingly
        if (item.type === Config.WEAPON_TYPE_SWORD) {
            if (!this.hasSword) { this.hasSword = true; /* console.log("Player picked up the sword!"); */ pickedUp = true; } // Keep logs quieter
        } else if (item.type === Config.WEAPON_TYPE_SPEAR) {
            if (!this.hasSpear) { this.hasSpear = true; /* console.log("Player picked up the spear!"); */ pickedUp = true; }
        } else if (item.type === Config.WEAPON_TYPE_SHOVEL) {
            if (!this.hasShovel) { this.hasShovel = true; /* console.log("Player picked up the shovel!"); */ pickedUp = true; }
        } else if (Config.INVENTORY_MATERIALS.includes(item.type)) {
            // Add material to inventory, initializing count if necessary
            this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
            // console.log(`Player picked up ${item.type}. Count: ${this.inventory[item.type]}`); // Keep logs quieter
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
            // console.log(`Player equipped ${itemType}.`); // Optional log
            // Cancel current action states on equip
            this.isAttacking = false;
            this.attackTimer = 0;
            this.attackCooldown = 0; // Or maybe keep cooldown? Let's reset for now.
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
                 // console.log(`${itemType} depleted, switching to unarmed.`); // Keep logs quieter
            }
            return true; // Decrement successful
        }
        return false; // Material not found or count already 0
    }

    // --- State/Type Check Helpers ---
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


    // --- Getters for Player State and Properties ---
    getRect() {
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         const safeWidth = (typeof this.width === 'number' && !isNaN(this.width)) ? this.width : 1;
         const safeHeight = (typeof this.height === 'number' && !isNaN(this.height)) ? this.height : 1;
         return { x: safeX, y: safeY, width: safeWidth, height: safeHeight };
    }
    getPosition() {
         const safeX = (typeof this.x === 'number' && !isNaN(this.x)) ? this.x : 0;
         const safeY = (typeof this.y === 'number' && !isNaN(this.y)) ? this.y : 0;
         return { x: safeX, y: safeY };
    }
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

    // --- Methods for UI Interaction (called by UI event listeners) ---
    /** Equips a material if available. Called when a material slot is clicked in the UI. */
    setActiveInventoryMaterial(materialType) {
         if (Config.INVENTORY_MATERIALS.includes(materialType)) {
             // Check if player actually has the material before equipping
             if ((this.inventory[materialType] || 0) > 0) {
                 this.equipItem(materialType); // Use the main equip logic
             } else {
                 // console.log(`Cannot select ${materialType}, count is 0.`); // Keep logs quieter
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
                 // console.log(`Cannot select ${weaponType}, player does not possess it.`); // Keep logs quieter
             }
         } else {
             console.warn(`Attempted to set invalid weapon type via UI: ${weaponType}`);
         }
     }

    // --- Reset Methods ---
    /** Resets the player's state completely for a new game or restart. */
    reset() {
        console.log("Resetting player state...");
        // Position & Physics
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        // Health
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        // Combat
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        // Inventory & Weapons
        this.inventory = {}; // Clear inventory
        this.hasSword = false; // Reset weapon possession flags
        this.hasSpear = false;
        this.hasShovel = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Reset equipped item to unarmed

        // Targeting
        this.lastDirection = 1; // Reset facing direction
        // targetWorldPos and targetGridCell will be updated by main loop on the first frame
        // Initial position validation after reset
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Player RESET ERROR: NaN final coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }

    // --- Resets only the player's position and physics state (e.g., after falling out) ---
    resetPosition() {
        // console.log("Player position reset (fell out)."); // Keep logs quieter
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false; // Reset physics state too
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.isAttacking = false; // Cancel any active attack if falling out
        this.attackTimer = 0;
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];

        // Initial position validation after reset
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Player RESET POSITION ERROR: NaN final coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }

} // End of Player Class