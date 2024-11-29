import express from 'express';
import admin from 'firebase-admin';
import { readFileSync } from 'fs'; // To read JSON file
import moment from 'moment-timezone';
import path from 'path'; // To handle file paths
import sharp from 'sharp';
import fetch from 'node-fetch';
import cors from 'cors';

const appServer = express();
const port = 80;

// Read the Firebase authentication JSON file
const serviceAccount = JSON.parse(readFileSync(path.resolve('./sendopt-20057-b6de5656112f.json'), 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),  // Make sure to provide the correct JSON file
  databaseURL: 'https://sendopt-20057-default-rtdb.asia-southeast1.firebasedatabase.app',  // Firebase Realtime Database URL
  storageBucket: 'gs://sendopt-20057.appspot.com'
});


// Utility function để lấy thời gian Việt Nam
function getVietnameTime() {
  const vietnamTime = moment().tz('Asia/Ho_Chi_Minh');
  return {
    mm: vietnamTime.format('MM'),
    dd: vietnamTime.format('DD'),
    time: vietnamTime.format('HH:mm:ss')
  };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 
//\\\     #root file server_1_3.js                \\\\
//\\\     + add post /html get /ping -> 4 test        \\\\
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

appServer.use(express.json({ limit: '1mb' }));  // Giới hạn payload là 1MB

appServer.use(cors());


const db = admin.database();
// const storage = admin.storage();


async function Img2Text(base64Image) {
  return new Promise((resolve, reject) => {
    const requestData = { image_base64: base64Image };

    fetch('https://weevil-decent-legally.ngrok-free.app/process_image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })
    .then(response => {
      if (!response.ok) {
        return reject(new Error(`Error processing image: ${response.statusText}`));
      }
      return response.json();
    })
    .then(data => {
      if (data.number) {
        resolve(data.number);
        console.log(data.number);
      } else {
        reject(new Error('No number found in response'));
      }
    })
    .catch(error => {
      console.error('Error processing image:', error);
      reject(error);
    });
  });
}

// API process base64 save to Firebase
const base642fb_branch = "base642fb";
appServer.post(`/${base642fb_branch}`, async (req, res) => {
  const { mm, dd, time } = getVietnameTime();
  try {
    // Extract id, imgRef, and base64Image from the request
    const { id, imgRef } = req.query;  // Extract query parameters
    const { base64Image } = req.body;  // Extract body content

    // Check if all required parameters are present
    if (!id || !imgRef || !base64Image) {
      return res.status(400).send('Missing "id", "imgRef" or "base64Image"');
    }

    if (imgRef == 'monthly') {
      const currentRef = db.ref(`/${id}/monthly/${mm}`);
      await currentRef.set(base64Image);
      const currentRef1 = db.ref(`/${id}/monthly/${mm}_time`);
      await currentRef1.set(time);  
      console.log(`Image data saved to Firebase at path: ${id}/monthly/${mm}`);
    }
    
    if (imgRef == 'daily') {
      const currentRef = db.ref(`/${id}/daily/${dd}`);
      await currentRef.set(base64Image);
      const currentRef1 = db.ref(`/${id}/daily/${dd}_time`);
      await currentRef1.set(time);  
      console.log(`Image data saved to Firebase at path: ${id}/daily/${dd}`);
    } 
    
    if (imgRef == 'img_config') {
      // Save the base64 image data to Firebase Database
      const currentRef = db.ref(`/${id}/${imgRef}`);
      await currentRef.set(base64Image);  // Save the base64 image into Firebase
      console.log(`Image data saved to Firebase at path: ${id}/${imgRef}`);
    }

    // Trigger image processing without waiting for completion (no await)
    // if(imgRef == 'daily' || imgRef == 'monthly'){
    //   processImage(id, imgRef, base64Image);  // No await, this runs asynchronously
    // } 
    (imgRef === 'daily' || imgRef === 'monthly') && processImage(id, imgRef, base64Image);

    // Return success response immediately without waiting for image processing
    res.status(200).send(`${base642fb_branch} processed and sent to Firebase`);

  } catch (error) {
    console.error(error);
    res.status(500).send(`Failed to process and store image ${base642fb_branch}`);
  }
});

// Function to process the image and store result in Firebase
const processImage = async (id, imgRef, base64Image) => {
  const { mm, dd } = getVietnameTime();
  try {

    const snapshot1 = await db.ref(`/${id}/angle`).get();
    const angle = snapshot1.exists() ? snapshot1.val() : console.log("miss angle data"); 

    const snapshot2 = await db.ref(`/${id}/startX`).get();
    const startX = snapshot2.exists() ? snapshot2.val() : console.log("miss startX"); 

    const snapshot3 = await db.ref(`/${id}/startY`).get();
    const startY = snapshot3.exists() ? snapshot3.val() : console.log("miss startY data"); 

    const snapshot4 = await db.ref(`/${id}/endX`).get();
    const endX = snapshot4.exists() ? snapshot4.val() : console.log("miss endX data"); 

    const snapshot5 = await db.ref(`/${id}/endY`).get();
    const endY = snapshot5.exists() ? snapshot5.val() : console.log("miss endY data");

    // Convert Base64 to Buffer
    const buffer = Buffer.from(base64Image, 'base64');

    // Process the image using Sharp
    let processedImage = await sharp(buffer)
      .rotate(angle)  // Rotate the image if necessary
      .composite([{
        input: Buffer.from(
          `<svg width="${endX - startX}" height="${endY - startY}">
            <rect x="0" y="0" width="${endX - startX}" height="${endY - startY}" fill="none" stroke="red" stroke-width="5" />
          </svg>`),
        top: startY,
        left: startX,
      }])
      .extract({ left: startX, top: startY, width: endX - startX, height: endY - startY }) // Crop the image to the red box area
      .resize({ // Optionally increase quality or resize image (for higher quality)
        width: endX - startX,
        height: endY - startY,
        withoutEnlargement: true,  // Do not enlarge the image
        kernel: sharp.kernel.lanczos3, // Use Lanczos for better quality
        quality: 100  // Set quality to high (1-100)
      })
      .toBuffer();

    // Convert processed image to Base64
    const processedBase64 = processedImage.toString('base64');

    const number = await Img2Text(processedBase64);  // Use await to get the number from Img2Text
    
    let resultRefPath;

    // Check if imgRef is "monthly", and set result path accordingly
    if(imgRef === 'monthly'){
      resultRefPath = `/${id}/monthly/${mm}_result`;

    }
    if(imgRef === 'daily'){
      resultRefPath = `/${id}/monthly/${dd}_result`;
    }


    const resultRef = db.ref(resultRefPath);
    await resultRef.set(number);

    console.log(`Image processed and stored at ${resultRefPath}`);
    
  } catch (error) {
    // Handle any errors that occur during image processing
    console.error('Error processing image:', error);
  }
};

const processImg_branch = "processImage"

// Post endpoint to process image and store result in Firebase
appServer.post(`/${processImg_branch}`, async (req, res) => {
  try {
    // Retrieve 'id' and 'imgRef' from query parameters
    const { id, imgRef } = req.query; 
    const { base64Image } = req.body;  

    // Check if all required parameters are present
    if (!id || !imgRef || !base64Image) {
      return res.status(400).send('Missing "id", "imgRef" or "base64Image"');
    }

    // Process the image and store result
    await processImage(id, imgRef, base64Image);

    // Return success response
    res.status(200).send(`${processImg_branch} processed and sent to Firebase`);

  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).send(`Failed to process and store img -${processImg_branch}: ` + error.message);
  }
});

// const log_branch = "log"

// // Post endpoint to process image and store result in Firebase
// appServer.post(`/${log_branch}`, async (req, res) => {
//   try {
//     // Retrieve 'id' and 'imgRef' from query parameters
//     const { id, imgRef } = req.query; 
//     const { base64Image } = req.body;  


//   } catch (error) {
//     console.error('Error processing image:', error);
//     res.status(500).send(`Failed to process and store img -${log_branch}: ` + error.message);
//   }
// });

appServer.get('/html', async (req, res) => {
  try {
    res.status(200).send('hello, world');
  } catch (error) {
    res.status(500).send('Failed to display image');
  }
});

appServer.post('/ping', async (req, res) => {
  const { mm, dd, time } = getVietnameTime();
  const randomNumber = Math.floor(Math.random() * 1000);

  console.log(randomNumber);
  console.log(`Month: ${mm}`);
  console.log(`Day: ${dd}`);
  console.log(`Time: ${time}`);
  res.status(200).send(`ping ok, randomNumber: ${randomNumber}`);
});

// Start the server
appServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});