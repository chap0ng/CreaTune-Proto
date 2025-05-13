# CreaTune Setup Guide

## Overview

CreaTune is an interactive web application that generates music based on sensor data from an ESP32. The application features:

- Responsive design optimized for the Nothing Phone 2a and other mobile devices
- Fullscreen mode for immersive experience
- Microphone recording and audio analysis
- Ambient and Toy Piano synthesizers using Tone.js
- ESP32 sensor data integration
- PWA support for offline use

## Project Structure

```
CreaTune/
├── web/                     # Web application files
│   ├── index.html           # Main HTML file
│   ├── styles.css           # CSS styles
│   ├── app.js               # Application logic
│   ├── manifest.json        # PWA manifest
│   ├── service-worker.js    # Service worker for PWA
│   ├── images/              # Image assets
│   │   ├── mic-icon.png     # Microphone icon
│   │   ├── plant-icon.png   # Plant icon
│   │   └── creature.png     # Creature visual
│   └── icons/               # PWA icons
│       ├── icon-192x192.png # Small icon
│       └── icon-512x512.png # Large icon
├── websocket-server.js      # WebSocket server
├── package.json             # Node.js package file
└── ESP32/                   # ESP32 files
    ├── CreaSense.ino        # Main Arduino sketch
    └── config.h             # Configuration header
```

## Server Setup

1. **Install Node.js:**
   If you don't have Node.js installed, download and install it from [nodejs.org](https://nodejs.org/).

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure the Server:**
   - The server will run on port 8080 by default
   - Web files should be in the `web` directory

4. **Start the Server:**
   ```bash
   node websocket-server.js
   ```

5. **Access the Application:**
   - Open a browser and navigate to `http://localhost:8080`
   - For mobile devices, use the IP address of your server: `http://YOUR_SERVER_IP:8080`

## ESP32 Setup

1. **Required Libraries:**
   Install the following libraries in Arduino IDE:
   - WebSockets by Markus Sattler
   - ArduinoJson by Benoit Blanchon

2. **Configure ESP32:**
   - Open `config.h` and update WiFi credentials
   - Set the WebSocket server IP address to your computer's IP
   - Configure the sensor pin as needed

3. **Upload to ESP32:**
   - Connect your ESP32 to USB
   - Select the correct board and port in Arduino IDE
   - Upload the `CreaSense.ino` sketch

4. **Testing:**
   - The ESP32 onboard LED will blink during connection attempts
   - When connected successfully, it will stay on (with brief blinks on data send)
   - Open the Arduino Serial Monitor (115200 baud) to see debug information

## Using the Application

### Web Interface

- **Microphone Button:** Records audio for 5 seconds and analyzes it to generate sounds
- **Ambient Button:** Activates ambient synthesizer mode with slow, atmospheric sounds
- **Toy Piano Button:** Activates toy piano synthesizer with playful sounds
- **ESP32 Simulation:** Toggles simulated ESP32 data for testing
- **Status Indicators:** Show ESP32 connection and data validity

### ESP32 Integration

- The application expects sensor data in the range of 0.4 to 0.8
- When valid data is received, the creature will appear and sounds will be generated
- The sensor data affects pitch, reverb, and other sound parameters
- The ESP32 sends data every second by default

### Android Setup (Termux)

1. **Install Termux:**
   - Download from Play Store or F-Droid
   - Grant storage permissions: `termux-setup-storage`

2. **Install Node.js:**
   ```bash
   pkg update
   pkg install nodejs
   ```

3. **Clone and Run:**
   ```bash
   git clone https://github.com/prossel/CreaTune.git
   cd CreaTune
   npm install
   node websocket-server.js
   ```

4. **Access the App:**
   - Open Chrome and navigate to `http://localhost:8080`
   - Add to home screen for PWA installation

## Troubleshooting

- **WebSocket Connection Failed:**
  - Ensure the ESP32 and phone/computer are on the same network
  - Check firewall settings and ensure port 8080 is open
  - Verify the WebSocket host in `config.h` matches your server IP
  
- **No Sound:**
  - Click anywhere on the screen to initialize audio context
  - Ensure volume is turned up on your device
  - Some browsers require user interaction before playing audio
  
- **ESP32 Not Connecting:**
  - Check WiFi SSID and password in `config.h`
  - Verify the ESP32 is powered properly
  - Monitor the Serial output for debugging information

## Design Credits

- UI design inspired by Teenage Engineering products
- Color palette: 
  - Primary: #e6695a (coral)
  - Secondary: #699bc8 (blue)
  - Tertiary: #8ea47d (sage green)
  - Background: #f2efe9 (cream)
