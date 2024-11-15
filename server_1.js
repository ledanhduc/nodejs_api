import express from 'express';
import admin from 'firebase-admin';
import { readFileSync } from 'fs'; // To read JSON file
import path from 'path'; // To handle file paths

const appServer = express();
const port = 3000;

// Read the Firebase authentication JSON file
const serviceAccount = JSON.parse(readFileSync(path.resolve('./sendopt-20057-b6de5656112f.json'), 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),  // Make sure to provide the correct JSON file
  databaseURL: 'https://sendopt-20057-default-rtdb.asia-southeast1.firebasedatabase.app',  // Firebase Realtime Database URL
});

// Serve JSON requests
appServer.use(express.json());

// Create a random number and send it to Firebase
async function sendRandomNumber() {
  const randomNumber = Math.floor(Math.random() * 1000);
  const timestamp = Date.now();

  // Get a reference to the database
  const db = admin.database();
  
  // Get references to the data paths
  const randomNumberRef = db.ref('/nodejs/test/randomNumber');
  const timestampRef = db.ref('/nodejs/test/timestamp');

  // Sending random number and timestamp to Firebase
  await randomNumberRef.set(randomNumber);
  await timestampRef.set(timestamp);

  console.log(`Random Number: ${randomNumber}, Timestamp: ${timestamp}`);
}

// Listen for POST requests from ESP32 or any device
appServer.post('/ping', async (req, res) => {
  console.log('Received POST request to /ping');
  
  // Call the function to send the random number to Firebase
  await sendRandomNumber();
  
  // Send a response back to the client
  res.status(200).send('Data sent to Firebase');
});

// Start the server
appServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// appServer.listen(port, '0.0.0.0', () => {
//   console.log(`Server running on http://0.0.0.0:${port}`);
// });
