// root/js/audioManager.js - Manages game audio playback
// -----------------------------------------------------------------------------

import * as Config from './config.js';

// --- Module State ---
let gameMusicAudio = null; // Audio element for gameplay wave music
let uiMusicAudio = null;   // Audio element for UI/menu music
let sfxAudioPool = [];     // Array of audio elements for sound effects

// Keep track of which tracks are loaded to avoid unnecessary reloads
let currentGameTrackPath = null;
let currentUITrackPath = null;

// We will remove gameMusicWasPlayingBeforeUI flag from AudioManager


// Volume settings
let gameVolume = Config.AUDIO_DEFAULT_GAME_VOLUME;
let uiVolume = Config.AUDIO_DEFAULT_UI_VOLUME;
let sfxVolume = Config.AUDIO_DEFAULT_SFX_VOLUME;


/**
 * Initializes the audio manager. Creates all necessary audio elements and pool.
 */
export function init() {
    // Create main music elements
    gameMusicAudio = new Audio();
    gameMusicAudio.loop = true;
    gameMusicAudio.volume = gameVolume;
    gameMusicAudio.style.display = 'none';
    // Add a 'canplaythrough' listener for potential future use, but primarily rely on user gesture unlock
    // gameMusicAudio.addEventListener('canplaythrough', () => console.log("AudioManager: Game music ready."));
    document.body.appendChild(gameMusicAudio);

    uiMusicAudio = new Audio();
    uiMusicAudio.loop = true; // UI music might loop (e.g., pause screen)
    uiMusicAudio.volume = uiVolume;
    uiMusicAudio.style.display = 'none';
    // uiMusicAudio.addEventListener('canplaythrough', () => console.log("AudioManager: UI music ready."));
    document.body.appendChild(uiMusicAudio);

    // Create SFX pool
    sfxAudioPool = [];
    for (let i = 0; i < Config.AUDIO_SFX_POOL_SIZE; i++) {
        const sfx = new Audio();
        sfx.loop = false; // SFX should not loop
        sfx.volume = sfxVolume;
        sfx.style.display = 'none';
        document.body.appendChild(sfx);
        sfxAudioPool.push(sfx);
    }

    // --- Audio Context Unlock Strategy ---
    // The recommended way is to have the first *user interaction* (like the START GAME button click)
    // trigger an attempt to play *all* relevant audio contexts (or silent audio).
    // This is often done in main.js or the module handling the initial button click.
    // We don't do the unlock *here* in init(), but rather ensure playMusic/playSound handle
    // the potential promise rejection and rely on a user gesture triggering them.
}

/**
 * Sets the volume for specific audio types or globally.
 * @param {string} type - 'game', 'ui', 'sfx', or 'master'.
 * @param {number} volume - Volume level between 0.0 and 1.0.
 */
export function setVolume(type, volume) {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    switch (type) {
        case 'game':
            gameVolume = clampedVolume;
            if (gameMusicAudio) gameMusicAudio.volume = gameVolume;
            // console.log(`AudioManager: Game volume set to ${gameVolume.toFixed(2)}`); // Keep logs quieter
            break;
        case 'ui':
            uiVolume = clampedVolume;
            if (uiMusicAudio) uiMusicAudio.volume = uiVolume;
            // console.log(`AudioManager: UI volume set to ${uiVolume.toFixed(2)}`); // Keep logs quieter
            break;
        case 'sfx':
            sfxVolume = clampedVolume;
            sfxAudioPool.forEach(sfx => sfx.volume = sfxVolume);
            // console.log(`AudioManager: SFX volume set to ${sfxVolume.toFixed(2)}`); // Keep logs quieter
            break;
        case 'master':
            // This would require scaling the individual volumes
            // For simplicity, let's just handle the specific types for now.
            console.warn("AudioManager: Master volume not yet implemented. Use 'game', 'ui', or 'sfx'.");
            break;
        default:
            console.warn(`AudioManager: Unknown volume type: ${type}`);
    }
}

// Plays a specific game music track. Stops UI music if playing.
// Will restart the track from the beginning if a new track path is provided.
export function playGameMusic(trackPath) {
    // console.log(`AudioManager: Requesting to play game music: ${trackPath}`);
    if (!gameMusicAudio || !uiMusicAudio) {
        console.error("AudioManager: playGameMusic failed, audio elements not ready.");
        return;
    }

    // Stop UI music immediately when game music is requested
    stopUIMusic();

    // If no track path is provided, stop the current game music.
    if (!trackPath) {
        // console.log("AudioManager: Empty trackPath provided for game music, stopping current game music."); // Keep logs quieter
        stopGameMusic(); // This logs its action internally
        return;
    }

    // Check if the requested track is already loaded and playing/paused.
    // Construct full path to compare reliably
    const trackUrl = new URL(trackPath, window.location.href).href;

    if (gameMusicAudio.src === trackUrl && gameMusicAudio.currentTime > 0 && !gameMusicAudio.ended) {
        // It's the same track and it's been played (not just loaded).
        // console.log(`AudioManager: Game music track ${trackPath} is already the current track.`); // Keep logs quieter
        // If it's the same track, ensure it's playing/unpaused.
        if (gameMusicAudio.paused) {
            // console.log(`AudioManager: Current game track ${trackPath} is paused, attempting to unpause.`); // Keep logs quieter
             unpauseGameMusic(); // Use the simplified unpause function
        } else {
             // console.log(`AudioManager: Current game track ${trackPath} is already playing.`); // Keep logs quieter
        }
        return; // Do nothing further if already playing the same track
    }

    // New track requested, stop current game music before loading the new one.
    // console.log("AudioManager: New game music track requested, stopping current game music."); // Keep logs quieter
    stopGameMusic(); // This logs its action internally

    // Set the new track source and attempt to play.
    gameMusicAudio.src = trackPath;
    currentGameTrackPath = trackPath;
    // console.log(`AudioManager: Game music source set to ${trackPath}. Attempting to play...`); // Keep logs quieter

    const playPromise = gameMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // console.log(`AudioManager: Game music playback started successfully: ${trackPath}`); // Keep logs quieter
        }).catch(error => {
            console.warn(`AudioManager: Game music playback blocked for ${trackPath}:`, error);
            // This likely means no recent user interaction. Music will start
            // when a subsequent user gesture occurs *and* playGameMusic/unpauseGameMusic is called again.
            // Note: If playback fails, gameMusicAudio.paused will likely remain true.
        });
    } else {
         // console.log("AudioManager: gameMusicAudio.play() did not return a promise."); // Keep logs quieter
    }
}


// Plays a specific UI/Menu music track. Pauses game music if currently playing.
export function playUIMusic(trackPath) {
    // console.log(`AudioManager: Requesting to play UI music: ${trackPath}`); // Keep logs quieter
    if (!uiMusicAudio || !gameMusicAudio) {
         console.error("AudioManager: playUIMusic failed, audio elements not ready.");
        return;
    }

    // If game music is currently playing (not paused and has started), pause it.
    if (gameMusicAudio && !gameMusicAudio.paused && gameMusicAudio.currentTime > 0) {
        // console.log(`AudioManager: Game music is playing. Pausing game music before starting UI music.`); // Keep logs quieter
        pauseGameMusic(); // Use the simplified pause function
    }

    // If no track path is provided, stop current UI music.
    if (!trackPath) {
         // console.log("AudioManager: Empty trackPath provided for UI music, stopping current UI music."); // Keep logs quieter
        stopUIMusic(); // This logs its action internally
        return;
    }

    // Check if the requested UI track is already loaded and playing/paused.
    const trackUrl = new URL(trackPath, window.location.href).href;

    if (uiMusicAudio.src === trackUrl && uiMusicAudio.currentTime > 0 && !uiMusicAudio.ended) {
        // It's the same UI track and it's been played.
        // console.log(`AudioManager: UI music track ${trackPath} is already the current track.`); // Keep logs quieter
         // If it's the same track, ensure it's playing/unpaused.
         if (uiMusicAudio.paused) {
             // console.log(`AudioManager: Current UI track ${trackPath} is paused, attempting to unpause.`); // Keep logs quieter
             resumeUIMusic(); // Use the existing UI resume function (which is simple)
         } else {
             // console.log(`AudioManager: Current UI track ${trackPath} is already playing.`); // Keep logs quieter
         }
        return; // Do nothing further
    }

    // New UI track requested, stop current UI music before loading.
    // console.log("AudioManager: New UI music track requested, stopping current UI music."); // Keep logs quieter
    stopUIMusic();

    // Set the new UI track source and attempt to play.
    uiMusicAudio.src = trackPath;
    currentUITrackPath = trackPath;
    // console.log(`AudioManager: UI music source set to ${trackPath}. Attempting to play...`); // Keep logs quieter

    const playPromise = uiMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // console.log(`AudioManager: UI music playback started successfully: ${trackPath}`); // Keep logs quieter
        }).catch(error => {
            console.warn(`AudioManager: UI music playback blocked for ${trackPath}:`, error);
            // UI music will start when a subsequent user gesture occurs *and* playUIMusic is called again.
        });
    } else {
        // console.log("AudioManager: uiMusicAudio.play() did not return a promise."); // Keep logs quieter
    }
}


/** Stops the current game music track and resets playback time. */
export function stopGameMusic() {
    // console.log(`AudioManager: Stopping game music. Current track: ${currentGameTrackPath}`); // Keep logs quieter
    if (gameMusicAudio) {
        gameMusicAudio.pause();
        gameMusicAudio.currentTime = 0;
        const stoppedTrack = currentGameTrackPath; // Store before nulling
        currentGameTrackPath = null;
        // console.log(`AudioManager: Game music stopped. Track "${stoppedTrack}" reset.`); // Keep logs quieter
    } else {
        console.warn("AudioManager: stopGameMusic called but gameMusicAudio is null.");
    }
}

/** Pauses the current game music track. */
export function pauseGameMusic() {
    // console.log(`AudioManager: Pausing game music. Current track: ${currentGameTrackPath}, Time: ${gameMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`); // Keep logs quieter
    if (gameMusicAudio && !gameMusicAudio.paused) {
        gameMusicAudio.pause();
        // console.log(`AudioManager: Game music paused. Track "${currentGameTrackPath}" at ${gameMusicAudio.currentTime.toFixed(2)}s.`); // Keep logs quieter
    } else {
        // console.log("AudioManager: pauseGameMusic called but game music was already paused or null."); // Keep logs quieter
    }
}

/**
 * Attempts to unpause/resume the current game music track.
 * Called by main.js when transitioning from PAUSED back to RUNNING.
 */
// Renamed from resumeGameMusic for clarity - it unpauses, it doesn't "resume the game".
export function unpauseGameMusic() {
    // console.log(`AudioManager: Attempting to unpause game music. Paused: ${gameMusicAudio?.paused}, Track: ${currentGameTrackPath}`); // Keep logs quieter
     // Check if there's an audio element, a track source is set, and it's currently paused.
     if (gameMusicAudio && currentGameTrackPath && gameMusicAudio.paused) {
         // console.log(`AudioManager: Conditions met for unpausing game music. Attempting to play "${currentGameTrackPath}" from ${gameMusicAudio.currentTime.toFixed(2)}s...`); // Keep logs quieter
        const playPromise = gameMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: Game music unpaused successfully: ${currentGameTrackPath}`); // Keep logs quieter
            }).catch(error => {
                console.warn(`AudioManager: Game music unpause blocked for ${currentGameTrackPath}:`, error);
                 // If playback is blocked (e.g., no user gesture), the element will remain paused.
                 // The game loop in main.js might need to re-attempt unpause on subsequent frames if desired,
                 // but the simpler approach is to rely on the *next* user gesture hitting an input handler
                 // that potentially calls playSound or playGameMusic again.
            });
        } else {
             // console.log("AudioManager: gameMusicAudio.play() did not return a promise during unpause attempt."); // Keep logs quieter
        }
    } else {
         // console.log("AudioManager: Game music not unpaused (conditions not met)."); // Keep logs quieter
         // If there's a current track but it's *not* paused, this function does nothing, which is correct.
    }
}


/** Stops the current UI/Menu music track and resets playback time. */
export function stopUIMusic() {
    // console.log(`AudioManager: Stopping UI music. Current track: ${currentUITrackPath}`); // Keep logs quieter
    if (uiMusicAudio) {
        uiMusicAudio.pause();
        uiMusicAudio.currentTime = 0;
        const stoppedTrack = currentUITrackPath; // Store before nulling
        currentUITrackPath = null;
        // console.log(`AudioManager: UI music stopped. Track "${stoppedTrack}" reset.`); // Keep logs quieter
    } else {
        console.warn("AudioManager: stopUIMusic called but uiMusicAudio is null.");
    }
}

/** Pauses the current UI/Menu music track. */
export function pauseUIMusic() {
     // console.log(`AudioManager: Pausing UI music. Current track: ${currentUITrackPath}, Time: ${uiMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`); // Keep logs quieter
     if (uiMusicAudio && !uiMusicAudio.paused) {
        uiMusicAudio.pause();
        // console.log(`AudioManager: UI music paused. Track "${currentUITrackPath}" at ${uiMusicAudio.currentTime.toFixed(2)}s.`); // Keep logs quieter
    } else {
        // console.log("AudioManager: pauseUIMusic called but UI music was already paused or null."); // Keep logs quieter
    }
}

/** Resumes the paused UI/Menu music track. */
export function resumeUIMusic() {
    // console.log(`AudioManager: Attempting to resume UI music. paused=${uiMusicAudio?.paused}, track=${currentUITrackPath}`); // Keep logs quieter
     if (uiMusicAudio && uiMusicAudio.paused && currentUITrackPath) {
         // console.log(`AudioManager: Conditions met for resuming UI music. Attempting to play "${currentUITrackPath}" from ${uiMusicAudio.currentTime.toFixed(2)}s...`); // Keep logs quieter
        const playPromise = uiMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: UI music resumed successfully: ${currentUITrackPath}`); // Keep logs quieter
            }).catch(error => {
                console.warn(`AudioManager: UI music resume blocked for ${currentUITrackPath}:`, error);
            });
        } else {
             // console.log("AudioManager: uiMusicAudio.play() did not return a promise during resume attempt."); // Keep logs quieter
        }
    } else {
         // console.log("AudioManager: UI music not resumed (conditions not met)."); // Keep logs quieter
    }
}

/** Stops ALL music (both game and UI). */
export function stopAllMusic() {
    // console.log("AudioManager: Stopping all music."); // Keep logs quieter
    stopGameMusic(); // This logs its action
    stopUIMusic();   // This logs its action
}

// Plays a specific sound effect. Finds an available audio element in the pool with optional volume override
export function playSound(sfxPath, volume = sfxVolume) {
    if (!sfxPath || !sfxAudioPool.length) {
        // console.warn(`AudioManager: playSound called with invalid path or empty pool: ${sfxPath}`); // Keep logs quieter
        return;
    }
    // Find an available audio element (paused or ended)
    const availableSfx = sfxAudioPool.find(sfx => sfx.paused || sfx.ended);

    if (availableSfx) {
        // Check if the source needs updating to avoid unnecessary reloads
        // Construct full path to compare reliably
        const sfxUrl = new URL(sfxPath, window.location.href).href;

        // If the source is different or not set, update it
        if (!availableSfx.src || availableSfx.src !== sfxUrl) {
             availableSfx.src = sfxPath; // Set src using the potentially relative path
             // console.log(`AudioManager: SFX pool element source set to ${sfxPath}`); // Keep logs quieter
        }

        availableSfx.volume = Math.max(0, Math.min(1, volume));
        availableSfx.currentTime = 0; // Rewind to start for immediate playback

        const playPromise = availableSfx.play();
         if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: Playing SFX: ${sfxPath}`); // Keep logs quieter
            }).catch(error => {
                 // This is less likely for short SFX triggered by direct input,
                 // but can happen. Log it.
                console.warn(`AudioManager: SFX playback blocked for ${sfxPath}:`, error);
            });
        } else {
             // console.log("AudioManager: SFX play() did not return a promise."); // Keep logs quieter
        }

    } else {
        // console.warn(`AudioManager: SFX pool exhausted. Could not play ${sfxPath}`); // Keep logs quieter
    }
}

// Expose a public getter for current volume levels if needed for UI sliders etc.
// export function getVolumes() { return { game: gameVolume, ui: uiVolume, sfx: sfxVolume }; }