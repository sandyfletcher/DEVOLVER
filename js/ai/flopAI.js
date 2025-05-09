// -----------------------------------------------------------------------------
// root/js/ai/flopAI.js - AI Strategy for Tetrapod-like flopping behavior
// -----------------------------------------------------------------------------
import * as GridCollision from '../utils/gridCollision.js';
import * as World from '../utils/world.js';
import * as Config from '../config.js';
export class FlopAI {
constructor(enemy) {
this.enemy = enemy;
this.landHopCooldown = 0; // Timer for when the next land hop can occur
this.flopAttackTimer = 0; // Timer for the duration of a flop attack hitbox/state
this.state = 'idle'; // Possible states: 'idle', 'flopping_on_land', 'swimming'
this.targetDirectionX = (Math.random() < 0.5) ? -1 : 1; // Initial random direction
}
decideMovement(playerPosition, allEnemies, dt) {
    let targetVx = 0;
    let jump = false;
    let targetVy = this.enemy.vy; // Default to current vertical velocity

    // Update timers
    this.landHopCooldown = Math.max(0, this.landHopCooldown - dt);
    this.flopAttackTimer = Math.max(0, this.flopAttackTimer - dt);

    // Determine current state based on environment
    if (this.enemy.isInWater) {
        this.state = 'swimming';
        this.enemy.isFlopAttacking = false; // Cannot flop attack while swimming
        this.flopAttackTimer = 0;
    } else if (this.enemy.isOnGround) {
        if (this.flopAttackTimer > 0) {
            this.state = 'flopping_on_land'; // Continue current flop
        } else if (this.landHopCooldown <= 0) {
            this.state = 'flopping_on_land'; // Initiate new flop
        } else {
            this.state = 'idle'; // Waiting for land hop cooldown
            this.enemy.isFlopAttacking = false;
        }
    } else { // Airborne over land
        if (this.flopAttackTimer > 0) {
            this.state = 'flopping_on_land'; // Still considered part of the flop attack if airborne during it
        } else {
            this.state = 'idle'; // Airborne but not actively flopping
            this.enemy.isFlopAttacking = false;
        }
    }


    // --- Behavior based on state ---
    switch (this.state) {
        case 'swimming':
            // Swim towards player if present, otherwise pick a direction and swim
            if (playerPosition) {
                const dx = playerPosition.x - (this.enemy.x + this.enemy.width / 2);
                const dy = playerPosition.y - (this.enemy.y + this.enemy.height / 2);

                if (Math.abs(dx) > this.enemy.width * 0.2) { // Minimal horizontal deadzone
                    targetVx = Math.sign(dx) * this.enemy.maxSpeedX * 0.8; // Slightly slower in water horizontally
                }
                // Vertical swimming towards player
                if (Math.abs(dy) > this.enemy.height * 0.5) {
                    targetVy = Math.sign(dy) * this.enemy.swimSpeed; // Use scaled swimSpeed
                } else {
                    targetVy = this.enemy.vy * 0.9; // Dampen vertical if close enough
                }
            } else {
                // Wander horizontally, try to stay near surface
                targetVx = this.targetDirectionX * this.enemy.maxSpeedX * 0.5;
                // Simple buoyancy/surface seeking: if too deep, swim up slowly
                if (this.enemy.y > Config.WORLD_WATER_LEVEL_ROW_TARGET * Config.BLOCK_HEIGHT + this.enemy.height) {
                    targetVy = -this.enemy.swimSpeed * 0.3;
                } else {
                    targetVy = this.enemy.swimSpeed * 0.1; // Gentle upward bob
                }
            }
            break;

        case 'flopping_on_land':
            if (this.enemy.isOnGround && this.landHopCooldown <= 0) {
                // Initiate a new hop
                jump = true; // Physics will use enemy.jumpVelocity
                targetVx = this.targetDirectionX * this.enemy.landHopHorizontalVelocity; // Use scaled landHopVelocity

                // Start flop attack state and timer
                this.enemy.isFlopAttacking = true;
                this.flopAttackTimer = Config.TETRAPOD_FLOP_ATTACK_DURATION;

                // Set cooldown for the next hop (time-based)
                this.landHopCooldown = Config.TETRAPOD_LAND_HOP_COOLDOWN_BASE + (Math.random() * Config.TETRAPOD_LAND_HOP_COOLDOWN_VARIATION);

                // Randomly change direction after a hop sometimes
                if (Math.random() < 0.3) {
                    this.targetDirectionX *= -1;
                }
            } else if (this.flopAttackTimer <= 0) {
                // Flop attack duration ended
                this.enemy.isFlopAttacking = false;
            }
            // If airborne during a flop, horizontal velocity is maintained by physics from the jump impulse.
            // If on ground and flopAttackTimer is still active, but landHopCooldown is not ready, do nothing (wait for jump)
            break;

        case 'idle': // Idle on land or airborne after a hop but flop attack ended
            targetVx = 0; // No active horizontal movement from AI
            if (this.enemy.isOnGround) {
                // If on ground and idle, ensure flop attack is off
                this.enemy.isFlopAttacking = false;
            }
            // Gravity will take over if airborne
            break;
    }

    return { targetVx, jump, targetVy };
}

reactToCollision(collisionResult) {
    if (this.state === 'swimming') {
        if (collisionResult.collidedX && Math.abs(this.enemy.vx) > GridCollision.E_EPSILON) {
            this.targetDirectionX *= -1; // Reverse horizontal direction if hit a wall while swimming
        }
    } else if (this.state === 'flopping_on_land' || (this.state === 'idle' && !this.enemy.isOnGround)) {
        // If flopping/airborne on land and hit a wall
        if (collisionResult.collidedX && Math.abs(this.enemy.vx) > GridCollision.E_EPSILON) {
            // Potentially reverse direction for next hop attempt, or if it's a hard wall hit
            // For simplicity, let's always reverse target direction on X collision while flopping/airborne from flop
             this.targetDirectionX *= -1;

            // If it was a significant horizontal collision while airborne from a flop,
            // it might be good to cancel the ongoing flopAttack if it's still active.
            // However, the current logic has flopAttackTimer running independently.
            // Consider if a hard wall impact should interrupt the "damaging" part of the flop.
            // For now, let it continue.
        }
    }
    // If landed on ground after a hop (collidedY and was moving down)
    if (collisionResult.collidedY && this.enemy.vy >= 0 && !this.enemy.isOnGround && this.state !== 'swimming') {
        // This means it just landed. The state will transition to 'idle' or 'flopping_on_land'
        // in the next call to decideMovement based on cooldowns.
        // If the flopAttackTimer was active, it continues until it runs out.
    }
}
}