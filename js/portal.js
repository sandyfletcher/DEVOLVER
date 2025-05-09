// -----------------------------------------------------------------------------
// root/js/portal.js - The core structure that needs defending
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as WaveManager from './waveManager.js'; // to check game state

export class Portal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = Config.PORTAL_WIDTH;
        this.height = Config.PORTAL_HEIGHT;
        this.color = Config.PORTAL_COLOR;
        this.maxHealth = Config.PORTAL_INITIAL_HEALTH;
        this.currentHealth = this.maxHealth;
        this.safetyRadius = Config.PORTAL_SAFETY_RADIUS; // Radius for future world aging effect, initial config value as starting point, but will be updated
        this.isActive = true; // Can be set to false if destroyed
        this.absorbingEnemies = [];
        // Initial position validation
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal CONSTRUCTOR ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
         console.log(`Portal created at [${this.x.toFixed(1)}, ${this.y.toFixed(1)}] with HP ${this.maxHealth} and safety radius ${this.safetyRadius}`);
    }
    // Updates the portal's state and checks for nearby enemies to eat
    update(dt) {
        if (!this.isActive) return;
        // Update absorbing enemies
        for (let i = this.absorbingEnemies.length - 1; i >= 0; i--) {
            const absorptionInfo = this.absorbingEnemies[i];
            absorptionInfo.timer -= dt;
            if (absorptionInfo.timer <= 0) {
                // Animation finished
                if (absorptionInfo.enemyRef) {
                    absorptionInfo.enemyRef.isActive = false; // Mark for despawn by EnemyManager
                    // absorptionInfo.enemyRef.isBeingAbsorbed = false; // Can clear this now if needed, though isActive=false is primary
                    // console.log(`Portal finished absorbing ${absorptionInfo.enemyRef.displayName}`);
                }
                this.absorbingEnemies.splice(i, 1);
            } else {
                // Update animation progress (position and scale will be calculated in draw or directly on enemyRef)
                // For simplicity, we'll calculate in draw. Or, we can update enemyRef's x,y,width,height here.
                // Let's update the enemyRef directly for better encapsulation if enemy.draw() handles it.
                // However, we made enemy.draw() return if isBeingAbsorbed. So portal must draw it.
                // The enemy's x, y, width, height will be determined during the portal's draw phase
                // based on absorptionInfo.enemyRef properties and the progress.
            }
        }
        // ... any other portal animations ...
    }
// Draws portal onto canvas
    draw(ctx) {
        if (!this.isActive || !ctx) return;
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error(`>>> Portal DRAW ERROR: Preventing draw due to NaN coordinates!`);
            return;
        }
        // Get current game state from WaveManager
       const waveInfo = WaveManager.getWaveInfo();
       // Correct the check to include the new intermission states
       const isIntermission = waveInfo.state === 'BUILDPHASE' || waveInfo.state === 'WARPPHASE';

// Calculate portal's center for circle
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
// --- Draw safety radius circle during intermission ---
        if (isIntermission) {
             ctx.save(); // Save context state before setting globalAlpha
             ctx.fillStyle = 'rgba(100, 100, 255, 0.1)'; // Transparent blueish fill
             ctx.strokeStyle = 'rgba(100, 100, 255, 0.5)'; // Semi-transparent blueish outline
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(centerX, centerY, this.safetyRadius, 0, Math.PI * 2);
             ctx.fill();
             ctx.stroke();
             ctx.restore(); // Restore context state
        }
        // Basic rectangular representation for now?
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
        // Draw silver border
        if (Config.PORTAL_BORDER_WIDTH > 0) {
            ctx.strokeStyle = Config.PORTAL_BORDER_COLOR;
            ctx.lineWidth = Config.PORTAL_BORDER_WIDTH;
            // strokeRect draws on the edge, so if lineWidth is, say, 2,
            // 1px will be inside and 1px outside the fillRect.
            // For a border fully outside, you might adjust x,y,width,height for strokeRect,
            // or for a border fully inside, draw a slightly smaller fillRect first.
            // Let's do a simple stroke on the existing rect boundaries for now.
            ctx.strokeRect(
                Math.floor(this.x) + Config.PORTAL_BORDER_WIDTH / 2,
                Math.floor(this.y) + Config.PORTAL_BORDER_WIDTH / 2,
                this.width - Config.PORTAL_BORDER_WIDTH,
                this.height - Config.PORTAL_BORDER_WIDTH
            );
        }
        // Draw absorbing enemies
        if (this.absorbingEnemies.length > 0) {
            const portalCenterX = this.x + this.width / 2;
            const portalCenterY = this.y + this.height / 2;

            this.absorbingEnemies.forEach(absorptionInfo => {
                const enemy = absorptionInfo.enemyRef;
                if (!enemy || !enemy.isActive) return;

                const fullDuration = Config.PORTAL_ABSORB_ANIMATION_DURATION;
                const timeRemaining = absorptionInfo.timer;
                const progress = Math.max(0, 1.0 - (timeRemaining / fullDuration)); // 0 (start) to 1 (end)

                // Quadratic ease-in for movement and shrink
                const easedProgress = progress * progress;

                // Calculate current center of the enemy
                const startEnemyCenterX = absorptionInfo.startX + absorptionInfo.startWidth / 2;
                const startEnemyCenterY = absorptionInfo.startY + absorptionInfo.startHeight / 2;

                const currentEnemyCenterX = startEnemyCenterX + (portalCenterX - startEnemyCenterX) * easedProgress;
                const currentEnemyCenterY = startEnemyCenterY + (portalCenterY - startEnemyCenterY) * easedProgress;

                // Calculate current size
                const currentWidth = absorptionInfo.startWidth * (1.0 - easedProgress);
                const currentHeight = absorptionInfo.startHeight * (1.0 - easedProgress);

                // Calculate top-left for drawing
                const drawX = currentEnemyCenterX - currentWidth / 2;
                const drawY = currentEnemyCenterY - currentHeight / 2;

                if (currentWidth >= 1 && currentHeight >= 1) { // Only draw if still visible
                    ctx.fillStyle = enemy.color;
                    ctx.fillRect(
                        Math.floor(drawX),
                        Math.floor(drawY),
                        Math.ceil(currentWidth),
                        Math.ceil(currentHeight)
                    );
                }
            });
        }
    }
// Applies damage to portal
    takeDamage(amount) {
        if (!this.isActive || this.currentHealth <= 0) return;
        const damage = Math.max(0, amount); // Ensure damage is non-negative
        this.currentHealth -= damage;
        console.log(`Portal took ${damage} damage. Health: ${this.currentHealth}/${this.maxHealth}`);
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die(); // Trigger death sequence
        }
    }
// Handles portal's destruction
    die() {
        if (!this.isActive) return;
        console.log("The Portal has been destroyed!");
        this.isActive = false;
        // Add destruction animation, sound, etc. later
    }
// Resets portal's state completely for new game
    reset() {
        console.log("Resetting portal state...");
        this.safetyRadius = Config.PORTAL_SAFETY_RADIUS; // Reset radius to initial config value
        this.currentHealth = this.maxHealth; // Reset health to full
        this.isActive = true; // Make active again
        this.absorbingEnemies = [];
         if (isNaN(this.x) || isNaN(this.y)) {
             console.error(`>>> Portal RESET ERROR: NaN initial coordinates! Resetting to center.`);
             this.x = Config.CANVAS_WIDTH / 2 - this.width/2;
             this.y = Config.CANVAS_HEIGHT / 2 - this.height/2;
         }
    }
// Sets the current safety radius for the portal
    setSafetyRadius(radius) {
        this.safetyRadius = radius;
    }
// Gets the portal's bounding rectangle for collision
    getRect() {
        const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
        const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
        return { x: safeX, y: safeY, width: this.width, height: this.height };
    }
// Gets the portal's center position
    getPosition() {
         const safeX = typeof this.x === 'number' && !isNaN(this.x) ? this.x : 0;
         const safeY = typeof this.y === 'number' && !isNaN(this.y) ? this.y : 0;
         return { x: safeX + this.width / 2, y: safeY + this.height / 2 };
    }
// Checks if the portal is currently alive (health > 0)
    isAlive() {
        return this.isActive && this.currentHealth > 0;
    }
    startAbsorbing(enemy) {
    if (!enemy || enemy.isBeingAbsorbed || !enemy.isActive || enemy.isDying) {
        return; // Don't absorb if already being absorbed, inactive, or dying
    }
    enemy.isBeingAbsorbed = true; // Mark the enemy
    enemy.vx = 0; // Stop its movement
    enemy.vy = 0;
    this.absorbingEnemies.push({
        enemyRef: enemy,
        timer: Config.PORTAL_ABSORB_ANIMATION_DURATION,
        startX: enemy.x,
        startY: enemy.y,
        startWidth: enemy.width,
        startHeight: enemy.height,
    });
    // console.log(`Portal started absorbing ${enemy.displayName}`);
}
}