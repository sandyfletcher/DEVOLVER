// root/js/ai/flopAI.js - AI for the simple Tetrapod enemy

import * as Config from '../config.js';

export class FlopAI {
    constructor(enemy) {
        this.enemy = enemy;
        // --- Land Flopping State ---
        this.landJumpCooldown = 0;
        this.landActionTimer = 0;
        this.landTargetVx = 0;
        // --- Water Swimming State (Example) ---
        this.swimTargetChangeCooldown = 0; // Timer to change swim direction
        this.swimTargetVx = 0;
        this.swimTargetVy = 0;

        this.setRandomLandCooldown();
    }

    setRandomLandCooldown() {
        this.landJumpCooldown = 1.0 + Math.random() * 2.0;
        this.landTargetVx = 0;
        this.landActionTimer = 0;
    }

    setRandomSwimTarget(playerPosition) {
         this.swimTargetChangeCooldown = 1.5 + Math.random() * 1.0; // Change target every 1.5-2.5s

         // Example: Swim towards player or center? Bias towards horizontal?
         let targetX = Config.CANVAS_WIDTH / 2;
         let targetY = Config.WORLD_WATER_LEVEL_ROW_TARGET * Config.BLOCK_HEIGHT; // Aim for water level?

         if (playerPosition) {
             targetX = playerPosition.x + Config.PLAYER_WIDTH / 2;
             // Aim slightly below player if player is also in water?
             targetY = this.enemy.isInWater ? playerPosition.y + Config.PLAYER_HEIGHT * 0.8 : targetY;
         }

         const dx = targetX - (this.enemy.x + this.enemy.width / 2);
         const dy = targetY - (this.enemy.y + this.enemy.height / 2);
         const dist = Math.sqrt(dx*dx + dy*dy);

         const swimSpeed = this.enemy.stats.maxSpeedX * 1.5; // Example: Swim faster than flop
         const swimSpeedY = this.enemy.stats.maxSpeedY * 0.8;

         if (dist > 5) {
             this.swimTargetVx = (dx / dist) * swimSpeed;
             this.swimTargetVy = (dy / dist) * swimSpeedY; // Use separate Y speed limit
         } else {
             this.swimTargetVx = 0;
             this.swimTargetVy = 0;
         }
    }


    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0;
        let jump = false;

        if (this.enemy.isInWater && this.enemy.canSwim) {
            // --- SWIMMING LOGIC ---
            this.swimTargetChangeCooldown -= dt;
            if (this.swimTargetChangeCooldown <= 0) {
                this.setRandomSwimTarget(playerPosition);
            }
            targetVx = this.swimTargetVx;
            targetVy = this.swimTargetVy;
            jump = false; // Don't use jump flag for swimming

            // Reset land timers if we just entered water
            this.landJumpCooldown = 0.1;
            this.landActionTimer = 0;

        } else if (!this.enemy.isInWater && this.enemy.isOnGround) {
            // --- LAND FLOPPING LOGIC ---
            this.landJumpCooldown -= dt;
            this.landActionTimer -= dt;

            if (this.landJumpCooldown <= 0 && this.landActionTimer <= 0) {
                jump = true; // Signal flop jump

                const enemyCenterX = this.enemy.x + this.enemy.width / 2;
                const screenCenterX = Config.CANVAS_WIDTH / 2;
                const directionToCenter = (enemyCenterX < screenCenterX) ? 1 : -1;
                const centerBiasProbability = 0.75;
                const roll = Math.random();
                const chosenDirection = (roll < centerBiasProbability) ? directionToCenter : -directionToCenter;
                const flopForce = this.enemy.stats.maxSpeedX * (0.3 + Math.random() * 0.7); // Use LAND speed

                this.landTargetVx = chosenDirection * flopForce;
                targetVx = this.landTargetVx;

                this.setRandomLandCooldown();
                this.landActionTimer = 0.3 + Math.random() * 0.4;

            } else if (this.landActionTimer > 0) {
                targetVx = this.landTargetVx; // Continue moving during flop action
            } else {
                targetVx = 0; // Waiting for cooldown
            }

            // Reset swim timers if we just landed
            this.swimTargetChangeCooldown = 0.1;


        } else {
             // --- AIRBORNE LOGIC (Applies after flop jump) ---
             // Let gravity handle vertical movement (Enemy.update)
             // Maintain horizontal velocity from flop?
             if (this.landActionTimer > 0) {
                  this.landActionTimer -= dt;
                  targetVx = this.landTargetVx;
             } else {
                 targetVx = 0;
             }
             jump = false;
        }

        return { targetVx, targetVy, jump };
    }

    reactToCollision(collisionResult) {
        // Reset land flop horizontal movement if hitting wall on land
        if (collisionResult.collidedX && !this.enemy.isInWater) {
            this.landActionTimer = 0;
            this.landTargetVx = 0;
        }
        // Swimming collision? Maybe change direction?
        if (collisionResult.collidedX || collisionResult.collidedY && this.enemy.isInWater) {
             // Hit something while swimming, pick new target sooner
             this.swimTargetChangeCooldown = 0;
        }
    }
}