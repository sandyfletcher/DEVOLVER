// root/js/ai/flopAI.js - AI for the simple Tetrapod enemy

import * as Config from '../config.js';

export class FlopAI {
    constructor(enemy) {
        this.enemy = enemy;

        // Timers and state for flopping behavior
        this.jumpCooldown = 0; // Time until the next jump attempt
        this.targetVx = 0;     // Horizontal velocity during the current flop/rest
        this.actionTimer = 0;  // Duration of the current action (moving or resting after jump)

        this.setRandomCooldown(); // Initialize first cooldown
    }

    setRandomCooldown() {
        // Set a random time until the next flop action (e.g., 1 to 3 seconds)
        this.jumpCooldown = 1.0 + Math.random() * 2.0;
        this.targetVx = 0; // Reset target velocity when waiting
        this.actionTimer = 0; // Not currently performing an action
    }

    decideMovement(playerPosition, allEnemies, dt) {
        this.jumpCooldown -= dt;
        this.actionTimer -= dt;

        let jump = false;
        let currentTargetVx = this.targetVx; // Maintain current flop direction if actionTimer > 0

        // Time to try a new flop? Only if on the ground and previous action finished
        if (this.jumpCooldown <= 0 && this.enemy.isOnGround && this.actionTimer <= 0) {
            jump = true;

            // --- START: Biased Direction Logic ---
            const enemyCenterX = this.enemy.x + this.enemy.width / 2;
            const screenCenterX = Config.CANVAS_WIDTH / 2;

            // Determine the direction towards the center
            // 1 means move right (enemy is left of center)
            // -1 means move left (enemy is right of center)
            const directionToCenter = (enemyCenterX < screenCenterX) ? 1 : -1;

            // Set the probability of moving towards the center (e.g., 0.75 = 75% chance)
            const centerBiasProbability = 0.75;

            // Roll the dice
            const roll = Math.random();

            // Choose the final direction based on the probability roll
            const chosenDirection = (roll < centerBiasProbability)
                ? directionToCenter        // Go towards center
                : -directionToCenter;      // Go away from center

            // --- END: Biased Direction Logic ---


            // Decide the force/speed of this flop (same as before)
            const flopForce = this.enemy.maxSpeedX * (0.3 + Math.random() * 0.7);

            // Apply the chosen direction and force
            currentTargetVx = chosenDirection * flopForce;


            // Reset cooldown for the *next* flop
            this.setRandomCooldown();
            // Set how long this flop's horizontal movement should persist (short duration)
            this.actionTimer = 0.3 + Math.random() * 0.4; // Flop lasts for 0.3-0.7 seconds
            this.targetVx = currentTargetVx; // Store the target velocity for the duration

        } else if (this.actionTimer <= 0) {
            // If not jumping and action timer expired, stop moving horizontally
            this.targetVx = 0;
            currentTargetVx = 0;
        }
        // If actionTimer is still > 0, currentTargetVx will retain the value from this.targetVx set during the jump

        // Return the decision: target horizontal speed and jump command
        return { targetVx: currentTargetVx, jump: jump };
    }

    reactToCollision(collisionResult) {
        // If it hits a wall horizontally during a flop, maybe stop the horizontal motion early
        if (collisionResult.collidedX && this.actionTimer > 0) {
            this.actionTimer = 0; // Stop the flop action
            this.targetVx = 0;
            // Optional: Could trigger the jump cooldown sooner if it hits a wall?
            // this.jumpCooldown = 0.5 + Math.random() * 0.5; // Start cooldown for next flop sooner
        }
        // No special reaction needed for vertical collision, physics handles landing.
    }
}