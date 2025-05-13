/*
  CreaSense.ino
  ESP32 sensor data sender for CreaTune application
  Modified for DFRobot Moisture Sensor on ESP32 Firebeetle 2 C6
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "config.h"

WebSocketsClient webSocket;
unsigned long lastSendTime = 0;
unsigned long lastConnectionAttempt = 0;
const unsigned long connectionRetryInterval = 5000; // 5 seconds between connection attempts

// LED pin for status indication
const int STATUS_LED = 38; // Built-in LED on Firebeetle 2 C6

// DFRobot Moisture Sensor ranges
const int MOISTURE_DRY = 0;     // Dry soil minimum value
const int MOISTURE_DRY_MAX = 300;  // Dry soil maximum value
const int MOISTURE_HUMID_MIN = 300; // Humid soil minimum value
const int MOISTURE_HUMID_MAX = 700; // Humid soil maximum value
const int MOISTURE_WET_MIN = 700;   // In water minimum value
const int MOISTURE_WET_MAX = 950;   // In water maximum value

// For smoothing sensor readings
const int NUM_READINGS = 5;
int moistureReadings[NUM_READINGS];
int readIndex = 0;
int totalMoisture = 0;
int averageMoisture = 0;

void setup() {
  // Initialize serial for debugging
  Serial.begin(115200);
  Serial.println("\nCreaSense Moisture Sensor - Starting up...");

  // Set up LED pin
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // Configure ADC
  analogReadResolution(12); // Set ADC resolution to 12 bits

  // Initialize moisture reading array
  for (int i = 0; i < NUM_READINGS; i++) {
    moistureReadings[i] = 0;
  }

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); // Blink LED
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi!");
    digitalWrite(STATUS_LED, HIGH); // LED on when connected
    
    // Print connection details
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\nFailed to connect to WiFi!");
    digitalWrite(STATUS_LED, LOW); // LED off when failed
  }

  // WebSocket configuration
  Serial.print("WebSocket Server: ");
  Serial.print(WEBSOCKET_HOST);
  Serial.print(":");
  Serial.println(WEBSOCKET_PORT);
  
  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  
  // Print sensor info
  Serial.print("Sensor Name: ");
  Serial.println(SENSOR_NAME);
  Serial.print("Sensor Pin: ");
  Serial.println(SENSOR_PIN);
  Serial.print("Reading Interval: ");
  Serial.print(READING_INTERVAL);
  Serial.println("ms");
  Serial.println("DFRobot Moisture Sensor connected");
}

void loop() {
  // Check WiFi connection and reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastConnectionAttempt > connectionRetryInterval) {
      Serial.println("WiFi disconnected. Reconnecting...");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      lastConnectionAttempt = currentMillis;
    }
    digitalWrite(STATUS_LED, LOW); // LED off when disconnected
  } else {
    // Only process WebSocket if WiFi is connected
    webSocket.loop();
    
    // Send sensor data at the specified interval
    unsigned long currentTime = millis();
    if (currentTime - lastSendTime >= READING_INTERVAL) {
      sendSensorData();
      lastSendTime = currentTime;
      
      // Blink LED on data send
      digitalWrite(STATUS_LED, LOW);
      delay(50);
      digitalWrite(STATUS_LED, HIGH);
    }
  }
}

// Read the moisture sensor and smooth the values
int readMoistureSensor() {
  // Subtract the last reading
  totalMoisture = totalMoisture - moistureReadings[readIndex];
  
  // Read the sensor
  moistureReadings[readIndex] = analogRead(SENSOR_PIN);
  
  // Add the reading to the total
  totalMoisture = totalMoisture + moistureReadings[readIndex];
  
  // Advance to the next position in the array
  readIndex = (readIndex + 1) % NUM_READINGS;
  
  // Calculate the average
  averageMoisture = totalMoisture / NUM_READINGS;
  
  return averageMoisture;
}

// Map moisture reading to app-compatible range (0.4-0.8)
float moistureToAppValue(int moistureValue) {
  float appValue;
  
  // Determine soil condition and map to appropriate range
  if (moistureValue <= MOISTURE_DRY_MAX) {
    // Dry soil (0-300) maps to 0.4-0.5
    appValue = map(moistureValue, MOISTURE_DRY, MOISTURE_DRY_MAX, 40, 50) / 100.0;
  } 
  else if (moistureValue <= MOISTURE_HUMID_MAX) {
    // Humid soil (301-700) maps to 0.5-0.7
    appValue = map(moistureValue, MOISTURE_HUMID_MIN, MOISTURE_HUMID_MAX, 50, 70) / 100.0;
  } 
  else {
    // In water (701-950) maps to 0.7-0.8
    appValue = map(moistureValue, MOISTURE_WET_MIN, MOISTURE_WET_MAX, 70, 80) / 100.0;
  }
  
  // Ensure value is within 0.4-0.8 range
  if (appValue < 0.4) appValue = 0.4;
  if (appValue > 0.8) appValue = 0.8;
  
  return appValue;
}

void sendSensorData() {
  // Read moisture sensor
  int moistureValue = readMoistureSensor();
  
  // Map to app-compatible value (0.4-0.8)
  float appValue = moistureToAppValue(moistureValue);
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["sensor"] = SENSOR_NAME;
  doc["raw_value"] = moistureValue;
  doc["moisture_app_value"] = appValue;
  doc["voltage"] = appValue; // Send as voltage to be compatible with app
  doc["timestamp"] = millis();
  doc["type"] = "sensor_data";
  
  // Add soil condition description
  if (moistureValue <= MOISTURE_DRY_MAX) {
    doc["soil_condition"] = "dry";
  } else if (moistureValue <= MOISTURE_HUMID_MAX) {
    doc["soil_condition"] = "humid";
  } else {
    doc["soil_condition"] = "wet";
  }
  
  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Log the data
  Serial.print("Sending: ");
  Serial.println(jsonString);
  
  // Send through WebSocket
  webSocket.sendTXT(jsonString);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected");
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected");
      // Send initial data immediately after connection
      sendSensorData();
      break;
      
    case WStype_TEXT:
      Serial.printf("Received text: %s\n", payload);
      
      // You can parse received commands here if needed
      // For example, to change reading interval or other settings
      
      break;
      
    case WStype_ERROR:
      Serial.println("[WSc] Error!");
      break;
  }
}