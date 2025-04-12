// -----------------------------------------------------------------------------
// root/js/player.js - Player Character Class
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';
import * as WorldManager from './worldManager.js'; // Needed to place blocks
import * as WorldData from './utils/worldData.js'; // Needed to check target cell type

// Helper function to check if a world position is within player's interaction range
// (Moved here from main.js for better encapsulation, or could be in a utils file)
function isTargetWithinRange(player, targetWorldPos) {
    if (!player || !targetWorldPos) return false;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const dx = targetWorldPos.x - playerCenterX;
    const dy = targetWorldPos.y - playerCenterY;
    const distSq = dx * dx + dy * dy;
    return distSq <= Config.PLAYER_INTERACTION_RANGE_SQ;
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
        this.waterJumpCooldown = 0; // water jump cooldown state
        // --- Weapon & Inventory State ---
        this.hasShovel = false;
        this.hasSword = false;
        this.hasSpear = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Start unarmed
        this.inventory = {};
        // --- Combat State ---
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        // --- Health State ---
        this.maxHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.currentHealth = Config.PLAYER_INITIAL_HEALTH;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        // --- Targeting State ---
        this.targetWorldPos = { x: 0, y: 0 };
        this.targetGridCell = { col: 0, row: 0 };
        this.lastDirection = 1; // Start facing right
    }

    // --- Update player state on input, physics, and grid collision ---
    update(dt, inputState, targetWorldPos, targetGridCell) {
        // Update targeting state from input
        this.targetWorldPos = targetWorldPos;
        this.targetGridCell = targetGridCell;

        // --- Update Player Facing Direction based on Target Position ---
        const playerCenterX = this.x + this.width / 2;
        const targetDeltaX = this.targetWorldPos.x - playerCenterX;
        // Only update direction if the target isn't extremely close horizontally
        if (Math.abs(targetDeltaX) > 1) { // Use a small threshold
             this.lastDirection = Math.sign(targetDeltaX);
        }
        // If target is directly above/below or very close, keep previous direction

        // --- 1. Update Water Status ---
        const wasInWater = this.isInWater; // Store previous state
        this.isInWater = GridCollision.isEntityInWater(this);
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0; // Reset jump cooldown if just exited water
        }

        // Get current physics params, modified against water parameters
        const currentGravity = this.isInWater ? Config.GRAVITY_ACCELERATION * Config.WATER_GRAVITY_FACTOR : Config.GRAVITY_ACCELERATION;
        const currentMaxSpeedX = this.isInWater ? Config.PLAYER_MAX_SPEED_X * Config.WATER_MAX_SPEED_FACTOR : Config.PLAYER_MAX_SPEED_X;
        const currentAcceleration = this.isInWater ? Config.PLAYER_MOVE_ACCELERATION * Config.WATER_ACCELERATION_FACTOR : Config.PLAYER_MOVE_ACCELERATION;
        const horizontalDampingFactor = this.isInWater ? Math.pow(Config.WATER_HORIZONTAL_DAMPING, dt) : 1; // 1 means no damping in air
        const verticalDampingFactor = this.isInWater ? Math.pow(Config.WATER_VERTICAL_DAMPING, dt) : 1;

        // --- Update Timers (Attack, Invulnerability) ---
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.hitEnemiesThisSwing = [];
                this.hitBlocksThisSwing = []; // Reset block hits too
            }
        }
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= dt;
            if (this.invulnerabilityTimer <= 0) {
                this.isInvulnerable = false;
            }
        }
        if (this.waterJumpCooldown > 0) this.waterJumpCooldown -= dt; // Decrement cooldown

        // --- Input Handling & Acceleration (Use modified params) ---
        let targetVx = 0;
        if (inputState.left && !inputState.right) {
            targetVx = -currentMaxSpeedX; // Use water/air max speed
            // Note: Facing direction is now based on target, not movement keys
        } else if (inputState.right && !inputState.left) {
            targetVx = currentMaxSpeedX; // Use water/air max speed
             // Note: Facing direction is now based on target, not movement keys
        }

        // Apply acceleration towards target velocity
        if (targetVx !== 0) {
            this.vx += Math.sign(targetVx) * currentAcceleration * dt; // Use water/air accel
            // Clamp to max speed, preserving direction
            if (Math.abs(this.vx) > currentMaxSpeedX) {
                this.vx = Math.sign(this.vx) * currentMaxSpeedX;
            }
        } else {
            // Apply friction OR water damping
            if (!this.isInWater && this.isOnGround) { // Air friction only on ground
                const frictionFactor = Math.pow(Config.PLAYER_FRICTION_BASE, dt);
                this.vx *= frictionFactor;
            }
            // Stop completely if velocity is very small (both air/water)
            if (Math.abs(this.vx) < 1) {
                this.vx = 0;
            }
        }
        // Apply horizontal water damping regardless of input if in water
        if (this.isInWater) {
            this.vx *= horizontalDampingFactor;
        }

        // --- Jumping / Swimming ---
        if (inputState.jump) { // Check if jump input is currently active (button is down)
            if (this.isInWater) {
                // Water Swim Stroke
                if (this.waterJumpCooldown <= 0) {
                    this.vy = -Config.WATER_SWIM_VELOCITY; // Apply upward swim impulse
                    this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION; // Start cooldown
                }
            } else if (this.isOnGround) {
                // Normal Jump from ground (only if not in water)
                this.vy = -Config.PLAYER_JUMP_VELOCITY;
                this.isOnGround = false; // Set to false *immediately*
            }
        }

        // --- Block Placement Logic ---
        if (inputState.attack && this.isMaterialSelected()) {
            const materialType = this.selectedItem;

            // 1. Check Inventory
            if ((this.inventory[materialType] || 0) > 0) {
                // 2. Check Range
                if (isTargetWithinRange(this, targetWorldPos)) {
                    // 3. Check Target Cell Validity
                    const targetCol = targetGridCell.col;
                    const targetRow = targetGridCell.row;
                    const targetBlockType = WorldData.getBlockType(targetCol, targetRow);

                    // Check if target is Air (or Water if allowed)
                    const canPlaceHere = targetBlockType === Config.BLOCK_AIR || (Config.CAN_PLACE_IN_WATER && targetBlockType === Config.BLOCK_WATER);

                    if (canPlaceHere) {
                        // 4. Check Player Overlap
                        if (!this.checkPlacementOverlap(targetCol, targetRow)) {
                            // ALL CHECKS PASSED - PLACE BLOCK!
                            const blockTypeToPlace = Config.MATERIAL_TO_BLOCK_TYPE[materialType];
                            if (blockTypeToPlace !== undefined) {
                                // Use WorldManager to place and check success
                                if (WorldManager.setBlock(targetCol, targetRow, blockTypeToPlace)) {
                                    this.decrementInventory(materialType); // Consume item
                                    // console.log(`Placed ${materialType} at [${targetCol}, ${targetRow}]. Remaining: ${this.inventory[materialType]}`);
                                    inputState.attack = false; // Consume attack input only on SUCCESS
                                } else { console.warn(`WorldManager failed to set block ${materialType} at [${targetCol}, ${targetRow}]`); }
                            } else { console.warn(`No block type mapping found for material ${materialType}`); }
                        } // else: console.log("Placement failed: Player overlap.");
                    } // else: console.log(`Placement failed: Target cell not empty (Type: ${targetBlockType})`);
                } // else: console.log("Placement failed: Out of range.");
            } // else: console.log(`Placement failed: No ${materialType} in inventory.`);

            // Consume attack input regardless of success/failure IF a material was selected,
            // to prevent swinging weapon immediately after failed placement.
            if (inputState.attack) { inputState.attack = false; }
        }

        // --- Attack Triggering (Weapon Only) ---
        // Execute only if inputState.attack is still true (i.e., not consumed by placement)
        // and a weapon is selected
        if (inputState.attack && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.attackCooldown <= 0 && !this.isAttacking) {
            this.isAttacking = true;
            // Set duration/cooldown based on SELECTED weapon
            if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
                this.attackTimer = Config.PLAYER_SWORD_ATTACK_DURATION;
                this.attackCooldown = Config.PLAYER_SWORD_ATTACK_COOLDOWN;
            } else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                this.attackTimer = Config.PLAYER_SPEAR_ATTACK_DURATION;
                this.attackCooldown = Config.PLAYER_SPEAR_ATTACK_COOLDOWN;
            } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
                this.attackTimer = Config.PLAYER_SHOVEL_ATTACK_DURATION;
                this.attackCooldown = Config.PLAYER_SHOVEL_ATTACK_COOLDOWN;
            }
            this.hitEnemiesThisSwing = [];
            this.hitBlocksThisSwing = [];
            inputState.attack = false; // Consume attack input
        } else if (inputState.attack) {
            // Consume attack input even if on cooldown/unarmed/etc.
            inputState.attack = false;
        }

        // --- Physics Step 1: Apply Gravity if not on ground ---
        if (!this.isOnGround) {
            this.vy += currentGravity * dt;
        } else if (this.vy > 0) {
            this.vy = 0; // If on ground and moving down slightly, clamp vy
        }
        // --- Apply Vertical Damping in Water ---
        if (this.isInWater) {
            this.vy *= verticalDampingFactor;
            // Clamp vertical speed in water
            this.vy = Math.max(this.vy, -Config.WATER_MAX_SWIM_UP_SPEED); // Max upward speed
            this.vy = Math.min(this.vy, Config.WATER_MAX_SINK_SPEED);   // Max downward speed (sinking)
        } else {
            // Clamp fall speed in air
            if (this.vy > Config.MAX_FALL_SPEED) {
                this.vy = Config.MAX_FALL_SPEED;
            }
        }

        // --- Calculate Potential Movement ---
        const potentialMoveX = this.vx * dt;
        const potentialMoveY = this.vy * dt;

        // --- Physics Step 2: Grid Collision ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status

        // Zero out velocity if collision occurred
        if (collisionResult.collidedX) this.vx = 0;
        if (collisionResult.collidedY) {
            if (Math.abs(this.vy) > 0.1) { this.vy = 0; }
        }

        // --- Screen Boundary Checks ---
        if (this.x < 0) {
            this.x = 0;
            if (this.vx < 0) this.vx = 0;
        }
        if (this.x + this.width > Config.CANVAS_WIDTH) {
            this.x = Config.CANVAS_WIDTH - this.width;
            if (this.vx > 0) this.vx = 0;
        }
        // --- Reset if falling out of world ---
        if (this.y > Config.CANVAS_HEIGHT + 200) {
            console.warn("Player fell out of world!");
            this.resetPosition();
        }
    }

    // --- Draw Player and Weapon/Hitbox ---
    draw(ctx) {
        if (!ctx) {
            console.error("Player.draw: Rendering context not provided!");
            return;
        }
        // Handle invulnerability flashing
        let shouldDraw = true;
        if (this.isInvulnerable) {
            shouldDraw = Math.floor(performance.now() / 100) % 2 === 0;
        }

        // Draw Player Sprite
        if (shouldDraw) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Draw Weapon visual cue if a weapon is selected and not attacking
            if (!this.isAttacking && this.isWeaponSelected()) {
                if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
                    const swordVisualWidth = 4;
                    const swordVisualHeight = 10;
                    const swordVisualY = this.y + this.height * 0.3;
                    const swordVisualX = this.lastDirection > 0
                        ? this.x + this.width - swordVisualWidth / 2 // Right side
                        : this.x - swordVisualWidth / 2;            // Left side
                    ctx.fillStyle = Config.SWORD_COLOR;
                    ctx.fillRect(swordVisualX, swordVisualY, swordVisualWidth, swordVisualHeight);
                } else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                    const spearVisualWidth = 3;
                    const spearVisualHeight = 14;
                    const spearVisualY = this.y + this.height * 0.1;
                    const spearVisualX = this.lastDirection > 0
                        ? this.x + this.width - spearVisualWidth / 2
                        : this.x - spearVisualWidth / 2;
                    ctx.fillStyle = Config.SPEAR_COLOR;
                    ctx.fillRect(spearVisualX, spearVisualY, spearVisualWidth, spearVisualHeight);
                } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
                    const shovelVisualWidth = 5;
                    const shovelVisualHeight = 8;
                    const shovelVisualY = this.y + this.height * 0.4;
                    const shovelVisualX = this.lastDirection > 0
                        ? this.x + this.width - shovelVisualWidth / 2
                        : this.x - shovelVisualWidth / 2;
                    ctx.fillStyle = Config.SHOVEL_COLOR;
                    ctx.fillRect(shovelVisualX, shovelVisualY, shovelVisualWidth, shovelVisualHeight);
                }
            }
        }

        // Draw Attack Hitbox visual if attacking with a weapon
        if (this.isAttacking && this.isWeaponSelected() && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
            const hitbox = this.getAttackHitbox();
            if (hitbox) {
                let hitboxColor = Config.PLAYER_SWORD_ATTACK_COLOR; // Default
                if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                    hitboxColor = Config.PLAYER_SPEAR_ATTACK_COLOR;
                } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
                    hitboxColor = Config.PLAYER_SHOVEL_ATTACK_COLOR;
                }
                ctx.fillStyle = hitboxColor;
                ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }
    }

    // --- Handle Taking Damage ---
    takeDamage(amount) {
        if (this.isInvulnerable || this.currentHealth <= 0) return;
        this.currentHealth -= amount;
        console.log(`Player took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`);
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        } else {
            // Become invulnerable for a duration
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
            // Optional: Add knockback or other effects on taking damage
        }
    }

    // --- Handle Player Death ---
    die() {
        // Called when health drops to 0 or below. Currently, it just stops movement immediately - Game over logic is handled in main.js loop
        this.vx = 0;
        this.vy = 0;
        // Could trigger death animation, sound effects, etc. here
        // Game over logic is handled in main.js
    }

    // --- Reset Player State for New Game ---
    reset() {
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
        this.currentHealth = Config.PLAYER_MAX_HEALTH_DISPLAY; // Use correct constant
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.inventory = {};
        this.lastDirection = 1;
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        this.hasSword = false;
        this.hasSpear = false;
        this.hasShovel = false;
        this.selectedItem = Config.WEAPON_TYPE_UNARMED; // Correctly reset selected item
    }

    // --- Reset Position Only (e.g., falling out) ---
    resetPosition() {
        console.log("Player position reset (fell out).");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false;
        this.waterJumpCooldown = 0;
    }

    // --- Calculate Attack Hitbox ---
    getAttackHitbox() {
        // Only return hitbox if attacking *with a weapon*
        if (!this.isAttacking || !this.isWeaponSelected() || this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
            return null;
        }

        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;
        const targetX = this.targetWorldPos.x;
        const targetY = this.targetWorldPos.y;
        const dx = targetX - playerCenterX;
        const dy = targetY - playerCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let hitboxWidth, hitboxHeight, reachX, reachY;
        if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
            hitboxWidth = Config.PLAYER_SWORD_ATTACK_WIDTH;
            hitboxHeight = Config.PLAYER_SWORD_ATTACK_HEIGHT;
            reachX = Config.PLAYER_SWORD_ATTACK_REACH_X;
            reachY = Config.PLAYER_SWORD_ATTACK_REACH_Y;
        } else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
            hitboxWidth = Config.PLAYER_SPEAR_ATTACK_WIDTH;
            hitboxHeight = Config.PLAYER_SPEAR_ATTACK_HEIGHT;
            reachX = Config.PLAYER_SPEAR_ATTACK_REACH_X;
            reachY = Config.PLAYER_SPEAR_ATTACK_REACH_Y;
        } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
            hitboxWidth = Config.PLAYER_SHOVEL_ATTACK_WIDTH;
            hitboxHeight = Config.PLAYER_SHOVEL_ATTACK_HEIGHT;
            reachX = Config.PLAYER_SHOVEL_ATTACK_REACH_X;
            reachY = Config.PLAYER_SHOVEL_ATTACK_REACH_Y;
        } else {
            return null;
        }

        let hitboxCenterX, hitboxCenterY;
        if (dist > 1e-6) {
            const normX = dx / dist;
            const normY = dy / dist;
            hitboxCenterX = playerCenterX + normX * reachX;
            hitboxCenterY = playerCenterY + normY * reachY;
        } else {
            hitboxCenterX = playerCenterX + this.lastDirection * reachX;
            hitboxCenterY = playerCenterY + reachY;
        }

        const hitboxX = hitboxCenterX - hitboxWidth / 2;
        const hitboxY = hitboxCenterY - hitboxHeight / 2;
        return { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };
    }

    // --- Handle Item Pickup ---
    pickupItem(item) {
        if (!item || !item.type) return false;

        if (item.type === Config.WEAPON_TYPE_SWORD) {
            if (!this.hasSword) { this.hasSword = true; console.log("Player picked up the sword!"); return true; }
        } else if (item.type === Config.WEAPON_TYPE_SPEAR) {
            if (!this.hasSpear) { this.hasSpear = true; console.log("Player picked up the spear!"); return true; }
        } else if (item.type === Config.WEAPON_TYPE_SHOVEL) {
            if (!this.hasShovel) { this.hasShovel = true; console.log("Player picked up the shovel!"); return true; }
        } else if (Config.INVENTORY_MATERIALS.includes(item.type)) {
            this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
            // console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
            return true;
        }
        return false; // Did not pick up or already had weapon
    }

    // --- Check Weapon Possession ---
    hasWeapon(weaponType) {
        if (weaponType === Config.WEAPON_TYPE_SWORD) return this.hasSword;
        if (weaponType === Config.WEAPON_TYPE_SPEAR) return this.hasSpear;
        if (weaponType === Config.WEAPON_TYPE_SHOVEL) return this.hasShovel;
        return false;
    }

    // --- Equip Item (Weapon or Material) ---
    equipItem(itemType) {
        let canEquip = false;
        if (itemType === Config.WEAPON_TYPE_UNARMED) {
            canEquip = true; // Always allow equipping unarmed
        } else if (this.isWeaponType(itemType)) { // Check if it's a known weapon type
            canEquip = this.hasWeapon(itemType); // Check possession
        } else if (Config.INVENTORY_MATERIALS.includes(itemType)) { // Check if it's a placeable material
            canEquip = (this.inventory[itemType] || 0) > 0; // Check inventory count
        }

        if (canEquip && this.selectedItem !== itemType) {
            this.selectedItem = itemType;
            // console.log(`   SUCCESS: Player equipped ${itemType}.`);
            this.isAttacking = false; // Reset attack state on switch
            this.attackTimer = 0;
        } else if (!canEquip) {
            // console.log(`   FAILED: Cannot equip ${itemType}. Possession/Count check failed.`);
        } else {
            // console.log(`   INFO: Already equipped ${itemType}.`);
        }
    }

    // --- Decrement inventory count for a given material type ---
    decrementInventory(itemType) {
        if (Config.INVENTORY_MATERIALS.includes(itemType) && this.inventory[itemType] > 0) {
            this.inventory[itemType]--;
            // If count reaches 0 and it was the selected item, switch to unarmed
            if (this.inventory[itemType] === 0 && this.selectedItem === itemType) {
                 this.equipItem(Config.WEAPON_TYPE_UNARMED);
                 console.log(`${itemType} depleted, switching to unarmed.`);
            }
            return true;
        }
        return false;
    }

    // --- Helper methods for attack collision tracking ---
    hasHitEnemyThisSwing(enemy) { return this.hitEnemiesThisSwing.includes(enemy); }
    registerHitEnemy(enemy) { if (!this.hasHitEnemyThisSwing(enemy)) { this.hitEnemiesThisSwing.push(enemy); } }
    hasHitBlockThisSwing(col, row) { const blockKey = `${col},${row}`; return this.hitBlocksThisSwing.includes(blockKey); }
    registerHitBlock(col, row) { const blockKey = `${col},${row}`; if (!this.hasHitBlockThisSwing(col, row)) { this.hitBlocksThisSwing.push(blockKey); } }

    // --- Simple Getters ---
    getRect() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    getPosition() { return { x: this.x, y: this.y }; }
    getCurrentHealth() { return this.currentHealth; }
    getMaxHealth() { return this.maxHealth; }
    getInventory() { return this.inventory; }
    getShovelStatus() { return this.hasShovel; }
    getSwordStatus() { return this.hasSword; }
    getSpearStatus() { return this.hasSpear; }
    getCurrentlySelectedItem() { return this.selectedItem; }

    // --- Get damage based on equipped item ---
    getCurrentAttackDamage() { // Damage vs Enemies
        if (!this.isWeaponSelected()) return 0;
        if (this.selectedItem === Config.WEAPON_TYPE_SWORD) return Config.PLAYER_SWORD_ATTACK_DAMAGE;
        if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) return Config.PLAYER_SPEAR_ATTACK_DAMAGE;
        if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) return Config.PLAYER_SHOVEL_ATTACK_DAMAGE;
        return 0;
    }
    getCurrentBlockDamage() { // Damage vs Blocks
        if (!this.isWeaponSelected()) return 0;
        if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) return Config.PLAYER_SHOVEL_BLOCK_DAMAGE;
        return 0;
    }

    // --- Type Check Helpers ---
    isWeaponType(itemType) { // Checks if an item type string is a known weapon
         return [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL].includes(itemType);
    }
    isWeaponSelected() { // Checks if the *currently selected* item is a weapon
        return this.isWeaponType(this.selectedItem);
    }
    isMaterialSelected() { // Checks if the *currently selected* item is a placeable material
        return Config.INVENTORY_MATERIALS.includes(this.selectedItem);
    }

    // --- Check for overlap between player and potential block placement ---
    checkPlacementOverlap(targetCol, targetRow) {
        if (targetCol < 0 || targetRow < 0 || targetCol >= Config.GRID_COLS || targetRow >= Config.GRID_ROWS) return true; // Invalid coords overlap

        const blockRect = {
            x: targetCol * Config.BLOCK_WIDTH,
            y: targetRow * Config.BLOCK_HEIGHT,
            width: Config.BLOCK_WIDTH,
            height: Config.BLOCK_HEIGHT
        };
        const playerRect = this.getRect();

        // Standard AABB overlap check
        const overlap = playerRect.x < blockRect.x + blockRect.width &&
                        playerRect.x + playerRect.width > blockRect.x &&
                        playerRect.y < blockRect.y + blockRect.height &&
                        playerRect.y + playerRect.height > blockRect.y;
        return overlap;
    }
}