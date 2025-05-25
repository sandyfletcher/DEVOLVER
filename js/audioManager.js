// -----------------------------------------------------------------------------
// root/js/audioManager.js - Manages Audio Playback
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as DebugLogger from './utils/debugLogger.js'; // Import the new logger

let gameMusicAudio = null; // Audio element for gameplay wave music
let uiMusicAudio = null; // Audio element for UI/menu music
let sfxAudioPool = []; // Array of audio elements for sound effects
let currentGameTrackPath = null; // Keep track of which tracks are loaded to avoid unnecessary reloads
let currentUITrackPath = null;
let gameVolume = Config.AUDIO_DEFAULT_GAME_VOLUME; // Volume settings
let uiVolume = Config.AUDIO_DEFAULT_UI_VOLUME;
let sfxVolume = Config.AUDIO_DEFAULT_SFX_VOLUME;
let isMusicMuted = false; // Mute state and last non-zero volumes
let isSfxMuted = false;

// --- Initialize audio manager, create all necessary audio elements and pool
export function init() {
    gameMusicAudio = new Audio();
    gameMusicAudio.loop = true;
    gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
    gameMusicAudio.style.display = 'none';
    document.body.appendChild(gameMusicAudio);

    uiMusicAudio = new Audio();
    uiMusicAudio.loop = true;
    uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
    uiMusicAudio.style.display = 'none';
    document.body.appendChild(uiMusicAudio);

    sfxAudioPool = [];
    for (let i = 0; i < Config.AUDIO_SFX_POOL_SIZE; i++) {
        const sfx = new Audio();
        sfx.loop = false;
        sfx.volume = isSfxMuted ? 0 : sfxVolume;
        sfx.style.display = 'none';
        document.body.appendChild(sfx);
        sfxAudioPool.push(sfx);
    }
    DebugLogger.log("AudioManager: Initialized.");
}

// --- Sets volume globally or for specific audio types ---
export function setVolume(type, volume) {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    switch (type) {
        case 'game':
            gameVolume = clampedVolume;
            if (gameMusicAudio && !isMusicMuted) {
                gameMusicAudio.volume = gameVolume;
            }
            // DebugLogger.log(`AudioManager: Game volume set to ${gameVolume.toFixed(2)}`);
            break;
        case 'ui':
            uiVolume = clampedVolume;
            if (uiMusicAudio && !isMusicMuted) {
                uiMusicAudio.volume = uiVolume;
            }
            // DebugLogger.log(`AudioManager: UI volume set to ${uiVolume.toFixed(2)}`);
            break;
        case 'sfx':
            sfxVolume = clampedVolume;
            if (!isSfxMuted) {
                sfxAudioPool.forEach(sfx => sfx.volume = sfxVolume);
            }
            // DebugLogger.log(`AudioManager: SFX volume set to ${sfxVolume.toFixed(2)}`);
            break;
        case 'master':
            DebugLogger.warn("AudioManager: Master volume not yet implemented. Use 'game', 'ui', or 'sfx'.");
            break;
        default:
            DebugLogger.warn(`AudioManager: Unknown volume type: ${type}`);
    }
}

// Toggle mute state for music
export function toggleMusicMute() {
    isMusicMuted = !isMusicMuted;
    if (gameMusicAudio) {
        gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
    }
    if (uiMusicAudio) {
        uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
    }
    DebugLogger.log(`AudioManager: Music is now ${isMusicMuted ? 'muted' : 'unmuted'}.`);
    return isMusicMuted;
}

// Toggle mute state for SFX
export function toggleSfxMute() {
    isSfxMuted = !isSfxMuted;
    sfxAudioPool.forEach(sfx => {
        sfx.volume = isSfxMuted ? 0 : sfxVolume;
    });
    DebugLogger.log(`AudioManager: SFX is now ${isSfxMuted ? 'muted' : 'unmuted'}.`);
    return isSfxMuted;
}

// Plays a specific game music track. Stops UI music if playing.
export function playGameMusic(trackPath) {
    // DebugLogger.log(`AudioManager: Requesting to play game music: ${trackPath}`);
    if (!gameMusicAudio || !uiMusicAudio) {
        DebugLogger.error("AudioManager: playGameMusic failed, audio elements not ready.");
        return;
    }

    stopUIMusic();

    if (!trackPath) {
        // DebugLogger.log("AudioManager: Empty trackPath provided for game music, stopping current game music.");
        stopGameMusic();
        return;
    }

    const trackUrl = new URL(trackPath, window.location.href).href;

    if (gameMusicAudio.src === trackUrl && gameMusicAudio.currentTime > 0 && !gameMusicAudio.ended) {
        // DebugLogger.log(`AudioManager: Game music track ${trackPath} is already the current track.`);
        if (gameMusicAudio.paused) {
            // DebugLogger.log(`AudioManager: Current game track ${trackPath} is paused, attempting to unpause.`);
            unpauseGameMusic();
        } else {
            // DebugLogger.log(`AudioManager: Current game track ${trackPath} is already playing.`);
            gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        }
        return;
    }

    // DebugLogger.log("AudioManager: New game music track requested, stopping current game music.");
    stopGameMusic();

    gameMusicAudio.src = trackPath;
    currentGameTrackPath = trackPath;
    gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
    // DebugLogger.log(`AudioManager: Game music source set to ${trackPath}. Attempting to play...`);

    const playPromise = gameMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // DebugLogger.log(`AudioManager: Game music playback started successfully: ${trackPath}`);
        }).catch(error => {
            DebugLogger.warn(`AudioManager: Game music playback blocked for ${trackPath}:`, error);
            gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        });
    } else {
        // DebugLogger.log("AudioManager: gameMusicAudio.play() did not return a promise.");
        gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
    }
}

// Plays a specific UI/Menu music track. Pauses game music if currently playing.
export function playUIMusic(trackPath) {
    // DebugLogger.log(`AudioManager: Requesting to play UI music: ${trackPath}`);
    if (!uiMusicAudio || !gameMusicAudio) {
        DebugLogger.error("AudioManager: playUIMusic failed, audio elements not ready.");
        return;
    }

    if (gameMusicAudio && !gameMusicAudio.paused && gameMusicAudio.currentTime > 0) {
        // DebugLogger.log(`AudioManager: Game music is playing. Pausing game music before starting UI music.`);
        pauseGameMusic();
    }

    if (!trackPath) {
        // DebugLogger.log("AudioManager: Empty trackPath provided for UI music, stopping current UI music.");
        stopUIMusic();
        return;
    }

    const trackUrl = new URL(trackPath, window.location.href).href;

    if (uiMusicAudio.src === trackUrl && uiMusicAudio.currentTime > 0 && !uiMusicAudio.ended) {
        // DebugLogger.log(`AudioManager: UI music track ${trackPath} is already the current track.`);
        if (uiMusicAudio.paused) {
            // DebugLogger.log(`AudioManager: Current UI track ${trackPath} is paused, attempting to unpause.`);
            resumeUIMusic();
        } else {
            // DebugLogger.log(`AudioManager: Current UI track ${trackPath} is already playing.`);
            uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        }
        return;
    }

    // DebugLogger.log("AudioManager: New UI music track requested, stopping current UI music.");
    stopUIMusic();

    uiMusicAudio.src = trackPath;
    currentUITrackPath = trackPath;
    uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;

    // DebugLogger.log(`AudioManager: UI music source set to ${trackPath}. Attempting to play...`);

    const playPromise = uiMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // DebugLogger.log(`AudioManager: UI music playback started successfully: ${trackPath}`);
        }).catch(error => {
            DebugLogger.warn(`AudioManager: UI music playback blocked for ${trackPath}:`, error);
            uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        });
    } else {
        // DebugLogger.log("AudioManager: uiMusicAudio.play() did not return a promise.");
        uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
    }
}

/** Stops the current game music track and resets playback time. */
export function stopGameMusic() {
    // DebugLogger.log(`AudioManager: Stopping game music. Current track: ${currentGameTrackPath}`);
    if (gameMusicAudio) {
        gameMusicAudio.pause();
        gameMusicAudio.currentTime = 0;
        const stoppedTrack = currentGameTrackPath;
        currentGameTrackPath = null;
        // DebugLogger.log(`AudioManager: Game music stopped. Track "${stoppedTrack}" reset.`);
    } else {
        DebugLogger.warn("AudioManager: stopGameMusic called but gameMusicAudio is null.");
    }
}

/** Pauses the current game music track. */
export function pauseGameMusic() {
    // DebugLogger.log(`AudioManager: Pausing game music. Current track: ${currentGameTrackPath}, Time: ${gameMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`);
    if (gameMusicAudio && !gameMusicAudio.paused) {
        gameMusicAudio.pause();
        // DebugLogger.log(`AudioManager: Game music paused. Track "${currentGameTrackPath}" at ${gameMusicAudio.currentTime.toFixed(2)}s.`);
    } else {
        // DebugLogger.log("AudioManager: pauseGameMusic called but game music was already paused or null.");
    }
}

export function unpauseGameMusic() {
    DebugLogger.log(`AudioManager: Attempting to unpause game music. Paused: ${gameMusicAudio?.paused}, Track: ${currentGameTrackPath}, Muted: ${isMusicMuted}`);
    stopUIMusic();
    if (gameMusicAudio && currentGameTrackPath && gameMusicAudio.paused) {
        gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        const playPromise = gameMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                DebugLogger.log(`AudioManager: Game music unpaused successfully: ${currentGameTrackPath}`);
            }).catch(error => {
                DebugLogger.warn(`AudioManager: Game music unpause blocked for ${currentGameTrackPath}:`, error);
                gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
            });
        } else {
            // DebugLogger.log("AudioManager: gameMusicAudio.play() did not return a promise during unpause attempt.");
            gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        }
    } else {
        DebugLogger.log("AudioManager: Game music not unpaused (conditions not met).");
        if (gameMusicAudio && isMusicMuted) {
            gameMusicAudio.volume = 0;
        }
    }
}

export function stopUIMusic() {
    DebugLogger.log(`AudioManager: Stopping UI music. Current track: ${currentUITrackPath}`);
    if (uiMusicAudio) {
        uiMusicAudio.pause();
        uiMusicAudio.currentTime = 0;
        const stoppedTrack = currentUITrackPath;
        currentUITrackPath = null;
        DebugLogger.log(`AudioManager: UI music stopped. Track "${stoppedTrack}" reset.`);
    } else {
        DebugLogger.warn("AudioManager: stopUIMusic called but uiMusicAudio is null.");
    }
}

/** Pauses the current UI/Menu music track. */
export function pauseUIMusic() {
    // DebugLogger.log(`AudioManager: Pausing UI music. Current track: ${currentUITrackPath}, Time: ${uiMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`);
    if (uiMusicAudio && !uiMusicAudio.paused) {
        uiMusicAudio.pause();
        DebugLogger.log(`AudioManager: UI music paused. Track "${currentUITrackPath}" at ${uiMusicAudio.currentTime.toFixed(2)}s.`);
    } else {
        // DebugLogger.log("AudioManager: pauseUIMusic called but UI music was already paused or null.");
    }
}

/** Resumes the paused UI/Menu music track. */
export function resumeUIMusic() {
    DebugLogger.log(`AudioManager: Attempting to resume UI music. paused=${uiMusicAudio?.paused}, track=${currentUITrackPath}, Muted: ${isMusicMuted}`);
    if (uiMusicAudio && uiMusicAudio.paused && currentUITrackPath) {
        uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        const playPromise = uiMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                DebugLogger.log(`AudioManager: UI music resumed successfully: ${currentUITrackPath}`);
            }).catch(error => {
                DebugLogger.warn(`AudioManager: UI music resume blocked for ${currentUITrackPath}:`, error);
                uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
            });
        } else {
            // DebugLogger.log("AudioManager: uiMusicAudio.play() did not return a promise during resume attempt.");
            uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        }
    } else {
        DebugLogger.log("AudioManager: UI music not resumed (conditions not met).");
        if (uiMusicAudio && isMusicMuted) {
            uiMusicAudio.volume = 0;
        }
    }
}

/** Stops ALL music (both game and UI). */
export function stopAllMusic() {
    // DebugLogger.log("AudioManager: Stopping all music.");
    stopGameMusic();
    stopUIMusic();
}

// Plays a specific sound effect.
export function playSound(sfxPath, volume = sfxVolume) {
    if (isSfxMuted) {
        // DebugLogger.log(`AudioManager: SFX muted, skipping play: ${sfxPath}`);
        return;
    }

    if (!sfxPath || !sfxAudioPool.length) {
        // DebugLogger.warn(`AudioManager: playSound called with invalid path or empty pool: ${sfxPath}`);
        return;
    }
    const availableSfx = sfxAudioPool.find(sfx => sfx.paused || sfx.ended);

    if (availableSfx) {
        const sfxUrl = new URL(sfxPath, window.location.href).href;

        if (!availableSfx.src || availableSfx.src !== sfxUrl) {
            availableSfx.src = sfxPath;
            // DebugLogger.log(`AudioManager: SFX pool element source set to ${sfxPath}`);
        }

        availableSfx.volume = Math.max(0, Math.min(1, volume));
        availableSfx.currentTime = 0;

        const playPromise = availableSfx.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                DebugLogger.log(`AudioManager: Playing SFX: ${sfxPath}`);
            }).catch(error => {
                DebugLogger.warn(`AudioManager: SFX playback blocked for ${sfxPath}:`, error);
                if (isSfxMuted) availableSfx.volume = 0;
            });
        } else {
            // DebugLogger.log("AudioManager: SFX play() did not return a promise.");
            if (isSfxMuted) availableSfx.volume = 0;
        }
    } else {
        DebugLogger.warn(`AudioManager: SFX pool exhausted. Could not play ${sfxPath}`);
    }
}

export function getMusicMutedState() { return isMusicMuted; }
export function getSfxMutedState() { return isSfxMuted; }
export function getGameVolume() { return gameVolume; }
export function getUiVolume() { return uiVolume; }
export function getSfxVolume() { return sfxVolume; }