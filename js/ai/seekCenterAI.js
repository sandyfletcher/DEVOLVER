// -----------------------------------------------------------------------------
// root/js/ai/seekCenterAI.js - AI Strategy for moving towards map center
// -----------------------------------------------------------------------------

import * as Config from '../config.js';

export class SeekCenterAI {
    constructor(enemy) {
        this.enemy = enemy;
    }

    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0; // Initialize targetVy
        let jump = false; // Seekers typically don't jump

        // --- Horizontal Targeting ---
        const targetX = Config.CANVAS_WIDTH / 2;
        const currentCenterX = this.enemy.x + this.enemy.width / 2;
        // Move towards center if far enough away
        if (Math.abs(currentCenterX - targetX) > this.enemy.stats.maxSpeedX * dt * 1.5) {
            targetVx = Math.sign(targetX - currentCenterX) * this.enemy.stats.maxSpeedX;
        }

        // --- Vertical Targeting (for Flyers/Swimmers) ---
        if (this.enemy.canFly && !this.enemy.isOnGround) {
            // Example: Fly towards a target altitude (e.g., slightly above mid-screen)
            const targetAltitudeY = Config.CANVAS_HEIGHT * 0.4;
            const enemyCenterY = this.enemy.y + this.enemy.height / 2;
            const dy = targetAltitudeY - enemyCenterY;
            if (Math.abs(dy) > 5) { // Threshold to avoid jitter
                 targetVy = Math.sign(dy) * this.enemy.stats.maxSpeedY;
            } else {
                 targetVy = 0; // Maintain altitude
            }

        } else if (this.enemy.canSwim && this.enemy.isInWater) {
             // Example: Swim towards water surface or a comfortable depth
             const targetDepthY = Config.WORLD_WATER_LEVEL_ROW_TARGET * Config.BLOCK_HEIGHT + this.enemy.height; // Aim slightly below surface
             const enemyCenterY = this.enemy.y + this.enemy.height / 2;
             const dy = targetDepthY - enemyCenterY;
             if (Math.abs(dy) > 8) { // Threshold
                  targetVy = Math.sign(dy) * this.enemy.stats.maxSpeedY;
             } else {
                  targetVy = 0; // Maintain depth
             }
        }
        // If not flying or swimming, targetVy remains 0, physics handles vertical

        return { targetVx, targetVy, jump }; // Return movement intent
    }

    reactToCollision(collisionResult) {
        // Seekers generally don't need complex collision reactions.
        // Flyers/Swimmers might want to change vertical target if hitting obstacles.
         if ((collisionResult.collidedX || collisionResult.collidedY) && (this.enemy.canFly || this.enemy.canSwim)) {
            // Maybe try reversing vertical target briefly? Or just let physics stop them.
         }
    }
}