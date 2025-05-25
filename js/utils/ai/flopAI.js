// root/js/utils/ai/flopAI.js

import * as Config from '../config.js';
import * as GridCollision from '../gridCollision.js';
import * as DebugLogger from '../debugLogger.js';

export class FlopAI {
    constructor(enemy) {
        this.enemy = enemy;
        this.landHopCooldown = Config.TETRAPOD_LAND_HOP_COOLDOWN_BASE + Math.random() * Config.TETRAPOD_LAND_HOP_COOLDOWN_VARIATION;
        this.attackCooldown = 0; // Cooldown for the flop "attack" animation itself
        this.lastPlayerPosition = null;
    }

    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0;
        let jump = false;
        this.enemy.isFlopAttacking = false; // Reset attack state

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        if (this.enemy.isInWater) {
            this.landHopCooldown = 0; // Reset land hop cooldown if in water
            // Simple water behavior: try to move towards player if nearby, otherwise wander
            if (playerPosition) {
                const dx = playerPosition.x - this.enemy.x;
                const dy = playerPosition.y - this.enemy.y;
                if (Math.abs(dx) > this.enemy.width * 0.5) { // Only move if not already at player's X
                    targetVx = Math.sign(dx) * this.enemy.swimSpeed;
                }
                // Try to stay near player's Y level in water
                if (Math.abs(dy) > this.enemy.height * 0.5) {
                    targetVy = Math.sign(dy) * this.enemy.swimSpeed * 0.5;
                }
            } else {
                // Wander in water
                targetVx = this.enemy.lastDirection * this.enemy.swimSpeed * 0.7;
                if (Math.random() < 0.02) this.enemy.lastDirection *= -1;
            }
        } else { // On land
            if (this.landHopCooldown > 0) {
                this.landHopCooldown -= dt;
                // DebugLogger.log(`FlopAI (${this.enemy.displayName}): Still on hop cooldown (${this.landHopCooldown.toFixed(2)}s left).`);
            }

            if (this.landHopCooldown <= 0 && this.enemy.isOnGround && this.attackCooldown <= 0) {
                // DebugLogger.log(`FlopAI (${this.enemy.displayName}): Hop cooldown ended. Deciding to hop.`);
                this.landHopCooldown = Config.TETRAPOD_LAND_HOP_COOLDOWN_BASE + Math.random() * Config.TETRAPOD_LAND_HOP_COOLDOWN_VARIATION;
                this.enemy.isFlopAttacking = true;
                this.attackCooldown = Config.TETRAPOD_FLOP_ATTACK_DURATION;

                if (playerPosition) {
                    const dxToPlayer = playerPosition.x - this.enemy.x;
                    targetVx = Math.sign(dxToPlayer) * this.enemy.landHopHorizontalVelocity;
                    // DebugLogger.log(`FlopAI (${this.enemy.displayName}): Player found. Attempting to face player. Player at X: ${playerPosition.x.toFixed(1)}, Enemy at X: ${this.enemy.x.toFixed(1)}`);
                    // DebugLogger.log(`FlopAI (${this.enemy.displayName}): Facing player. Attempting hop towards player.`);
                } else {
                    targetVx = this.enemy.lastDirection * this.enemy.landHopHorizontalVelocity * 0.7; // Shorter wander hops
                    if (Math.random() < 0.3) this.enemy.lastDirection *= -1; // Higher chance to change direction when wandering on land
                    // DebugLogger.log(`FlopAI (${this.enemy.displayName}): No player, wandering. LastDir: ${this.enemy.lastDirection}`);
                }
                jump = true; // Hop is a jump
            }
        }
        return { targetVx, targetVy, jump };
    }

    reactToCollision(collisionResult) {
        // DebugLogger.log(`FlopAI (${this.enemy.displayName}): Collided with ${collisionResult.collidedX ? 'X' : ''}${collisionResult.collidedY ? 'Y' : ''}. OnGround: ${this.enemy.isOnGround}`);
        if (collisionResult.collidedX && !this.enemy.isInWater) {
            // If hit a wall on land, change direction for next wander/hop
            this.enemy.lastDirection *= -1;
            this.landHopCooldown = 0.1; // Allow quick re-hop if stuck
        }
        if (collisionResult.collidedY && this.enemy.vy >= 0 && !this.enemy.isInWater) { // Landed on ground
            this.enemy.isFlopAttacking = false; // Stop attack animation on landing
        }
    }
     update(dt, playerPosition) { // playerPosition can be null
        this.lastPlayerPosition = playerPosition ? { ...playerPosition } : null;
    }
    interrupt() {
        this.enemy.isFlopAttacking = false;
        if (!this.enemy.isInWater) { // Only reset land hop cooldown if on land
            this.landHopCooldown = Config.TETRAPOD_LAND_HOP_COOLDOWN_BASE * 0.25 + Math.random() * (Config.TETRAPOD_LAND_HOP_COOLDOWN_VARIATION * 0.25); // shorter cooldown if stunned
        }
        this.attackCooldown = 0;
    }
}