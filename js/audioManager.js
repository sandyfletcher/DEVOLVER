// -----------------------------------------------------------------------------
// root/js/audioManager.js - Manages game audio playback
// -----------------------------------------------------------------------------

let currentAudio = null; // The currently playing HTMLAudioElement
let currentTrackPath = null; // Path of the currently playing track
let defaultVolume = 0.5; // Adjust as needed

/**
 * Initializes the audio manager. Creates the audio element.
 */
export function init() {
    // Create a single audio element to manage music playback
    currentAudio = new Audio();
    currentAudio.loop = true; // Default to looping for background music
    currentAudio.volume = defaultVolume;
    // Add to body, but keep hidden. Helps with some mobile browsers.
    currentAudio.style.display = 'none';
    document.body.appendChild(currentAudio);

    console.log("Audio Manager initialized.");

    // --- Browser Audio Unlock Note ---
    // Audio playback (especially autoplay) often requires user interaction.
    // While the Wave Start isn't a *direct* user interaction, the START GAME
    // button *is*. We'll add a call to attempt playback (or unlock context)
    // when the START GAME button is clicked in main.js.
    // For simplicity with <audio>, just calling play() after setting the src
    // might be enough if the play() call is triggered *shortly after* the button click.
    // If not, a dedicated "unlock" function might be needed, or reliance on the first
    // movement/attack input after the wave starts.
}

/**
 * Sets the global music volume.
 * @param {number} volume - Volume level between 0.0 and 1.0.
 */
export function setVolume(volume) {
    defaultVolume = Math.max(0, Math.min(1, volume));
    if (currentAudio) {
        currentAudio.volume = defaultVolume;
    }
}

/**
 * Plays a specific music track. Stops the current track if a different one is playing.
 * @param {string} trackPath - The path to the audio file (e.g., 'assets/audio/wave1.mp3').
 */
export function playMusic(trackPath) {
    if (!currentAudio) {
        console.error("Audio Manager not initialized.");
        return;
    }

    if (!trackPath) {
        stopMusic(); // If trackPath is null/empty, stop any current music
        return;
    }

    if (currentTrackPath === trackPath) {
        // Already playing this track, ensure it's not paused
        if (currentAudio.paused) {
            resumeMusic();
        }
        return; // Do nothing if already playing the requested track
    }

    // Stop current music before changing track
    stopMusic();

    // Set the new track source and play
    currentAudio.src = trackPath;
    currentTrackPath = trackPath;

    // Attempt to play. This might return a Promise that needs handling
    // if triggered without recent user interaction.
    const playPromise = currentAudio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            // Playback started successfully
            // console.log(`Playing: ${trackPath}`);
        }).catch(error => {
            // Auto-play was prevented, likely due to browser policies
            console.warn(`Audio playback blocked for ${trackPath}:`, error);
            // You might want to add UI here asking the user to interact to enable audio
            // Or rely on the user making a gesture (like clicking a button) later.
        });
    }
}

/**
 * Stops the current music track and resets playback time.
 */
export function stopMusic() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0; // Reset to the start
        currentTrackPath = null;
        // console.log("Music stopped.");
    }
}

/**
 * Pauses the current music track.
 */
export function pauseMusic() {
    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        // console.log("Music paused.");
    }
}

/**
 * Resumes the paused music track.
 */
export function resumeMusic() {
    if (currentAudio && currentAudio.paused && currentTrackPath) {
        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log("Music resumed.");
            }).catch(error => {
                console.warn("Audio resume blocked:", error);
            });
        }
    }
}

// Optional: A function called on user interaction to potentially unlock audio
// (More relevant for Web Audio API, but doesn't hurt for <audio>)
export function unlockAudio() {
    if (currentAudio && currentAudio.paused && !currentTrackPath) {
         // If paused and no track loaded (e.g. after init), try playing a tiny silent sound
         // or just try to play/pause immediately to get the browser to unlock.
         currentAudio.src = 'data:audio/mpeg;base64,...'; // Tiny silent mp3 data URL
         currentAudio.play().then(() => {
            currentAudio.pause();
            console.log("Audio unlocked via user gesture.");
         }).catch(e => console.warn("Audio unlock attempt failed:", e));
    } else if (currentAudio && currentAudio.paused && currentTrackPath) {
         // If paused with a track loaded (e.g. after pause menu), try resuming
         resumeMusic();
    }
}