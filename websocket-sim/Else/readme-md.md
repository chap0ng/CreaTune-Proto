# CreaTune

Interactive musical experience with ESP32 sensor integration, optimized for mobile devices.

## Features

- **Responsive Design**: Optimized for the Nothing Phone 2a and other Android devices
- **Fullscreen Mode**: Immersive experience on mobile devices
- **Audio Processing**: Record and analyze microphone input
- **Synthesizers**: Ambient and Toy Piano synths using Tone.js
- **ESP32 Integration**: Receive sensor data to control music parameters
- **Visualization**: Interactive creature that responds to sensor values
- **PWA Support**: Install as a standalone app on mobile devices
- **Offline Support**: Basic functionality works without internet

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/CreaTune.git
   cd CreaTune
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open in browser:
   - Web: `http://localhost:8080`
   - Mobile: `http://YOUR_SERVER_IP:8080`

## ESP32 Setup

1. Install required libraries:
   - WebSockets by Markus Sattler
   - ArduinoJson by Benoit Blanchon

2. Configure your WiFi credentials in `config.h`

3. Upload the `CreaSense.ino` sketch to your ESP32

## Interface

- **Mic Icon**: Toggle microphone recording
- **Plant Icon**: Toggle creature visibility
- **TV Icon**: Toggle ESP32 simulation
- **Record Button**: Capture and analyze audio input
- **Ambient Button**: Play ambient synthesizer sounds
- **Toy Piano Button**: Play toy piano synthesizer sounds

## Design

The UI is inspired by Teenage Engineering products with a minimal, functional aesthetic. The color palette consists of:

- Primary: #e6695a (coral)
- Secondary: #699bc8 (blue)
- Tertiary: #8ea47d (sage green)
- Background: #f2efe9 (cream)

## Project Structure

```
CreaTune/
├── web/                  # Web application files
│   └── ...               # HTML, CSS, JS, and assets
├── ESP32/                # ESP32 firmware
│   └── ...               # Arduino sketch and configuration
├── websocket-server.js   # WebSocket server
└── package.json          # Node.js package file
```

## License

MIT

## Acknowledgements

- Tone.js for audio synthesis
- ws library for WebSocket communication
