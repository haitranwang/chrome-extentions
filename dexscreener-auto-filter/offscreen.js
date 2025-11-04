// Offscreen document for audio playback
// This runs in an offscreen document to avoid autoplay restrictions

let audioContext = null;
let audioUnlocked = false;

// Initialize audio context when user enables sound (user gesture)
async function unlockAudio() {
  // If already unlocked and context exists and is running, return success
  if (audioUnlocked && audioContext && audioContext.state === 'running') {
    console.log('🔔 Audio already unlocked and running');
    return true;
  }

  try {
    // Create AudioContext if it doesn't exist
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('🔔 AudioContext created, state:', audioContext.state);
    } else {
      console.log('🔔 Using existing AudioContext, state:', audioContext.state);
    }

    // Resume AudioContext - this requires user gesture (the first time)
    if (audioContext.state === 'suspended') {
      console.log('🔔 Resuming AudioContext...');
      await audioContext.resume();
      console.log('🔔 AudioContext resumed, state:', audioContext.state);
    }

    // Wait a moment for state to settle
    if (audioContext.state !== 'running') {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (audioContext.state === 'running') {
      audioUnlocked = true;
      console.log('✅ Audio unlocked successfully');
      return true;
    } else {
      // Still mark as unlocked if we have a context (might work anyway)
      audioUnlocked = true;
      console.warn('⚠️ AudioContext state is', audioContext.state, 'but marking as unlocked');
      return true; // Return true anyway - browser might allow playback
    }
  } catch (error) {
    console.error('❌ Error unlocking audio:', error);
    return false;
  }
}

// Ensure audio context is ready (create if needed, resume if suspended)
async function ensureAudioReady() {
  try {
    // Create AudioContext if it doesn't exist
    if (!audioContext) {
      console.log('🔔 Creating new AudioContext...');
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioUnlocked = true; // Once created, consider it unlocked
    }

    // Resume AudioContext if suspended
    if (audioContext.state === 'suspended') {
      console.log('🔔 AudioContext is suspended, attempting to resume...');
      try {
        await audioContext.resume();
        console.log('🔔 AudioContext resumed, state:', audioContext.state);
      } catch (resumeError) {
        console.error('🔔 Failed to resume AudioContext:', resumeError);
        // Continue anyway - sometimes it works
      }
    }

    // If still not running after resume attempt, wait a bit
    if (audioContext.state !== 'running') {
      console.log('🔔 Waiting for AudioContext to be ready...');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try one more resume if still not running
      if (audioContext.state !== 'running') {
        try {
          await audioContext.resume();
        } catch (e) {
          // Ignore errors
        }
      }
    }

    if (audioContext.state === 'running') {
      audioUnlocked = true;
      return true;
    } else {
      console.warn('🔔 AudioContext state:', audioContext.state);
      // Still try to proceed if audioUnlocked flag is set
      return audioUnlocked;
    }
  } catch (error) {
    console.error('❌ Error ensuring audio ready:', error);
    return false;
  }
}

// Play notification sound using audio file
async function playBeep() {
  // Ensure audio is ready (this handles case where context was reset)
  const isReady = await ensureAudioReady();

  if (!isReady && !audioUnlocked) {
    console.error('🔇 Audio not unlocked and cannot be prepared, cannot play sound');
    return;
  }

  try {
    // Get the URL of the audio file using chrome.runtime.getURL
    const audioUrl = chrome.runtime.getURL('tieng_ting_mp3-www_tiengdong_com.mp3');

    // Create an Audio element and play the sound
    const audio = new Audio(audioUrl);
    audio.volume = 1.0; // Set volume to maximum

    // Play the audio file
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('✅ Notification sound played successfully');
        })
        .catch(error => {
          console.error('❌ Error playing notification sound:', error);
          // If play() fails, it might be due to autoplay restrictions
          // Try to resume AudioContext first, then retry
          if (audioContext && audioContext.state !== 'running') {
            audioContext.resume().then(() => {
              audio.play().catch(err => {
                console.error('❌ Failed to play audio after resume:', err);
              });
            });
          }
        });
    }
  } catch (error) {
    console.error('❌ Error playing notification sound:', error);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UNLOCK_AUDIO') {
    unlockAudio().then(success => {
      sendResponse({ success });
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'PLAY_BEEP') {
    playBeep();
    sendResponse({ success: true });
  }
});

