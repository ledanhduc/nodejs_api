import express from 'express';
import admin from 'firebase-admin';
import { readFileSync } from 'fs'; // To read JSON file
import path from 'path'; // To handle file paths

const appServer = express();
const port = 8080;

// Read the Firebase authentication JSON file
const serviceAccount = JSON.parse(readFileSync(path.resolve('./sendopt-20057-b6de5656112f.json'), 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),  // Make sure to provide the correct JSON file
  databaseURL: 'https://sendopt-20057-default-rtdb.asia-southeast1.firebasedatabase.app',  // Firebase Realtime Database URL
});


////////////////////////////////////////////// 
/////     #root file server_1_2.js      /////
////////////////////////////////////////////

// Serve JSON requests
appServer.use(express.json());

// 'en-GB' trả về định dạng dd/mm/yyyy
function formatDate(timestamp) {
  const date = new Date(timestamp);

  return date.toLocaleDateString('en-GB'); 
}
const formattedDate = formatDate(Date.now());
// Create a random number and send it to Firebase
async function sendRandomNumber() {
  const randomNumber = Math.floor(Math.random() * 1000);
  // const timestamp = Date.now();

  // Get a reference to the database
  const db = admin.database();
  
  // Get references to the data paths
  const randomNumberRef = db.ref('/nodejs/test1/randomNumber');
  const timestampRef = db.ref('/nodejs/test1/timestamp');

  // Sending random number and timestamp to Firebase
  await randomNumberRef.set(randomNumber);
  await timestampRef.set(formattedDate);

  console.log(`Random Number: ${randomNumber}, Timestamp: ${formattedDate}`);
}

// A new function to send a custom message
async function sendMessage(id, message) {
  // Get a reference to the database
  const db = admin.database();

  // Reference to the Firebase path based on the id
  // const messageRef = db.ref(`/nodejs/test2/messages/${id}/message`);
  // const timestampRef = db.ref(`/nodejs/test2/messages/${id}/messageTimestamp`);
  const messageRef = db.ref('/nodejs/test2/message');
  const timestampRef = db.ref('/nodejs/test2/messageTimestamp');
  const idRef = db.ref('/nodejs/test2/id');

  const formattedDate = new Date().toISOString(); // Example of formatting the date

  // Save message and timestamp for the given id
  await messageRef.set(message);
  await timestampRef.set(formattedDate);
  await idRef.set(id);

  console.log(`ID: ${id}, Message: ${message}, Timestamp: ${formattedDate}`);
}


// Listen for POST requests from ESP32 or any device
appServer.post('/ping', async (req, res) => {
  console.log('Received POST request to /ping');
  
  // Call the function to send the random number to Firebase
  await sendRandomNumber();
  
  // Send a response back to the client
  res.status(200).send('Data sent to Firebase');
});

// New route to send a custom message and id
appServer.post('/sendMessage', async (req, res) => {
  // Lấy id và message từ query string
  const { id, message } = req.query;

  // Kiểm tra nếu id hoặc message không tồn tại trong query string
  if (!id || !message) {
    return res.status(400).send('Both id and message are required');
  }

  console.log('Received POST request to /sendMessage');
  
  // Gọi hàm để gửi message và id lên Firebase
  await sendMessage(id, message);
  
  // Gửi phản hồi lại client
  res.status(200).send('Message sent to Firebase');
});

// Start the server
appServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
