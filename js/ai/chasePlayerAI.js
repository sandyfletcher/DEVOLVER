// -----------------------------------------------------------------------------
// root/js/ai/chasePlayerAI.js - AI Strategy for chasing the player
// -----------------------------------------------------------------------------

import * as Config from '../config.js';

export class ChasePlayerAI {
    constructor(enemy) {
        this.enemy = enemy;
        this.wantsToJumpFromCollision = false; // Flag for ground collision jumps
    }

    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0; // Initialize targetVy
        let jumpRequest = false; // For non-swimmer jumps/strokes

        if (!playerPosition) {
            // No player? Default behavior (e.g., stop, or could seek center)
            targetVx = 0;
            targetVy = 0; // Stop vertical movement if swimming/flying
        } else {
            // --- Horizontal Targeting (Same as before) ---
            const playerCenterX = playerPosition.x + (Config.PLAYER_WIDTH / 2);
            const enemyCenterX = this.enemy.x + this.enemy.width / 2;
            targetVx = Math.sign(playerCenterX - enemyCenterX) * this.enemy.stats.maxSpeedX;

            // --- Vertical Targeting & Jump Requests ---
            const playerCenterY = playerPosition.y + (Config.PLAYER_HEIGHT / 2);
            const enemyCenterY = this.enemy.y + this.enemy.height / 2;
            const dy = playerCenterY - enemyCenterY;

            if (this.enemy.canFly && !this.enemy.isOnGround) { // --- FLYING LOGIC ---
                // Target player's vertical position directly
                // Use a threshold to prevent jittering when aligned
                if (Math.abs(dy) > this.enemy.height * 0.2) {
                    targetVy = Math.sign(dy) * this.enemy.stats.maxSpeedY;
                } else {
                    targetVy = 0; // Hover vertically if close enough
                }
                jumpRequest = false; // Flyers don't use the 'jump' flag

            } else if (this.enemy.canSwim && this.enemy.isInWater) { // --- SWIMMING LOGIC ---
                 // Target player's vertical position directly
                if (Math.abs(dy) > this.enemy.height * 0.3) { // Wider threshold in water?
                    targetVy = Math.sign(dy) * this.enemy.stats.maxSpeedY; // Use maxSpeedY for swimming too
                } else {
                    targetVy = 0;
                }
                jumpRequest = false; // Swimmers don't use the 'jump' flag

            } else { // --- STANDARD GROUND / NON-SWIMMER IN WATER LOGIC ---
                targetVy = 0; // Let physics handle vertical unless jumping

                // 1. Check for ground jump request triggered by collision reaction
                if (this.wantsToJumpFromCollision && !this.enemy.isInWater && this.enemy.isOnGround && this.enemy.stats.canJump) {
                    jumpRequest = true;
                    this.wantsToJumpFromCollision = false; // Consume the flag
                }
                // 2. Check for water stroke request (for NON-swimmers that CAN jump)
                else if (this.enemy.isInWater && !this.enemy.canSwim && this.enemy.stats.canJump) {
                    const playerBottom = playerPosition.y + Config.PLAYER_HEIGHT;
                    const enemyTop = this.enemy.y;
                    const heightDifferenceThreshold = this.enemy.height * 0.75;
                    if (playerBottom < enemyTop - heightDifferenceThreshold) {
                        // Player is sufficiently above, request a water stroke
                        jumpRequest = true;
                    }
                }
            }
        }

        // Return the calculated movement intent
        // Swimmers/Flyers use targetVy, others use jump flag + physics
        return { targetVx, targetVy, jump: jumpRequest };
    }

    reactToCollision(collisionResult) {
        // --- Ground Jump Reaction (Only for non-flyers/non-swimmers on ground) ---
        if (collisionResult.collidedX && this.enemy.isOnGround &&
            !this.enemy.isInWater && !this.enemy.canFly && this.enemy.stats.canJump) {
           this.wantsToJumpFromCollision = true;
        } else if (!this.enemy.isOnGround) {
           // If airborne or in water, clear the ground jump request flag
           this.wantsToJumpFromCollision = false;
        }

        // Optional: Flyers/Swimmers could react to collisions differently
        // e.g., if (this.enemy.canFly && collisionResult.collidedY) { /* adjust targetVy? */ }
    }
}