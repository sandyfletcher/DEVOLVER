// js/ui.js

import * as Config from './config.js';

// Keep track of the button's calculated position for click detection
let playAgainButtonRect = null;

/**
 * Draws the main game UI OR the Game Over screen.
 * @param {CanvasRenderingContext2D} ctx - The drawing context.
 * @param {number} currentHealth - Player's current health points.
 * @param {number} maxHealth - Player's maximum possible health points.
 * @param {object} waveInfo - Object containing wave state details.
 *                             Example: { number: 1, state: 'ACTIVE', timer: 0 }
 */
export function draw(ctx, currentHealth, maxHealth, waveInfo = {}) {
    ctx.save();

    if (waveInfo.state === 'GAME_OVER') {
        // --- Draw Game Over Screen ---

        // Semi-transparent overlay
        ctx.fillStyle = Config.UI_GAMEOVER_OVERLAY_COLOR;
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

        // "GAME OVER" Text
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = Config.UI_GAMEOVER_TEXT_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("GAME OVER", Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT * 0.3);

        // Stats Text
        ctx.font = '24px sans-serif';
        ctx.fillStyle = Config.UI_GAMEOVER_STATS_COLOR;
        let statsY = Config.CANVAS_HEIGHT * 0.5;
        ctx.fillText(`Waves Survived: ${waveInfo.number}`, Config.CANVAS_WIDTH / 2, statsY);
        statsY += 35;
        // Add placeholders for future stats
        // ctx.fillText(`Enemies Slain: ${stats.enemiesSlain}`, Config.CANVAS_WIDTH / 2, statsY);
        // statsY += 35;
        // ctx.fillText(`Tiles Placed: ${stats.tilesPlaced}`, Config.CANVAS_WIDTH / 2, statsY);
        // statsY += 35;


        // "PLAY AGAIN" Button
        const btnWidth = Config.UI_GAMEOVER_BUTTON_WIDTH;
        const btnHeight = Config.UI_GAMEOVER_BUTTON_HEIGHT;
        const btnX = (Config.CANVAS_WIDTH - btnWidth) / 2;
        const btnY = Config.CANVAS_HEIGHT * 0.75 - (btnHeight / 2);

        // Store button rect for click detection elsewhere
        playAgainButtonRect = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };

        // Draw button background
        ctx.fillStyle = Config.UI_GAMEOVER_BUTTON_COLOR;
        ctx.fillRect(btnX, btnY, btnWidth, btnHeight);

        // Draw button text
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = Config.UI_GAMEOVER_BUTTON_TEXT_COLOR;
        ctx.fillText("PLAY AGAIN", Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT * 0.75);

    } else {
        // --- Draw Regular In-Game UI ---
        playAgainButtonRect = null; // No button when not game over

        // Health Bar (as before)
        ctx.fillStyle = Config.UI_TEXT_COLOR;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const healthLabel = "HEALTH:";
        const labelY = Config.UI_Y_POSITION + Config.UI_HEALTH_BOX_SIZE / 2;
        ctx.fillText(healthLabel, Config.UI_HEALTH_LABEL_X, labelY);
        for (let i = 0; i < Config.PLAYER_MAX_HEALTH; i++) {
            const boxX = Config.UI_HEALTH_BOX_START_X + i * (Config.UI_HEALTH_BOX_SIZE + Config.UI_HEALTH_BOX_PADDING);
            const boxY = Config.UI_Y_POSITION;
            ctx.fillStyle = (i < currentHealth) ? Config.UI_HEALTH_BOX_COLOR_FULL : Config.UI_HEALTH_BOX_COLOR_EMPTY;
            ctx.fillRect(boxX, boxY, Config.UI_HEALTH_BOX_SIZE, Config.UI_HEALTH_BOX_SIZE);
        }

        // Wave Info (as before)
        ctx.fillStyle = Config.UI_TEXT_COLOR;
        ctx.textAlign = 'right';
        const waveTextX = Config.CANVAS_WIDTH - 10;
        if (waveInfo.state === 'INTERMISSION') {
            const time = waveInfo.timer > 0 ? waveInfo.timer.toFixed(1) : '0.0';
            ctx.fillText(`Next Wave In: ${time}s`, waveTextX, labelY);
        } else if (waveInfo.state === 'ACTIVE' || waveInfo.state === 'SPAWNING') {
             ctx.fillText(`Wave: ${waveInfo.number}`, waveTextX, labelY);
        } else if (waveInfo.state === 'PRE_WAVE') {
             ctx.fillText(`Get Ready...`, waveTextX, labelY);
        }
    }

    ctx.restore();
}

/**
 * Gets the bounding rectangle of the 'Play Again' button, if it's currently displayed.
 * @returns {object | null} The button rect {x, y, width, height} or null.
 */
export function getPlayAgainButtonRect() {
    return playAgainButtonRect;
}