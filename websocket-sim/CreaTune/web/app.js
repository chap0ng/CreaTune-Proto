// Global variables
let socket;
let isRecording = false;
let isAmbientPlaying = false;
let isToyPianoPlaying = false;
let isESP32Connected = false;
let isSimulationActive = false;
let simulationInterval;
let recorder;
let micStream;
let analysisInterval;
let rhythmLoop;
let lastESP32ActivityTime = 0;
let ESP32TimeoutCheck;

// Tone.js elements
let ambientSynth;
let toyPianoSynth;
let reverb;
let currentValue = 0.5; // Default value for synth parameters

// DOM elements
const micButton = document.getElementById('mic-button');
const ambientButton = document.getElementById('ambient-button');
const toyPianoButton = document.getElementById('toy-piano-button');
const simulateESPButton = document.getElementById('simulate-esp-button');
const creatureContainer = document.getElementById('creature-container');
const espLed = document.getElementById('esp-led');
const dataLed = document.getElementById('data-led');
const espStatus = document.getElementById('esp-status');
const dataStatus = document.getElementById('data-status');
const logElement = document.getElementById('log');

// Initialize on load
window.addEventListener('load', initialize);

// Initialize the application
function initialize() {
    // Initialize Tone.js
    initializeTone();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup WebSocket connection
    connectWebSocket();
    
    // Setup ESP32 timeout checker
    setupESP32TimeoutCheck();
    
    // Log app initialization
    logToUI('Application CreaTune initialisée');
    
    // Request fullscreen on mobile
    setupFullscreen();
}

// Setup ESP32 timeout check
function setupESP32TimeoutCheck() {
    // Check every 10 seconds if ESP32 is still active
    ESP32TimeoutCheck = setInterval(() => {
        // If ESP32 was connected but no data for 15 seconds
        if (isESP32Connected && Date.now() - lastESP32ActivityTime > 15000) {
            // Mark as disconnected
            isESP32Connected = false;
            updateESPStatus(false);
            updateDataStatus(false);
            hideCreature();
            logToUI('ESP32 timeout - no data received for 15s');
        }
    }, 10000);
}

// Initialize Tone.js
function initializeTone() {
    // Create reverb Valhalla effect
    reverb = new Tone.Reverb({
        decay: 3.5,
        wet: 0.4,
        preDelay: 0.4
    }).toDestination();
    reverb.generate();
    
    // Create ambient synth
    ambientSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, // More harmonic for wood-like resonance
        modulationIndex: 25,  // Increased for more complex timbre
        oscillator: {
          type: "triangle" // Triangle gives more woody overtones than sine
        },
        envelope: {
          attack: 0.02,  // Faster attack for percussive quality
          decay: 0.8,    // Medium decay for wood resonance
          sustain: 0.1,  // Low sustain for percussive sound
          release: 1.5   // Medium release for natural decay
        },
        modulation: {
          type: "square" // Square adds harmonics that create wooden character
        },
        modulationEnvelope: {
          attack: 0.005, // Very quick mod attack
          decay: 0.3,    // Short mod decay
          sustain: 0.1,  // Low sustain
          release: 0.8   // Medium release
        }
    }).connect(reverb);
    ambientSynth.volume.value = -5;
    
    // Create toy piano synth
    toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
            type: "triangle"
        },
        envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 1
        }
    }).connect(reverb);
    toyPianoSynth.volume.value = -5;
    
    logToUI('Synthétiseurs Tone.js initialisés');
}

// Setup all event listeners
function setupEventListeners() {
    // Mic button
    micButton.addEventListener('click', toggleMicRecording);
    
    // Ambient button
    ambientButton.addEventListener('click', toggleAmbientSynth);
    
    // Toy Piano button
    toyPianoButton.addEventListener('click', toggleToyPianoSynth);
    
    // Simulate ESP32 button
    simulateESPButton.addEventListener('click', toggleESPSimulation);
    
    // Add icons event listeners
    document.getElementById('mic-icon').addEventListener('click', toggleMicRecording);
    document.getElementById('plant-icon').addEventListener('click', toggleCreatureVisibility);
}

// Toggle microphone recording
async function toggleMicRecording() {
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    
    if (isRecording) {
        stopRecording();
    } else {
        // Stop any current playback before recording
        stopAllSynths();
        
        // Stop any rhythm loop
        if (rhythmLoop) {
            rhythmLoop.stop();
        }
        
        // Stop the transport
        Tone.Transport.stop();
        
        startRecording();
    }
}

// Stop all audio and transport
function stopAllAudio() {
    // Stop any recording in progress
    if (isRecording) {
        stopRecording();
    }
    
    // Stop any playing synths
    stopAllSynths();
    
    // Stop any rhythm loop
    if (rhythmLoop) {
        rhythmLoop.stop();
        rhythmLoop.dispose();
        rhythmLoop = null;
    }
    
    // Stop the transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Reset all buttons
    micButton.classList.remove('active', 'recording');
    ambientButton.classList.remove('active');
    toyPianoButton.classList.remove('active');
    
    logToUI('Tous les sons arrêtés');
}

// Start recording from microphone
async function startRecording() {
    try {
        // We already stopped all sounds in the toggle function
        
        // Request microphone access and start Tone.js
        await Tone.start();
        
        // Set up recorder with meter
        if (!micStream) {
            // Set up UserMedia for mic input
            const mic = new Tone.UserMedia();
            const meter = new Tone.Meter({ channels: 1 });
            await mic.open();
            mic.connect(meter);
            
            micStream = { mic, meter };
        }
        
        // Set recording state
        isRecording = true;
        micButton.classList.add('active', 'recording');
        micButton.textContent = "⏺";
        logToUI('Enregistrement microphone démarré');
        
        // Detect rhythm for 5 seconds
        const rhythmTimes = [];
        let lastPulse = 0;
        const startTime = performance.now();
        const threshold = -50; // dB threshold for detecting sounds
        
        // Start analysis interval
        analysisInterval = setInterval(() => {
            const now = performance.now();
            const db = micStream.meter.getValue();
            
            // If sound above threshold and not too soon after last pulse
            if (db > threshold && now - lastPulse > 150) {
                lastPulse = now;
                const relativeTime = (now - startTime) / 1000;
                rhythmTimes.push(relativeTime);
                
                // Visual feedback only - no sound during recording
                logToUI(`Pulse détecté à ${relativeTime.toFixed(2)}s`);
            }
            
            // End recording after 5 seconds
            if (now - startTime > 5000) {
                clearInterval(analysisInterval);
                analysisInterval = null;
                
                // Create repeating pattern from the recorded rhythm
                if (rhythmTimes.length > 0) {
                    setupRhythmLoop(rhythmTimes);
                    logToUI(`Détecté ${rhythmTimes.length} pulses. Boucle créée.`);
                } else {
                    logToUI('Aucun son détecté. Essayez à nouveau.');
                }
                
                // Reset UI
                micButton.textContent = "Loop";
                isRecording = false;
                micButton.classList.remove('recording');
            }
            
        }, 40); // Check every 40ms (25 times per second)
        
    } catch (err) {
        logToUI('Erreur d\'accès au microphone: ' + err.message);
        isRecording = false;
        micButton.classList.remove('active', 'recording');
        micButton.textContent = "Record";
    }
}

// Setup rhythm loop from recorded pulses
function setupRhythmLoop(times) {
    // Stop previous loop if any
    Tone.Transport.cancel();
    
    // If there's an existing rhythm loop, dispose it
    if (rhythmLoop) {
        rhythmLoop.dispose();
    }
    
    // Create a new Part with the recorded times
    rhythmLoop = new Tone.Part((time) => {
        // Trigger sound for each pulse
        if (isAmbientPlaying) {
            triggerSoundFromValue(currentValue);
        } else if (isToyPianoPlaying) {
            triggerSoundFromValue(currentValue);
        } else {
            // Default if no synth is active - use ambient synth
            ambientSynth.triggerAttackRelease("C4", "8n", time);
        }
    }, times.map(t => [t, null]));
    
    // Configure the loop
    rhythmLoop.loop = true;
    rhythmLoop.loopEnd = times[times.length - 1] + 0.5; // Add a small gap at the end
    rhythmLoop.start(0);
    
    // Start the transport
    Tone.Transport.start();
    
    showCreature();
}

// Stop microphone recording
function stopRecording() {
    // Stop the analysis interval
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
    }
    
    // Close the microphone stream if exists
    if (micStream && micStream.mic) {
        micStream.mic.close();
        micStream = null;
    }
    
    isRecording = false;
    micButton.classList.remove('active', 'recording');
    micButton.textContent = "Record";
    logToUI('Enregistrement microphone arrêté');
}

// Toggle ambient synth
function toggleAmbientSynth() {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    
    if (isAmbientPlaying) {
        stopAmbientSynth();
    } else {
        startAmbientSynth();
    }
}

// Start ambient synth
function startAmbientSynth() {
    // Stop any other playing modes
    stopRecording();
    stopToyPianoSynth();
    
    isAmbientPlaying = true;
    ambientButton.classList.add('active');
    logToUI('Mode Ambient activé');
    
    // Start a pattern of ambient notes
    const pattern = new Tone.Pattern((time, note) => {
        ambientSynth.triggerAttackRelease(note, "4n", time);
    }, ["C3", "G3", "E3", "A3", "B3", "D4"]);
    
    pattern.interval = "8n";
    pattern.start(0);
    
    // Use the current value to control the synth parameters
    updateSynthParameters();
}

// Stop ambient synth
function stopAmbientSynth() {
    isAmbientPlaying = false;
    ambientButton.classList.remove('active');
    logToUI('Mode Ambient désactivé');
    Tone.Transport.stop();
    Tone.Transport.cancel();
}

// Toggle toy piano synth
function toggleToyPianoSynth() {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    
    if (isToyPianoPlaying) {
        stopToyPianoSynth();
    } else {
        startToyPianoSynth();
    }
}

// Start toy piano synth
function startToyPianoSynth() {
    // Stop any other playing modes
    stopRecording();
    stopAmbientSynth();
    
    isToyPianoPlaying = true;
    toyPianoButton.classList.add('active');
    logToUI('Mode Toy Piano activé');
    
    // Start a pattern of toy piano notes
    const notes = ["C5", "G4", "E5", "A4", "B4", "D5"];
    
    // Create a sequence
    const sequence = new Tone.Sequence((time, note) => {
        toyPianoSynth.triggerAttackRelease(note, "8n", time);
    }, notes, "4n");
    
    Tone.Transport.bpm.value = 60 + (currentValue * 40); // 60-100 BPM based on value
    sequence.start(0);
    Tone.Transport.start();
    
    // Use the current value to control the synth parameters
    updateSynthParameters();
}

// Stop toy piano synth
function stopToyPianoSynth() {
    isToyPianoPlaying = false;
    toyPianoButton.classList.remove('active');
    logToUI('Mode Toy Piano désactivé');
    Tone.Transport.stop();
    Tone.Transport.cancel();
}

// Stop all synths
function stopAllSynths() {
    stopAmbientSynth();
    stopToyPianoSynth();
    
    // Reset buttons
    ambientButton.classList.remove('active');
    toyPianoButton.classList.remove('active');
    
    // Stop any active loop but don't dispose it yet
    if (rhythmLoop && Tone.Transport.state === "started") {
        Tone.Transport.pause();
    }
}

// Toggle ESP32 simulation
function toggleESPSimulation() {
    if (isSimulationActive) {
        stopESPSimulation();
    } else {
        startESPSimulation();
    }
    
    // Toggle the state and button appearance
    isSimulationActive = !isSimulationActive;
    simulateESPButton.classList.toggle('active');
}

// Start ESP32 simulation
function startESPSimulation() {
    // Only start simulation if there's no real ESP32 connection
    if (isESP32Connected) {
        logToUI('ESP32 réel déjà connecté, simulation non démarrée');
        return;
    }
    
    logToUI('Simulation ESP32 activée');
    
    // Simulate ESP32 connection
    updateESPStatus(true);
    
    // Start sending simulated data
    simulationInterval = setInterval(() => {
        // Generate random values between 0.4 and 0.8
        const value = 0.4 + (Math.random() * 0.4);
        
        // Process the value
        processESPData(value);
        
    }, 1000); // Send data every second
}

// Stop ESP32 simulation
function stopESPSimulation() {
    logToUI('Simulation ESP32 désactivée');
    
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    
    // If no real ESP32 is connected, update the status
    if (!isESP32Connected) {
        updateESPStatus(false);
        updateDataStatus(false);
        hideCreature();
    }
}

// Connect to WebSocket server
function connectWebSocket() {
    try {
        // Use your server IP address here instead of localhost
        socket = new WebSocket('ws://localhost:8080');
        // Example with IP address: 
        // socket = new WebSocket('ws://192.168.1.100:8080');
        
        socket.onopen = function(event) {
            logToUI('Connexion WebSocket établie');
            // Don't set ESP32 connected here - wait for actual data
        };
        
        socket.onmessage = function(event) {
            logToUI('Message reçu: ' + event.data);
            
            try {
                // Try to parse the data as JSON
                const data = JSON.parse(event.data);
                
                // If it's a sensor data message with voltage or moisture_app_value
                if (data.type === "sensor_data") {
                    // Now we know it's an ESP32
                    isESP32Connected = true;
                    updateESPStatus(true);
                    
                    // Get the value - either voltage or moisture_app_value
                    const value = data.moisture_app_value || data.voltage;
                    
                    if (value !== undefined) {
                        // Process the value
                        processESPData(value);
                    }
                    
                    // Reset the last active time
                    lastESP32ActivityTime = Date.now();
                }
            } catch (err) {
                // Not JSON or doesn't have the expected format
                logToUI('Format de données non reconnu: ' + err.message);
            }
        };
        
        socket.onerror = function(error) {
            updateESPStatus(false);
            isESP32Connected = false;
            logToUI('Erreur WebSocket');
        };
        
        socket.onclose = function(event) {
            updateESPStatus(false);
            isESP32Connected = false;
            logToUI('Connexion WebSocket fermée');
            
            // Try to reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };
    } catch (error) {
        updateESPStatus(false);
        isESP32Connected = false;
        logToUI('Erreur lors de la création de WebSocket: ' + error.message);
    }
}

// Process ESP32 data
function processESPData(value) {
    // Check if value is in the desired range (0.4 to 0.8)
    if (value >= 0.4 && value <= 0.8) {
        updateDataStatus(true);
        showCreature();
        
        // Save current value for synth parameters
        currentValue = value;
        
        // Trigger sound based on value
        triggerSoundFromValue(value);
        
        // Log the value
        logToUI(`Données reçues: ${value.toFixed(2)}`);
    } else {
        updateDataStatus(false);
        hideCreature();
        logToUI(`Données hors plage: ${value.toFixed(2)}`);
    }
}

// Trigger sound from value
function triggerSoundFromValue(value) {
    // Update synth parameters based on current value
    updateSynthParameters();
    
    // Show visual feedback
    showCreature();
    
    // Add reaction animation to creature
    const creature = document.getElementById('creature');
    creature.classList.add('creature-reacting');
    
    // Remove animation class after animation completes
    setTimeout(() => {
        creature.classList.remove('creature-reacting');
    }, 400);
    
    // Trigger different notes based on value range
    if (isAmbientPlaying) {
        let note;
        if (value < 0.5) {
            note = "C3";
        } else if (value < 0.6) {
            note = "E3";
        } else if (value < 0.7) {
            note = "G3";
        } else {
            note = "B3";
        }
        
        ambientSynth.triggerAttackRelease(note, "2n");
    } else if (isToyPianoPlaying) {
        let note;
        if (value < 0.5) {
            note = "C5";
        } else if (value < 0.6) {
            note = "E5";
        } else if (value < 0.7) {
            note = "G5";
        } else {
            note = "B5";
        }
        
        toyPianoSynth.triggerAttackRelease(note, "8n");
    } else {
        // Default synth if none active
        ambientSynth.triggerAttackRelease("C4", "8n");
    }
}

// Update synth parameters based on current value
function updateSynthParameters() {
    // Only update if a synth is playing
    if (!isAmbientPlaying && !isToyPianoPlaying) return;
    
    // Ambient synth parameters
    if (isAmbientPlaying) {
        ambientSynth.set({
            harmonicity: 1 + (currentValue * 2),
            modulationIndex: 5 + (currentValue * 10),
            volume: -15 + (currentValue * 5)
        });
    }
    
    // Toy piano synth parameters
    if (isToyPianoPlaying) {
        toyPianoSynth.set({
            volume: -12 + (currentValue * 4)
        });
        
        // Update the transport tempo
        Tone.Transport.bpm.value = 60 + (currentValue * 40); // 60-100 BPM
    }
    
    // Reverb parameters
    reverb.wet.value = 0.5 + (currentValue * 0.3); // 0.5-0.8
}

// Show the creature
function showCreature() {
    creatureContainer.classList.remove('hidden');
}

// Hide the creature
function hideCreature() {
    creatureContainer.classList.add('hidden');
}

// Toggle creature visibility (used by plant icon)
function toggleCreatureVisibility() {
    if (creatureContainer.classList.contains('hidden')) {
        showCreature();
    } else {
        hideCreature();
    }
}

// Update ESP32 connection status
function updateESPStatus(connected) {
    isESP32Connected = connected;
    
    if (connected) {
        espLed.classList.add('active');
        document.querySelector('#esp-status span').textContent = 'ESP32';
    } else {
        espLed.classList.remove('active');
        document.querySelector('#esp-status span').textContent = 'ESP32';
    }
}

// Update data status
function updateDataStatus(receiving) {
    if (receiving) {
        dataLed.classList.add('active');
        document.querySelector('#data-status span').textContent = 'Data';
    } else {
        dataLed.classList.remove('active');
        document.querySelector('#data-status span').textContent = 'Data';
    }
}

// Log to UI
function logToUI(message) {
    const logLine = document.createElement('div');
    logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logElement.appendChild(logLine);
    logElement.scrollTop = logElement.scrollHeight;
    
    // Keep only the last 50 log lines
    while (logElement.childElementCount > 50) {
        logElement.removeChild(logElement.firstChild);
    }
}

// Setup fullscreen mode for mobile devices
function setupFullscreen() {
    // Check if it's a mobile device
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // Add fullscreen class
        document.querySelector('.container').classList.add('fullscreen');
        
        // Request fullscreen on touch
        document.addEventListener('click', () => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    // Ignore errors - not all browsers allow fullscreen
                });
            }
        }, { once: true });
    }
}