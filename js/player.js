// -----------------------------------------------------------------------------
// root/js/player.js - Player Character Class
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as GridCollision from './utils/gridCollision.js';
import * as WorldManager from './worldManager.js'; // Needed to place blocks
import * as WorldData from './utils/worldData.js'; // Needed to check target cell type

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
    }
// --- Update player state on input, physics, and grid collision ---
    update(dt, inputState, targetWorldPos, targetGridCell) {
// Update targeting state from input
        this.targetWorldPos = targetWorldPos;
        this.targetGridCell = targetGridCell;
// TODO: Change this player direction code from movement direction to target position
        if (inputState.left && !inputState.right) {
            this.lastDirection = -1;
        } else if (inputState.right && !inputState.left) {
            this.lastDirection = 1;
        }
// --- 1. Update Water Status ---
        const wasInWater = this.isInWater; // Store previous state
        this.isInWater = GridCollision.isEntityInWater(this);
        if (!this.isInWater && this.waterJumpCooldown > 0) {
            this.waterJumpCooldown = 0; // Reset jump cooldown if just exited water ---
        }
// get current physics, modified against water parameters
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
            this.lastDirection = -1;
        } else if (inputState.right && !inputState.left) {
            targetVx = currentMaxSpeedX; // Use water/air max speed
            this.lastDirection = 1;
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
        // --- Jumping / Swimming  ---
        if (inputState.jump) { // Check if jump input is currently active (button is down)
            if (this.isInWater) {
                // Water Swim Stroke
                if (this.waterJumpCooldown <= 0) {
                    this.vy = -Config.WATER_SWIM_VELOCITY; // Apply upward swim impulse
                    this.waterJumpCooldown = Config.WATER_JUMP_COOLDOWN_DURATION; // Start cooldown
                }
                // If cooldown is active, do nothing this frame even if jump is held
            } else if (this.isOnGround) {
                // Normal Jump from ground (only if not in water)
                this.vy = -Config.PLAYER_JUMP_VELOCITY;
                this.isOnGround = false; // Set to false *immediately* to prevent re-triggering next frame while still grounded
            }
        }
        // --- Attack Triggering ---
        if (inputState.attack && this.selectedItem !== Config.WEAPON_TYPE_UNARMED && this.attackCooldown <= 0 && !this.isAttacking) { // Check if we *can* attack (i.e., not unarmed) before checking cooldown etc.
            this.isAttacking = true;
                if (this.selectedItem === Config.WEAPON_TYPE_SWORD) { // Set duration/cooldown based on SELECTED weapon
                    this.attackTimer = Config.PLAYER_SWORD_ATTACK_DURATION;
                    this.attackCooldown = Config.PLAYER_SWORD_ATTACK_COOLDOWN;
                } else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                    this.attackTimer = Config.PLAYER_SPEAR_ATTACK_DURATION;
                    this.attackCooldown = Config.PLAYER_SPEAR_ATTACK_COOLDOWN;
                } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
                        this.attackTimer = Config.PLAYER_SHOVEL_ATTACK_DURATION;
                        this.attackCooldown = Config.PLAYER_SHOVEL_ATTACK_COOLDOWN;
                }       // else: handle other weapons later
                this.hitEnemiesThisSwing = [];
                this.hitBlocksThisSwing = [];
                inputState.attack = false; // Consume attack input
            } else if (inputState.attack) {
                inputState.attack = false; // Consume attack input even if on cooldown/unarmed
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
        // --- Physics Step 2: Grid Collision (Unchanged - water isn't solid) ---
        const collisionResult = GridCollision.collideAndResolve(this, potentialMoveX, potentialMoveY);
        this.isOnGround = collisionResult.isOnGround; // Update ground status
        // Zero out velocity if collision occurred (Standard logic)
        if (collisionResult.collidedX) this.vx = 0;
        if (collisionResult.collidedY) {
            // Only zero vy if it wasn't already zeroed by damping/clamping
            if (Math.abs(this.vy) > 0.1) { // Check magnitude
            this.vy = 0;
            }
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
// --- draw function comment ---
    draw(ctx) {
        if (!ctx) {
            console.error("Player.draw: Rendering context not provided!");
             return;
        }
        // Handle invulnerability flashing
        let shouldDraw = true;
        if (this.isInvulnerable) {
            // Blink roughly 5 times per second (100ms on, 100ms off)
            shouldDraw = Math.floor(performance.now() / 100) % 2 === 0;
        }
        // Draw Player Sprite
        if (shouldDraw) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Draw Weapon visual cue if selected and not attacking
            if (!this.isAttacking) {
                if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
                    // Simple visual representation of the sword at the side
                    const swordVisualWidth = 4;
                    const swordVisualHeight = 10;
                    const swordVisualY = this.y + this.height * 0.3;
                    const swordVisualX = this.lastDirection > 0
                        ? this.x + this.width - swordVisualWidth / 2 // Right side
                        : this.x - swordVisualWidth / 2;            // Left side
                    ctx.fillStyle = Config.SWORD_COLOR; // Use weapon color
                    ctx.fillRect(swordVisualX, swordVisualY, swordVisualWidth, swordVisualHeight);
                } else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                    // Simple visual representation of the spear
                    const spearVisualWidth = 3;
                    const spearVisualHeight = 14; // Longer
                    const spearVisualY = this.y + this.height * 0.1; // Position differently?
                    const spearVisualX = this.lastDirection > 0
                        ? this.x + this.width - spearVisualWidth / 2 // Right side
                        : this.x - spearVisualWidth / 2;            // Left side
                    ctx.fillStyle = Config.SPEAR_COLOR; // Use weapon color
                    ctx.fillRect(spearVisualX, spearVisualY, spearVisualWidth, spearVisualHeight);
                } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
                        // Simple visual representation of the shovel
                        const shovelVisualWidth = 5;
                        const shovelVisualHeight = 8;
                        const shovelVisualY = this.y + this.height * 0.4;
                        const shovelVisualX = this.lastDirection > 0
                            ? this.x + this.width - shovelVisualWidth / 2 // Right side
                            : this.x - shovelVisualWidth / 2;            // Left side
                        ctx.fillStyle = Config.SHOVEL_COLOR; // Use weapon color
                        ctx.fillRect(shovelVisualX, shovelVisualY, shovelVisualWidth, shovelVisualHeight);
                }
            }
        }
        // Draw Attack Hitbox visual if attacking with a weapon
        if (this.isAttacking && this.selectedItem !== Config.WEAPON_TYPE_UNARMED) {
            const hitbox = this.getAttackHitbox();
            if (hitbox) {
            // Use weapon-specific color for hitbox visualization
                let hitboxColor = Config.PLAYER_SWORD_ATTACK_COLOR; // Default to sword
                if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                    hitboxColor = Config.PLAYER_SPEAR_ATTACK_COLOR;
                }
            ctx.fillStyle = hitboxColor;
            ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }
    }
// --- takedamage function comment ---
    takeDamage(amount) {
        if (this.isInvulnerable || this.currentHealth <= 0) return; // Cannot take damage if invulnerable or already dead
        this.currentHealth -= amount;
        console.log(`Player took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`);
        if (this.currentHealth <= 0) {
            this.currentHealth = 0; // Don't go below zero
            this.die(); // Handle player death
        } else {
            // Become invulnerable for a duration
            this.isInvulnerable = true;
            this.invulnerabilityTimer = Config.PLAYER_INVULNERABILITY_DURATION;
            // Optional: Add knockback or other effects on taking damage
        }
    }
    die() {
        // Called when health drops to 0 or below. Currently, it just stops movement immediately - Game over logic is handled in main.js loop
        this.vx = 0;
        this.vy = 0;
        // Could trigger death animation, sound effects, etc. here
    }
// --- ---
    reset() {
        console.log("Resetting player state...");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false;
        this.isInWater = false; // Reset water state
        this.waterJumpCooldown = 0; // Reset cooldown
        this.currentHealth = Config.PLAYER_MAX_HEALTH_DISPLAY;
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.inventory = {};
        this.lastDirection = 1;
        this.hitEnemiesThisSwing = [];
        this.hitBlocksThisSwing = [];
        this.hasSword = false; // reset weapon possession
        this.hasSpear = false;
        this.hasShovel = false;
        this.selectedWeapon = Config.WEAPON_TYPE_UNARMED; // reset to unarmed
    }
// --- ---
    resetPosition() {
        // Resets only the player's position and velocity, e.g., after falling out.
        console.log("Player position reset (fell out).");
        this.x = Config.PLAYER_START_X;
        this.y = Config.PLAYER_START_Y;
        this.vx = 0;
        this.vy = 0;
        this.isOnGround = false; // Recalculate ground state
        this.isInWater = false; // Re-evaluate water state on next update
        this.waterJumpCooldown = 0;
        // Keep health, inventory, etc. as they were
        // Reset invulnerability briefly? Optional.
        // this.isInvulnerable = true;
        // this.invulnerabilityTimer = 0.5;
    }
// --- Calculates the position and size of the attack hitbox based on player state and selected weapon. ---
    getAttackHitbox() {
        if (!this.isAttacking || this.selectedItem === Config.WEAPON_TYPE_UNARMED) {
            return null;
        }
        const verticalCenter = this.y + this.height / 2;
       // --- Calculate based on target World Position ---
       const playerCenterX = this.x + this.width / 2;
       const playerCenterY = this.y + this.height / 2;
       const targetX = this.targetWorldPos.x;
       const targetY = this.targetWorldPos.y;
       const dx = targetX - playerCenterX;
       const dy = targetY - playerCenterY;
       const dist = Math.sqrt(dx * dx + dy * dy);
       // Determine hitbox properties based on selected item
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
           return null; // Should not happen if selectedItem is checked above
       }
       // Calculate position based on directional offset towards target
       let hitboxCenterX, hitboxCenterY;
       if (dist > 1e-6) { // Avoid division by zero if target is exactly player center
           const normX = dx / dist;
           const normY = dy / dist;
           // Calculate center of hitbox based on offset vector
           hitboxCenterX = playerCenterX + normX * reachX;
           hitboxCenterY = playerCenterY + normY * reachY;
       } else {
           // If target is too close, default to facing direction logic
           hitboxCenterX = playerCenterX + this.lastDirection * reachX;
           hitboxCenterY = playerCenterY + reachY;
       }
       // Calculate top-left corner of hitbox from its center
       const hitboxX = hitboxCenterX - hitboxWidth / 2;
       const hitboxY = hitboxCenterY - hitboxHeight / 2;
       return { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };
    }
// --- Handles when player collides with item ---
    pickupItem(item) {
       if (!item || !item.type) return false;
       if (item.type === Config.WEAPON_TYPE_SWORD) {
           if (!this.hasSword) {
               this.hasSword = true;
               console.log("Player picked up the sword!");
               return true;
           } else { return false; }
       } else if (item.type === Config.WEAPON_TYPE_SPEAR) {
            if (!this.hasSpear) {
                this.hasSpear = true;
                console.log("Player picked up the spear!");
                return true;
            } else { return false; }
       } else if (item.type === Config.WEAPON_TYPE_SHOVEL) {
            if (!this.hasShovel) {
                this.hasShovel = true;
                console.log("Player picked up the shovel!");
                return true;
            } else { return false; }
       }
       // Resource Pickup Logic
       else if (Config.INVENTORY_MATERIALS.includes(item.type)) { // Check against the Config list
            this.inventory[item.type] = (this.inventory[item.type] || 0) + 1;
            console.log(`Picked up ${item.type}! Total: ${this.inventory[item.type]}`);
            return true;
       }
       return false;
   }
// --- Add hasWeapon method to Player ---
    hasWeapon(weaponType) {
        if (weaponType === Config.WEAPON_TYPE_SWORD) {
            return this.hasSword;
        } else if (weaponType === Config.WEAPON_TYPE_SPEAR) {
            return this.hasSpear;
        } else if (weaponType === Config.WEAPON_TYPE_SHOVEL) {
                return this.hasShovel;
        }
        // Add checks for future weapons
        return false;
    }
// --- Update equipitem ---
    equipItem(itemType) {
        let canEquip = false;
        if (itemType === Config.WEAPON_TYPE_SWORD && this.hasSword) {
                canEquip = true;
            } else if (itemType === Config.WEAPON_TYPE_SPEAR && this.hasSpear) {
                canEquip = true;
            } else if (itemType === Config.WEAPON_TYPE_SHOVEL && this.hasShovel) {
                canEquip = true;
            } else if (Config.INVENTORY_MATERIALS.includes(itemType)) { // Check if it's a placeable material
                canEquip = this.inventory[itemType] > 0;
            } else if (itemType === Config.WEAPON_TYPE_UNARMED) {
                canEquip = true;
            }
            if (canEquip && this.selectedItem !== itemType) {
                    this.selectedItem = itemType;
                    // console.log(`   SUCCESS: Player equipped ${itemType}.`);
                    
            // Reset attack state when switching weapons? Optional, but maybe good.
            this.isAttacking = false;
            this.attackTimer = 0;
            // Keep cooldown running? Or reset? Let's keep it running for now.
        } else if (!canEquip) {
            // console.log(`   FAILED: Cannot equip ${itemType}. Possession/Count check failed.`);
        } else {
            // console.log(`   INFO: Already equipped ${itemType}.`);
        }
    }
// --- Helper methods for attack collision ---
    hasHitEnemyThisSwing(enemy) { // Checks if a specific enemy has already been hit during the current attack
        return this.hitEnemiesThisSwing.includes(enemy);
    }
    registerHitEnemy(enemy) { // Adds enemy to list of hit, preventing multiple per swing
        if (!this.hasHitEnemyThisSwing(enemy)) {
            this.hitEnemiesThisSwing.push(enemy);
        }
    }
// --- Helpers for block collision ---
    hasHitBlockThisSwing(col, row) {
        // Create a unique key for the block position
        const blockKey = `${col},${row}`;
        return this.hitBlocksThisSwing.includes(blockKey);
    }
    registerHitBlock(col, row) {
        const blockKey = `${col},${row}`;
        if (!this.hasHitBlockThisSwing(col, row)) {
            this.hitBlocksThisSwing.push(blockKey);
        }
    }
    // --- Simple Getters ---
    getRect() { // Returns player's bounding box
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
    getPosition() { // Returns player's top-left position
        return { x: this.x, y: this.y };
    }
    getCurrentHealth() {
        return this.currentHealth;
    }
    getMaxHealth() {
        return this.maxHealth;
    }
    getInventory() {
        return this.inventory;
    }
    getShovelStatus() {
        return this.hasShovel;
    }
    getSwordStatus() {
        return this.hasSword;
    }
    getSpearStatus() {
         return this.hasSpear;
    }
    getCurrentlySelectedItem() {
        return this.selectedItem;
    }
    getCurrentAttackDamage() { // Returns damage intended for ENEMIES
        if (this.selectedItem === Config.WEAPON_TYPE_SWORD) {
        return Config.PLAYER_SWORD_ATTACK_DAMAGE;
        } else if (this.selectedItem === Config.WEAPON_TYPE_SPEAR) {
                return Config.PLAYER_SPEAR_ATTACK_DAMAGE;
        } else if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
                return Config.PLAYER_SHOVEL_ATTACK_DAMAGE;
        }
        return 0; // No damage if unarmed or unknown weapon
    }
    getCurrentBlockDamage() { // get block damage based on equipped weapon
        // Returns damage intended for BLOCKS
        if (this.selectedItem === Config.WEAPON_TYPE_SHOVEL) {
            return Config.PLAYER_SHOVEL_BLOCK_DAMAGE;
        }
        // Sword, Spear, Unarmed do 0 block damage
        return 0;
    }
    // --- Check if the selected item is a weapon ---
    isItemSelectedWeapon() {
        const weapons = [Config.WEAPON_TYPE_SWORD, Config.WEAPON_TYPE_SPEAR, Config.WEAPON_TYPE_SHOVEL];
        return weapons.includes(this.selectedItem);
    }
}