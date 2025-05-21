// -----------------------------------------------------------------------------
// root/js/utils/ai/fishAI.js - AI Strategy for Water-Bound Fish Enemies (Dunkleosteus)
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
// No need for GridCollision in AI if enemy.js handles isInWater status

export class FishAI {
    constructor(enemy) {
        this.enemy = enemy;
        // The portal is typically near the center of the canvas horizontally
        this.portalX = Config.CANVAS_WIDTH / 2; 
        this._bobbleAngle = Math.random() * Math.PI * 2; // Initial random angle for bobbing
    }

    /**
     * Determines the enemy's intended movement based on its state and surroundings.
     * @param {object} playerPosition - The player's current position {x, y}.
     * @param {Array<Enemy>} allEnemies - All active enemy instances for potential separation logic.
     * @param {number} dt - Delta time for calculations.
     * @returns {object} An object containing { targetVx, targetVy, jump }.
     */
    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0;

        if (this.enemy.isInWater) {
            // Move horizontally towards the portal
            const dx = this.portalX - this.enemy.x;
            if (dx > Config.BLOCK_WIDTH / 2) { // To the right of the portal center
                targetVx = this.enemy.swimSpeed;
            } else if (dx < -Config.BLOCK_WIDTH / 2) { // To the left
                targetVx = -this.enemy.swimSpeed;
            } else {
                targetVx = 0; // Close enough horizontally
            }

            // Apply a slight vertical bobbing motion when in water
            this._bobbleAngle = (this._bobbleAngle + dt * Config.ITEM_BOBBLE_SPEED) % (Math.PI * 2);
            targetVy = Math.sin(this._bobbleAngle) * (this.enemy.height * 0.1); // Bobble amount is 10% of enemy height

        } else {
            // If out of water, the fish should not try to move on its own.
            // Gravity will pull it down, and the enemy.js update loop will apply damage.
            targetVx = 0;
            targetVy = 0;
        }

        return { targetVx: targetVx, targetVy: targetVy, jump: false };
    }

    /**
     * Reacts to the outcome of collision resolution.
     * For fish, no specific reaction is implemented here, as physics handles bounces.
     * @param {object} collisionResult - The result from GridCollision.collideAndResolve.
     */
    reactToCollision(collisionResult) {
        // No special reaction needed for fish after collisions; physics handles bounces.
    }
}