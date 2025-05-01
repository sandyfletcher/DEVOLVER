// root/js/ai/flopAI.js

import * as Config from '../config.js';
import * as WorldData from '../utils/worldData.js'; // Need WorldData for finding the beach Y

export class FlopAI {
    constructor(enemy) {
        this.enemy = enemy;
        // --- Land Flopping State ---
        this.landJumpCooldown = 0;
        this.landActionTimer = 0; // How long horizontal movement persists after a hop
        this.landTargetVx = 0;
        this.setRandomLandCooldown(); // Set initial cooldown

        // NEW: State for managing the flop attack window
        this.flopAttackTimer = 0; // Timer for the brief attack window during a flop
        // This AI controls its own timer, using the duration from Config
        this.flopAttackDuration = Config.TETRAPOD_FLOP_ATTACK_DURATION;


        // --- Water Swimming State ---
        this.swimTargetChangeCooldown = 0; // Timer to change swim target
        this.swimTargetVx = 0;
        this.swimTargetVy = 0;
        this.setRandomSwimTarget(); // Set initial swim target


        // Target Y for swimming towards the beach/waterline
        this.waterlineTargetY = Config.WORLD_WATER_LEVEL_ROW_TARGET * Config.BLOCK_HEIGHT;
        // Target X for swimming towards the map center (nearest island)
        this.centerXTarget = Config.CANVAS_WIDTH / 2; // Or could be calculated based on nearest island edge
    }

    // Sets a random cooldown before the next land hop
    setRandomLandCooldown() {
        this.landJumpCooldown = Config.TETRAPOD_LAND_HOP_COOLDOWN_BASE + Math.random() * Config.TETRAPOD_LAND_HOP_COOLDOWN_VARIATION;
        // console.log(`[Tetrapod AI] Set new land hop cooldown: ${this.landJumpCooldown.toFixed(2)}s`);
    }

    // Sets a random swim target, potentially biasing towards the "beach" center
    setRandomSwimTarget() {
         this.swimTargetChangeCooldown = 1.5 + Math.random() * 1.0; // Change target every 1.5-2.5s (can tune)

         const enemyCenterX = this.enemy.x + this.enemy.width / 2;
         const enemyCenterY = this.enemy.y + this.enemy.height / 2;

         // Target X: Aim towards the map center's X coordinate
         const targetX = this.centerXTarget;

         // Target Y: Aim towards the waterline Y coordinate
         // Maybe slightly below the waterline so they don't just float at the surface?
         const targetY = this.waterlineTargetY + this.enemy.height * 0.2;


         const dx = targetX - enemyCenterX;
         const dy = targetY - enemyCenterY;

         const dist = Math.sqrt(dx*dx + dy*dy);

         // If far from target, set velocity towards it, using swim speed from config
         const swimSpeed = this.enemy.swimSpeed ?? Config.ENEMY_STATS[Config.ENEMY_TYPE_TETRAPOD].swimSpeed; // Use swimSpeed stat
         const swimSpeedY = this.enemy.maxSpeedY; // Use maxSpeedY for vertical swim limit (or use swimSpeed)

         if (dist > 10) { // Small threshold before stopping random movement
             const normX = dx / dist;
             const normY = dy / dist;
             this.swimTargetVx = normX * swimSpeed;
             this.swimTargetVy = normY * swimSpeedY; // Use maxSpeedY for vertical
         } else {
             // Near target, add some random wandering within the water
             this.swimTargetVx = (Math.random() - 0.5) * (swimSpeed * 0.4);
             this.swimTargetVy = (Math.random() - 0.5) * (swimSpeedY * 0.4);
         }
         // console.log(`[Tetrapod AI] Set new swim target. Vx: ${this.swimTargetVx.toFixed(2)}, Vy: ${this.swimTargetVy.toFixed(2)}`);
    }


    decideMovement(playerPosition, allEnemies, dt) {
        let targetVx = 0;
        let targetVy = 0;
        let jump = false; // Used for land hops

        // Update flop attack timer BEFORE deciding movement
        if (this.flopAttackTimer > 0) {
            this.flopAttackTimer -= dt;
        }
        // If the attack timer runs out, turn off the attack flag controlled by AI
        // This flag is used by Enemy.js::getCurrentContactDamage()
        if (this.flopAttackTimer <= 0 && this.enemy.isFlopAttacking) {
             this.enemy.isFlopAttacking = false;
            // console.log("[Tetrapod AI] Flop attack window ended.");
        }


        // --- Behavior based on Environment ---
        if (this.enemy.isInWater && this.enemy.canSwim) {
            // --- SWIMMING LOGIC ---
            this.swimTargetChangeCooldown -= dt;
            if (this.swimTargetChangeCooldown <= 0) {
                this.setRandomSwimTarget(playerPosition); // Pass player for future AI refinement
            }
            targetVx = this.swimTargetVx;
            targetVy = this.swimTargetVy; // AI provides vertical target for swimmers
            jump = false; // Don't use jump flag for swimming vertical movement

            // Reset land timers if we are swimming
            this.landJumpCooldown = 0.1; // Small cooldown prevents immediate hop on exiting water quickly
            this.landActionTimer = 0;
            this.enemy.isFlopAttacking = false; // Ensure land-specific attack flag is off in water


        } else if (!this.enemy.isInWater && this.enemy.isOnGround && this.enemy.canJump) {
            // --- LAND FLOPPING LOGIC ---
            // This state is reached when the enemy is on a solid block AND not in water.
            this.landJumpCooldown -= dt;
            this.landActionTimer -= dt; // Timer for how long horizontal force is applied *after* the jump impulse

            // Trigger a new hop if cooldown is ready and horizontal action is complete
            if (this.landJumpCooldown <= 0 && this.landActionTimer <= 0) {
                jump = true; // Signal hop jump (processed by Enemy.js)

                const enemyCenterX = this.enemy.x + this.enemy.width / 2;
                const screenCenterX = this.centerXTarget; // Aim towards the map center's X for land bias

                // Decide horizontal direction: biased towards center X, with some randomness
                const towardsCenterDir = Math.sign(screenCenterX - enemyCenterX);
                // Randomly choose direction: 80% chance towards center, 20% away
                const biasedDir = (Math.random() < 0.8) ? towardsCenterDir : -towardsCenterDir;

                const flopForce = Config.TETRAPOD_LAND_HOP_HORIZONTAL_FORCE * (0.7 + Math.random() * 0.6); // Horizontal force variation

                this.landTargetVx = biasedDir * flopForce; // Set horizontal velocity for the hop
                targetVx = this.landTargetVx; // Apply immediately this frame


                // NEW: Activate flop attack state and timer
                this.enemy.isFlopAttacking = true; // Set the flag on the enemy instance
                this.flopAttackTimer = this.flopAttackDuration; // Start the timer here in the AI
                // console.log(`[Tetrapod AI] Triggered land hop. Dir: ${biasedDir}, Vx: ${targetVx.toFixed(2)}, Attack active for ${this.flopAttackTimer.toFixed(2)}s.`);

                this.setRandomLandCooldown(); // Set cooldown for next hop
                this.landActionTimer = this.flopAttackDuration * 1.5; // Keep horizontal velocity active slightly longer than attack

            } else if (this.landActionTimer > 0) {
                // Continue horizontal movement during the hop action window
                targetVx = this.landTargetVx;
            } else {
                // Between hops, stay still horizontally
                targetVx = 0;
            }

            targetVy = 0; // Let gravity/physics handle vertical movement on land
            // Reset swim timers if on land
            this.swimTargetChangeCooldown = 0.1;


        } else {
             // --- AIRBORNE / TRANSITION LOGIC (e.g., falling after a hop, or non-swimmer in water) ---
             // If falling after a land hop, continue with the land target velocity briefly
             if (this.landActionTimer > 0) {
                  this.landActionTimer -= dt;
                  targetVx = this.landTargetVx; // Apply the stored horizontal velocity
             } else {
                 targetVx = 0;
             }
             // Let gravity handle vertical movement (Enemy.update) - no vertical target from AI
             targetVy = 0;
             jump = false; // Not actively jumping/stroking here

             // Ensure attack flag is off if timer expired while airborne
             if (this.enemy.isFlopAttacking && this.flopAttackTimer <= 0) {
                 this.enemy.isFlopAttacking = false;
             }
             // If the enemy transitions from water to air (e.g., jumps out), landActionTimer and landTargetVx will be 0,
             // and isInWater will be false, isOnGround will be false. This state correctly results in targetVx=0,
             // letting gravity take over until it hits ground or water again.
        }
        // Return the calculated movement intent
        return { targetVx, targetVy, jump }; // jump flag is only for land hops
    }

    reactToCollision(collisionResult) {
        // Reset land flop horizontal movement if hitting wall on land *during* the hop action timer
        if (collisionResult.collidedX && !this.enemy.isInWater && this.landActionTimer > 0) {
            this.landActionTimer = 0; // Stop horizontal movement immediately on wall hit
            this.landTargetVx = 0;
            // console.log("[Tetrapod AI] Collided horizontally on land, stopped action timer.");
        }
        // Swimming collision? Maybe change direction?
        if ((collisionResult.collidedX || collisionResult.collidedY) && this.enemy.isInWater) {
             // Hit something while swimming, pick new target sooner
             this.swimTargetChangeCooldown = 0;
             // console.log("[Tetrapod AI] Collided while swimming, resetting swim target cooldown.");
        }

        // Note: The Enemy.js collideAndResolve method handles stopping velocity upon collision.
        // We only need AI reaction if it should *change its intent* based on the collision.
    }
}