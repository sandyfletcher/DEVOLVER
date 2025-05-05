// root/js/audioManager.js - Manages game audio playback

import * as Config from './config.js';

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
// If volume sliders are added, this logic might need revisiting.
// let lastGameVolume = gameVolume; // Store the last non-zero volume before muting
// let lastUiVolume = uiVolume;
// let lastSfxVolume = sfxVolume;

// --- Initialize audio manager, create all necessary audio elements and pool
export function init() {
    // Capture initial volumes as the last non-zero volumes
    // lastGameVolume = gameVolume;
    // lastUiVolume = uiVolume;
    // lastSfxVolume = sfxVolume;

    // Create main music elements
    gameMusicAudio = new Audio();
    gameMusicAudio.loop = true;
    gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume; // Apply initial mute state
    gameMusicAudio.style.display = 'none';
    // Add a 'canplaythrough' listener for potential future use, but primarily rely on user gesture unlock
    // gameMusicAudio.addEventListener('canplaythrough', () => console.log("AudioManager: Game music ready."));
    document.body.appendChild(gameMusicAudio);
    uiMusicAudio = new Audio();
    uiMusicAudio.loop = true; // UI music might loop (e.g., pause screen)
    uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume; // Apply initial mute state
    uiMusicAudio.style.display = 'none';
    // uiMusicAudio.addEventListener('canplaythrough', () => console.log("AudioManager: UI music ready."));
    document.body.appendChild(uiMusicAudio);
    sfxAudioPool = []; // create SFX pool
    for (let i = 0; i < Config.AUDIO_SFX_POOL_SIZE; i++) {
        const sfx = new Audio();
        sfx.loop = false; // SFX should not loop
        sfx.volume = isSfxMuted ? 0 : sfxVolume; // Apply initial mute state
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

// --- Sets volume globally or for specific audio types - if muted, setting volume updates *intended* volume, but actual playback volume of audio element remains 0 until unmuted ---
export function setVolume(type, volume) {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    switch (type) {
        case 'game':
            gameVolume = clampedVolume;
            // lastGameVolume = clampedVolume; // Removed last volume
            if (gameMusicAudio && !isMusicMuted) { // Only apply if not muted
                 gameMusicAudio.volume = gameVolume;
            }
            // console.log(`AudioManager: Game volume set to ${gameVolume.toFixed(2)}`);
            break;
        case 'ui':
            uiVolume = clampedVolume;
            // lastUiVolume = clampedVolume; // Removed last volume
            if (uiMusicAudio && !isMusicMuted) { // Only apply if not muted
                 uiMusicAudio.volume = uiVolume;
            }
            // console.log(`AudioManager: UI volume set to ${uiVolume.toFixed(2)}`);
            break;
        case 'sfx':
            sfxVolume = clampedVolume;
            // lastSfxVolume = clampedVolume; // Removed last volume
            if (!isSfxMuted) { // Only apply if not muted
                sfxAudioPool.forEach(sfx => sfx.volume = sfxVolume);
            }
            // console.log(`AudioManager: SFX volume set to ${sfxVolume.toFixed(2)}`);
            break;
        case 'master':
            // This would require scaling the individual volumes
            // For simplicity, let's just handle the specific types for now. TODO
            console.warn("AudioManager: Master volume not yet implemented. Use 'game', 'ui', or 'sfx'.");
            break;
        default:
            console.warn(`AudioManager: Unknown volume type: ${type}`);
    }
}

// Toggle mute state for music
export function toggleMusicMute() {
    isMusicMuted = !isMusicMuted;
    // Apply the new volume (0 if muted, intended volume if unmuted)
    if (gameMusicAudio) {
        gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
         // If just unmuted AND the game music was paused (e.g. Mute -> Pause -> Unpause already made it play silently),
         // it's already playing, just changing volume makes it audible.
         // If it was paused *while muted* (e.g. Mute -> Unmute -> Pause), the next call to unpauseGameMusic will handle playback.
         // So we don't need to explicitly call play() here.
    }
    if (uiMusicAudio) {
        uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        // Same logic as above for UI music.
    }
    // console.log(`AudioManager: Music is now ${isMusicMuted ? 'muted' : 'unmuted'}.`);
    return isMusicMuted; // Return the new state
}

// Toggle mute state for SFX
export function toggleSfxMute() {
    isSfxMuted = !isSfxMuted;
    sfxAudioPool.forEach(sfx => {
        sfx.volume = isSfxMuted ? 0 : sfxVolume;
    });
    console.log(`AudioManager: SFX is now ${isSfxMuted ? 'muted' : 'unmuted'}.`);
    return isSfxMuted; // Return the new state
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
        // console.log("AudioManager: Empty trackPath provided for game music, stopping current game music.");
        stopGameMusic(); // This logs its action internally
        return;
    }

    // Check if the requested track is already loaded and playing/paused.
    // Construct full path to compare reliably
    const trackUrl = new URL(trackPath, window.location.href).href;

    if (gameMusicAudio.src === trackUrl && gameMusicAudio.currentTime > 0 && !gameMusicAudio.ended) {
        // It's the same track and it's been played (not just loaded).
        // console.log(`AudioManager: Game music track ${trackPath} is already the current track.`);
        // If it's the same track, ensure it's playing/unpaused, respecting mute state.
        if (gameMusicAudio.paused) {
            // console.log(`AudioManager: Current game track ${trackPath} is paused, attempting to unpause.`);
             unpauseGameMusic(); // Use the simplified unpause function (handles mute internally)
        } else {
             // console.log(`AudioManager: Current game track ${trackPath} is already playing.`);
             // Ensure volume is correct (applies mute state)
             gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        }
        return; // Do nothing further if already playing the same track
    }

    // New track requested, stop current game music before loading.
    // console.log("AudioManager: New game music track requested, stopping current game music.");
    stopGameMusic(); // This logs its action internally

    // Set the new track source and attempt to play.
    gameMusicAudio.src = trackPath;
    currentGameTrackPath = trackPath;
    gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume; // Set volume *before* play attempt
    // console.log(`AudioManager: Game music source set to ${trackPath}. Attempting to play...`);

    const playPromise = gameMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // console.log(`AudioManager: Game music playback started successfully: ${trackPath}`);
        }).catch(error => {
            console.warn(`AudioManager: Game music playback blocked for ${trackPath}:`, error);
            // This likely means no recent user interaction. Music will start
            // when a subsequent user gesture occurs *and* playGameMusic/unpauseGameMusic is called again.
            // Note: If playback fails, gameMusicAudio.paused will likely remain true.
            // Ensure volume is still correct if muted:
            gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        });
    } else {
         // console.log("AudioManager: gameMusicAudio.play() did not return a promise.");
         // Ensure volume is still correct if muted:
         gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
    }
}


// Plays a specific UI/Menu music track. Pauses game music if currently playing.
export function playUIMusic(trackPath) {
    // console.log(`AudioManager: Requesting to play UI music: ${trackPath}`);
    if (!uiMusicAudio || !gameMusicAudio) {
         console.error("AudioManager: playUIMusic failed, audio elements not ready.");
        return;
    }

    // If game music is currently playing (not paused and has started), pause it.
    if (gameMusicAudio && !gameMusicAudio.paused && gameMusicAudio.currentTime > 0) {
        // console.log(`AudioManager: Game music is playing. Pausing game music before starting UI music.`);
        pauseGameMusic(); // Use the simplified pause function
    }

    // If no track path is provided, stop current UI music.
    if (!trackPath) {
         // console.log("AudioManager: Empty trackPath provided for UI music, stopping current UI music.");
        stopUIMusic(); // This logs its action internally
        return;
    }

    // Check if the requested UI track is already loaded and playing/paused.
    const trackUrl = new URL(trackPath, window.location.href).href;

    if (uiMusicAudio.src === trackUrl && uiMusicAudio.currentTime > 0 && !uiMusicAudio.ended) {
        // It's the same UI track and it's been played.
        // console.log(`AudioManager: UI music track ${trackPath} is already the current track.`);
         // If it's the same track, ensure it's playing/unpaused, respecting mute state.
         if (uiMusicAudio.paused) {
             // console.log(`AudioManager: Current UI track ${trackPath} is paused, attempting to unpause.`);
             resumeUIMusic(); // Use the existing UI resume function (handles mute internally)
         } else {
             // console.log(`AudioManager: Current UI track ${trackPath} is already playing.`);
              // Ensure volume is correct (applies mute state)
             uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
         }
        return; // Do nothing further
    }

    // New UI track requested, stop current UI music before loading.
    // console.log("AudioManager: New UI music track requested, stopping current UI music.");
    stopUIMusic();

    // Set the new UI track source and attempt to play.
    uiMusicAudio.src = trackPath;
    currentUITrackPath = trackPath;
    uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume; // Set volume *before* play attempt

    // console.log(`AudioManager: UI music source set to ${trackPath}. Attempting to play...`);

    const playPromise = uiMusicAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // console.log(`AudioManager: UI music playback started successfully: ${trackPath}`);
        }).catch(error => {
            console.warn(`AudioManager: UI music playback blocked for ${trackPath}:`, error);
            // UI music will start when a subsequent user gesture occurs *and* playUIMusic is called again.
             // Ensure volume is still correct if muted:
             uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        });
    } else {
        // console.log("AudioManager: uiMusicAudio.play() did not return a promise.");
         // Ensure volume is still correct if muted:
         uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
    }
}


/** Stops the current game music track and resets playback time. */
export function stopGameMusic() {
    // console.log(`AudioManager: Stopping game music. Current track: ${currentGameTrackPath}`);
    if (gameMusicAudio) {
        gameMusicAudio.pause();
        gameMusicAudio.currentTime = 0;
        const stoppedTrack = currentGameTrackPath; // Store before nulling
        currentGameTrackPath = null;
        // console.log(`AudioManager: Game music stopped. Track "${stoppedTrack}" reset.`);
    } else {
        console.warn("AudioManager: stopGameMusic called but gameMusicAudio is null.");
    }
}

/** Pauses the current game music track. */
export function pauseGameMusic() {
    // console.log(`AudioManager: Pausing game music. Current track: ${currentGameTrackPath}, Time: ${gameMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`);
    if (gameMusicAudio && !gameMusicAudio.paused) {
        gameMusicAudio.pause();
        // console.log(`AudioManager: Game music paused. Track "${currentGameTrackPath}" at ${gameMusicAudio.currentTime.toFixed(2)}s.`);
    } else {
        // console.log("AudioManager: pauseGameMusic called but game music was already paused or null.");
    }
}

/**
 * Attempts to unpause/resume the current game music track.
 * Called by main.js when transitioning from PAUSED back to RUNNING.
 */
// Renamed from resumeGameMusic for clarity - it unpauses, it doesn't "resume the game".
export function unpauseGameMusic() {
    // console.log(`AudioManager: Attempting to unpause game music. Paused: ${gameMusicAudio?.paused}, Track: ${currentGameTrackPath}, Muted: ${isMusicMuted}`);
     // Check if there's an audio element, a track source is set, and it's currently paused.
     if (gameMusicAudio && currentGameTrackPath && gameMusicAudio.paused) {
         // console.log(`AudioManager: Conditions met for unpausing game music. Attempting to play "${currentGameTrackPath}" from ${gameMusicAudio.currentTime.toFixed(2)}s...`);
        // Ensure the volume is set correctly *before* calling play, which respects the mute state.
        gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume; // Apply the correct volume based on mute state

        const playPromise = gameMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: Game music unpaused successfully: ${currentGameTrackPath}`);
            }).catch(error => {
                console.warn(`AudioManager: Game music unpause blocked for ${currentGameTrackPath}:`, error);
                 // If playback is blocked (e.g., no user gesture), the element will remain paused.
                 // Ensure volume is still 0 if it became muted right after calling play()
                 gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
            });
        } else {
             // console.log("AudioManager: gameMusicAudio.play() did not return a promise during unpause attempt.");
             // Ensure volume is still 0 if it became muted
             gameMusicAudio.volume = isMusicMuted ? 0 : gameVolume;
        }
    } else {
         // console.log("AudioManager: Game music not unpaused (conditions not met).");
         // If music is muted, ensure the volume is 0 even if it wasn't paused but just had volume set to 0
         // (e.g. if setVolume was called with 0 while muted, or if paused while muted).
         if (gameMusicAudio && isMusicMuted) {
             gameMusicAudio.volume = 0;
         }
         // If there's a current track but it's *not* paused, this function does nothing, which is correct.
    }
}


/** Stops the current UI/Menu music track and resets playback time. */
export function stopUIMusic() {
    // console.log(`AudioManager: Stopping UI music. Current track: ${currentUITrackPath}`);
    if (uiMusicAudio) {
        uiMusicAudio.pause();
        uiMusicAudio.currentTime = 0;
        const stoppedTrack = currentUITrackPath; // Store before nulling
        currentUITrackPath = null;
        // console.log(`AudioManager: UI music stopped. Track "${stoppedTrack}" reset.`);
    } else {
        console.warn("AudioManager: stopUIMusic called but uiMusicAudio is null.");
    }
}

/** Pauses the current UI/Menu music track. */
export function pauseUIMusic() {
     // console.log(`AudioManager: Pausing UI music. Current track: ${currentUITrackPath}, Time: ${uiMusicAudio?.currentTime?.toFixed(2) ?? 'N/A'}`);
     if (uiMusicAudio && !uiMusicAudio.paused) {
        uiMusicAudio.pause();
        // console.log(`AudioManager: UI music paused. Track "${currentUITrackPath}" at ${uiMusicAudio.currentTime.toFixed(2)}s.`);
    } else {
        // console.log("AudioManager: pauseUIMusic called but UI music was already paused or null.");
    }
}

/** Resumes the paused UI/Menu music track. */
export function resumeUIMusic() {
    // console.log(`AudioManager: Attempting to resume UI music. paused=${uiMusicAudio?.paused}, track=${currentUITrackPath}, Muted: ${isMusicMuted}`);
     // REMOVED the !isMusicMuted check from this main IF condition.
     if (uiMusicAudio && uiMusicAudio.paused && currentUITrackPath) {
         // console.log(`AudioManager: Conditions met for resuming UI music. Attempting to play "${currentUITrackPath}" from ${uiMusicAudio.currentTime.toFixed(2)}s...`);
        // Ensure the volume is set correctly *before* calling play, which respects the mute state.
        uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume; // Apply the correct volume based on mute state

        const playPromise = uiMusicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: UI music resumed successfully: ${currentUITrackPath}`);
            }).catch(error => {
                console.warn(`AudioManager: UI music resume blocked for ${currentUITrackPath}:`, error);
                // Ensure volume is still 0 if it became muted right after calling play()
                 uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
            });
        } else {
             // console.log("AudioManager: uiMusicAudio.play() did not return a promise during resume attempt.");
              // Ensure volume is still 0 if it became muted
              uiMusicAudio.volume = isMusicMuted ? 0 : uiVolume;
        }
    } else {
         // console.log("AudioManager: UI music not resumed (conditions not met).");
         // If music is muted, ensure the volume is 0 even if it wasn't paused but just had volume set to 0
         if (uiMusicAudio && isMusicMuted) {
             uiMusicAudio.volume = 0;
         }
    }
}

/** Stops ALL music (both game and UI). */
export function stopAllMusic() {
    // console.log("AudioManager: Stopping all music.");
    stopGameMusic(); // This logs its action
    stopUIMusic();   // This logs its action
}

// Plays a specific sound effect. Finds an available audio element in the pool with optional volume override
export function playSound(sfxPath, volume = sfxVolume) {
    // ADDED: Check if SFX is muted before attempting to play
    if (isSfxMuted) {
        // console.log(`AudioManager: SFX muted, skipping play: ${sfxPath}`);
        return;
    }

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

        // Ensure volume is set, respecting the global sfxVolume (which respects mute state if called externally)
        // However, we are directly calling this function, so we apply the sfxVolume parameter
        // The volume parameter defaults to the module's sfxVolume which is 0 if muted, or the intended volume if not muted.
        availableSfx.volume = Math.max(0, Math.min(1, volume)); // Use passed volume, defaults to sfxVolume (which correctly reflects mute)

        availableSfx.currentTime = 0; // Rewind to start for immediate playback

        const playPromise = availableSfx.play();
         if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log(`AudioManager: Playing SFX: ${sfxPath}`);
            }).catch(error => {
                 // This is less likely for short SFX triggered by direct input,
                 // but can happen. Log it.
                console.warn(`AudioManager: SFX playback blocked for ${sfxPath}:`, error);
                // Ensure volume is still 0 if SFX became muted right after calling play()
                // This should be unnecessary if `volume` param correctly reflects mute, but as a safeguard:
                if (isSfxMuted) availableSfx.volume = 0;
            });
        } else {
             // console.log("AudioManager: SFX play() did not return a promise.");
              if (isSfxMuted) availableSfx.volume = 0;
        }

    } else {
        // console.warn(`AudioManager: SFX pool exhausted. Could not play ${sfxPath}`);
    }
}

// Expose a public getter for current volume levels or mute state if needed for UI sliders etc.
export function getMusicMutedState() { return isMusicMuted; }
export function getSfxMutedState() { return isSfxMuted; }
export function getGameVolume() { return gameVolume; } // Returns the *intended* volume, not necessarily the *active* volume if muted
export function getUiVolume() { return uiVolume; }
export function getSfxVolume() { return sfxVolume; }