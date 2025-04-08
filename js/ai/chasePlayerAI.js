// -----------------------------------------------------------------------------
// root/js/ai/chasePlayerAI.js - AI Strategy for chasing the player
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
// No direct collision checking needed here usually, relies on Enemy class physics

export class ChasePlayerAI {
    /**
     * Constructor for the ChasePlayerAI strategy.
     * @param {Enemy} enemy - A reference to the enemy instance using this strategy.
     */
    constructor(enemy) {
        this.enemy = enemy; // Store reference to the enemy owning this AI
        this.wantsToJump = false; // Flag to signal jump intent after collision
    }

    /**
     * Decides the enemy's movement intent based on player position.
     * @param {object | null} playerPosition - Current player {x, y} or null.
     * @param {Array<Enemy>} allEnemies - List of all active enemies (for potential future use).
     * @param {number} dt - Delta time.
     * @returns {object} Movement decision { targetVx: number, jump: boolean }.
     */
    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let jump = false; // Jump is usually triggered by reactToCollision

        // --- Target Selection ---
        if (!playerPosition) {
            // If player doesn't exist or is dead, maybe default to center seeking or idle?
            // For now, just stop horizontal movement if no player target.
            targetVx = 0;
        } else {
            // Target the center of the player
            const playerCenterX = playerPosition.x + (Config.PLAYER_WIDTH / 2);
            const enemyCenterX = this.enemy.x + this.enemy.width / 2;
            const directionToPlayer = Math.sign(playerCenterX - enemyCenterX);

            // Set target velocity based on direction and enemy's max speed
            targetVx = directionToPlayer * this.enemy.maxSpeedX; // Use speed from enemy's stats

            // --- Predictive Jump (Optional - More Complex) ---
            // Could check for obstacles ahead here, but reacting after collision is simpler.
        }

        // Check if we wanted to jump from the *last* frame's collision reaction
        if (this.wantsToJump && this.enemy.isOnGround && this.enemy.stats.canJump) {
            jump = true; // Signal the jump action to Enemy.update
            this.wantsToJump = false; // Consume the flag
        }

        return { targetVx, jump }; // Return the calculated movement intent
    }

    /**
     * Allows the AI to react after physics collisions have been resolved for the frame.
     * @param {object} collisionResult - The result from GridCollision.collideAndResolve.
     *                                   { collidedX: boolean, collidedY: boolean, isOnGround: boolean, didStepUp: boolean }
     */
    reactToCollision(collisionResult) {
        // --- Jump Reaction ---
        // If we hit a wall horizontally, are capable of jumping, and are on the ground,
        // signal the desire to jump on the *next* frame.
        if (collisionResult.collidedX && this.enemy.stats.canJump && this.enemy.isOnGround) {
            // Set a flag indicating the desire to jump.
            // The jump itself will be initiated in decideMovement() on the next frame
            // if the enemy is still on the ground then.
             this.wantsToJump = true;
             // console.log(`${this.enemy.displayName} wants to jump after hitting wall.`);
        } else if (!this.enemy.isOnGround) {
             // If airborne, clear any previous jump intent (e.g., hit head mid-jump)
             this.wantsToJump = false;
        }

        // Other potential reactions:
        // - If bumped head (collidedY=true, vy was < 0), maybe change state?
        // - If landed (collidedY=true, vy was > 0), maybe trigger an attack or different behavior?
    }
}