// -----------------------------------------------------------------------------
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

// State to remember if game music was playing when UI music started
let gameMusicWasPlayingBeforeUI = false;

// Volume settings
let gameVolume = Config.AUDIO_DEFAULT_GAME_VOLUME;
let uiVolume = Config.AUDIO_DEFAULT_UI_VOLUME;
let sfxVolume = Config.AUDIO_DEFAULT_SFX_VOLUME;


/**
 * Initializes the audio manager. Creates all necessary audio elements and pool.
 */
export function init() {
    console.log("AudioManager: Initializing...");

    // Create main music elements
    gameMusicAudio = new Audio();
    gameMusicAudio.loop = true;
    gameMusicAudio.volume = gameVolume;
    gameMusicAudio.style.display = 'none';
    document.body.appendChild(gameMusicAudio);
    console.log("AudioManager: Game music audio element created.");

    uiMusicAudio = new Audio();
    uiMusicAudio.loop = true; // UI music might loop (e.g., pause screen)
    uiMusicAudio.volume = uiVolume;
    uiMusicAudio.style.display = 'none';
    document.body.appendChild(uiMusicAudio);
     console.log("AudioManager: UI music audio element created.");

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
    console.log(`AudioManager: SFX Pool created with ${sfxAudioPool.length} elements.`);

    // --- Audio Context Unlock Strategy ---
    // The recommended way is to have the first *user interaction* (like the START GAME button click)
    // trigger an attempt to play *all* relevant audio contexts (or silent audio).
    // This is often done in main.js or the module handling the initial button click.
    // We don't do the unlock *here* in init(), but rather ensure playMusic/playSound handle
    // the potential promise rejection and rely on a user gesture triggering them.

    console.log("AudioManager: Initialization complete.");
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
            console.log(`AudioManager: Game volume set to ${gameVolume.toFixed(2)}`);
            break;
        case 'ui':
            uiVolume = clampedVolume;
            if (uiMusicAudio) uiMusicAudio.volume = uiVolume;
             console.log(`AudioManager: UI volume set to ${uiVolume.toFixed(2)}`);
            break;
        case 'sfx':
            sfxVolume = clampedVolume;
            sfxAudioPool.forEach(sfx => sfx.volume = sfxVolume);
            console.log(`AudioManager: SFX volume set to ${sfxVolume.toFixed(2)}`);
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

// Plays a specific game music track. Stops UI music if playing, pauses game music if already playing a different track.
export function playGameMusic(trackPath) {
    console.log(`AudioManager: Requesting to play game music: ${trackPath}`);
    if (!gameMusicAudio || !uiMusicAudio) {
        console.error("AudioManager: playGameMusic failed, audio elements not ready.");
        return;
    }

    // Stop UI music immediately when game music is requested
    stopUIMusic(); // This logs its action internally

    if (!trackPath) {
        console.log("AudioManager: Empty trackPath provided for game music, stopping current game music.");
        stopGameMusic(); // This logs its action internally
        return;
    }

    if (currentGameTrackPath === trackPath) {
        console.log(`AudioManager: Game music track ${trackPath} is already the current track.`);
        // Already playing this track, ensure it's not paused
        if (gameMusicAudio.paused) {
             console.log(`AudioManager: Current game track ${trackPath} is paused, attempting to resume.`);
            resumeGameMusic(); // This logs its action internally
        } else {
             console.log(`AudioManager: Current game track ${trackPath} is already playing.`);
        }
        return; // Do nothing if already playing/resumed the same track
    }

    // Stop the current game music before loading a new one
    console.log("AudioManager: New game music track requested, stopping current game music.");
    stopGameMusic(); // This logs its action internally

    // Set the new track source and play
    gameMusicAudio.src = trackPath;
    currentGameTrackPath = trackPath;
    console.log(`AudioManager: Game music source set to ${trackPath}. Attempting to play...`);

    const playPromise = gameMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log(`AudioManager: Game music playback started successfully: ${trackPath}`);
        }).catch(error => {
            console.warn(`AudioManager: Game music playback blocked for ${trackPath}:`, error);
            // This likely means no recent user interaction. The game music will start
            // when a subsequent user gesture occurs (like moving, attacking).
        });
    } else {
         console.log("AudioManager: gameMusicAudio.play() did not return a promise.");
    }
}

// Plays a specific UI/Menu music track. Pauses game music if currently playing.
export function playUIMusic(trackPath) {
    console.log(`AudioManager: Requesting to play UI music: ${trackPath}`);
    if (!uiMusicAudio || !gameMusicAudio) {
         console.error("AudioManager: playUIMusic failed, audio elements not ready.");
        return;
    }
    // If game music is currently playing (not paused), pause it.
    if (gameMusicAudio && !gameMusicAudio.paused && gameMusicAudio.currentTime > 0) { // Added currentTime > 0 check for robustness
        console.log(`AudioManager: Game music is playing. Pausing game music before starting UI music.`);
        pauseGameMusic();
    } else {
        // If game music is already paused or stopped, do nothing to gameMusicWasPlayingBeforeUI state.
        console.log(`AudioManager: Game music is already paused or stopped. Not affecting gameMusicWasPlayingBeforeUI.`);
    }
    if (!trackPath) {
         console.log("AudioManager: Empty trackPath provided for UI music, stopping current UI music.");
        stopUIMusic();
        return;
    }

    if (currentUITrackPath === trackPath) {
         console.log(`AudioManager: UI music track ${trackPath} is already the current track.`);
         // Already playing this track, ensure it's not paused
        if (uiMusicAudio.paused) {
            console.log(`AudioManager: Current UI track ${trackPath} is paused, attempting to resume.`);
            resumeUIMusic();
        } else {
            console.log(`AudioManager: Current UI track ${trackPath} is already playing.`);
        }
        return;
    }
    // Stop the current UI music before loading a new one
    console.log("AudioManager: New UI music track requested, stopping current UI music.");
    stopUIMusic();
    // Set the new track source and play
    uiMusicAudio.src = trackPath;
    currentUITrackPath = trackPath;
     console.log(`AudioManager: UI music source set to ${trackPath}. Attempting to play...`);

    const playPromise = uiMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log(`AudioManager: UI music playback started successfully: ${trackPath}`);
        }).catch(error => {
            console.warn(`AudioManager: UI music playback blocked for ${trackPath}:`, error);
            // Note: If UI music fails to play, the game music remains paused.
            // This might be acceptable behavior.
        });
    } else {
        console.log("AudioManager: uiMusicAudio.play() did not return a promise.");
    }
}


/** Stops the current game music track and resets playback time. */
export function stopGameMusic() {
    console.log(`AudioManager: Stopping game music. Current track: ${currentGameTrackPath}`);
    if (gameMusicAudio) {
        gameMusicAudio.pause();
        gameMusicAudio.currentTime = 0;
        const stoppedTrack = currentGameTrackPath; // Store before nulling
        currentGameTrackPath = null;
        gameMusicWasPlayingBeforeUI = false; // Reset this flag
        console.log(`AudioManager: Game music stopped. Track "${stoppedTrack}" reset.`);
    } else {
        console.warn("AudioManager: stopGameMusic called but gameMusicAudio is null.");
    }
}

/** Pauses the current game music track, remembers if it was playing. */
export function pauseGameMusic() {
    console.log(`AudioManager: Pausing game music. Current track: ${currentGameTrackPath}, Time: ${gameMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`);
    if (gameMusicAudio && !gameMusicAudio.paused) {
        gameMusicAudio.pause();
        gameMusicWasPlayingBeforeUI = true; // Remember game music was playing when paused
        console.log(`AudioManager: Game music paused. Track "${currentGameTrackPath}" at ${gameMusicAudio.currentTime.toFixed(2)}s. gameMusicWasPlayingBeforeUI = true`);
    } else {
         gameMusicWasPlayingBeforeUI = false; // Game music wasn't playing to begin with
        console.log("AudioManager: pauseGameMusic called but game music was already paused or null. gameMusicWasPlayingBeforeUI = false");
    }
}

/** Resumes the paused game music track *only if it was playing before UI music started*. */
export function resumeGameMusic() {
    console.log(`AudioManager: Attempting to resume game music. gameMusicWasPlayingBeforeUI=${gameMusicWasPlayingBeforeUI}, paused=${gameMusicAudio?.paused}, track=${currentGameTrackPath}`);
    if (gameMusicAudio && gameMusicWasPlayingBeforeUI && gameMusicAudio.paused && currentGameTrackPath) {
         gameMusicWasPlayingBeforeUI = false; // Consume the flag now that we are attempting resume
        console.log(`AudioManager: Conditions met for resuming game music. Attempting to play "${currentGameTrackPath}" from ${gameMusicAudio.currentTime.toFixed(2)}s...`);
        const playPromise = gameMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log(`AudioManager: Game music resumed successfully: ${currentGameTrackPath}`);
            }).catch(error => {
                console.warn(`AudioManager: Game music resume blocked for ${currentGameTrackPath}:`, error);
            });
        } else {
             console.log("AudioManager: gameMusicAudio.play() did not return a promise during resume attempt.");
        }
    } else {
        console.log("AudioManager: Game music not resumed (conditions not met).");
        gameMusicWasPlayingBeforeUI = false; // Ensure flag is false if resume logic wasn't fully met
    }
}

/** Stops the current UI/Menu music track and resets playback time. */
export function stopUIMusic() {
    console.log(`AudioManager: Stopping UI music. Current track: ${currentUITrackPath}`);
    if (uiMusicAudio) {
        uiMusicAudio.pause();
        uiMusicAudio.currentTime = 0;
        const stoppedTrack = currentUITrackPath; // Store before nulling
        currentUITrackPath = null;
        console.log(`AudioManager: UI music stopped. Track "${stoppedTrack}" reset.`);
    } else {
        console.warn("AudioManager: stopUIMusic called but uiMusicAudio is null.");
    }
}

/** Pauses the current UI/Menu music track. */
export function pauseUIMusic() {
     console.log(`AudioManager: Pausing UI music. Current track: ${currentUITrackPath}, Time: ${uiMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`);
     if (uiMusicAudio && !uiMusicAudio.paused) {
        uiMusicAudio.pause();
        console.log(`AudioManager: UI music paused. Track "${currentUITrackPath}" at ${uiMusicAudio.currentTime.toFixed(2)}s.`);
    } else {
        console.log("AudioManager: pauseUIMusic called but UI music was already paused or null.");
    }
}

/** Resumes the paused UI/Menu music track. */
export function resumeUIMusic() {
    console.log(`AudioManager: Attempting to resume UI music. paused=${uiMusicAudio?.paused}, track=${currentUITrackPath}`);
     if (uiMusicAudio && uiMusicAudio.paused && currentUITrackPath) {
         console.log(`AudioManager: Conditions met for resuming UI music. Attempting to play "${currentUITrackPath}" from ${uiMusicAudio.currentTime.toFixed(2)}s...`);
        const playPromise = uiMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log(`AudioManager: UI music resumed successfully: ${currentUITrackPath}`);
            }).catch(error => {
                console.warn(`AudioManager: UI music resume blocked for ${currentUITrackPath}:`, error);
            });
        } else {
             console.log("AudioManager: uiMusicAudio.play() did not return a promise during resume attempt.");
        }
    } else {
         console.log("AudioManager: UI music not resumed (conditions not met).");
    }
}

/** Stops ALL music (both game and UI). */
export function stopAllMusic() {
    console.log("AudioManager: Stopping all music.");
    stopGameMusic(); // This logs its action
    stopUIMusic();   // This logs its action
     // gameMusicWasPlayingBeforeUI = false; // stopGameMusic already handles this
}

// Plays a specific sound effect. Finds an available audio element in the pool with optional volume override
export function playSound(sfxPath, volume = sfxVolume) {
    if (!sfxPath || !sfxAudioPool.length) {
        // console.warn(`AudioManager: playSound called with invalid path or empty pool: ${sfxPath}`);
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
             // console.log(`AudioManager: SFX pool element source set to ${sfxPath}`);
        }

        availableSfx.volume = Math.max(0, Math.min(1, volume));
        availableSfx.currentTime = 0; // Rewind to start for immediate playback

        const playPromise = availableSfx.play();
         if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: Playing SFX: ${sfxPath}`);
            }).catch(error => {
                 // This is less likely for short SFX triggered by direct input,
                 // but can happen. Log it.
                console.warn(`AudioManager: SFX playback blocked for ${sfxPath}:`, error);
            });
        } else {
             // console.log("AudioManager: SFX play() did not return a promise.");
        }

    } else {
        // console.warn(`AudioManager: SFX pool exhausted. Could not play ${sfxPath}`);
    }
}

// Expose a public getter for current volume levels if needed for UI sliders etc.
// export function getVolumes() { return { game: gameVolume, ui: uiVolume, sfx: sfxVolume }; }