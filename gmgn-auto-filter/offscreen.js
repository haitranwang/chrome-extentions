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

// Play beep sound using Web Audio API
async function playBeep() {
  // Ensure audio is ready (this handles case where context was reset)
  const isReady = await ensureAudioReady();

  if (!isReady && !audioUnlocked) {
    console.error('🔇 Audio not unlocked and cannot be prepared, cannot play sound');
    return;
  }

  try {
    // Double-check AudioContext exists and is usable
    if (!audioContext) {
      console.error('🔇 AudioContext not available');
      return;
    }

    // If not running, try to resume one more time
    if (audioContext.state !== 'running') {
      console.log('🔔 AudioContext not running before play, attempting resume...');
      try {
        await audioContext.resume();
      } catch (e) {
        console.error('🔔 Failed to resume before play:', e);
      }
    }

    // Proceed with playback even if state is not 'running'
    // Sometimes browsers allow playback despite suspended state
    const startTime = audioContext.currentTime;

    // First tone (higher pitch)
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);

    oscillator1.frequency.value = 800;
    oscillator1.type = 'sine';
    gainNode1.gain.setValueAtTime(0.3, startTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

    oscillator1.start(startTime);
    oscillator1.stop(startTime + 0.3);

    // Second tone (lower pitch) after brief delay
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);

    oscillator2.frequency.value = 600;
    oscillator2.type = 'sine';
    gainNode2.gain.setValueAtTime(0.3, startTime + 0.1);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

    oscillator2.start(startTime + 0.1);
    oscillator2.stop(startTime + 0.3);

    console.log('✅ Beep played successfully');
  } catch (error) {
    console.error('❌ Error playing beep:', error);
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

