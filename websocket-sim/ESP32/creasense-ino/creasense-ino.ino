/*
  CreaSense.ino
  ESP32 sensor data sender for CreaTune application
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
const int STATUS_LED = 2; // Built-in LED on most ESP32 boards

void setup() {
  // Initialize serial for debugging
  Serial.begin(115200);
  Serial.println("\nCreaSense - Starting up...");

  // Set up LED pin
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // Configure ADC
  analogReadResolution(12); // Set ADC resolution to 12 bits

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

void sendSensorData() {
  // Read analog value from sensor
  int rawValue = analogRead(SENSOR_PIN);
  
  // Convert to voltage (0-3.3V)
  float voltage = (rawValue / ADC_RESOLUTION) * VOLTAGE_REFERENCE;
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["sensor"] = SENSOR_NAME;
  doc["raw_value"] = rawValue;
  doc["voltage"] = voltage;
  doc["timestamp"] = millis();
  
  // Special field for CreaTune app to recognize the data type
  doc["type"] = "sensor_data";
  
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
