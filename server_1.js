import express from 'express';
import admin from 'firebase-admin';
import { readFileSync } from 'fs'; // To read JSON file
import path from 'path'; // To handle file paths
import sharp from 'sharp';

const appServer = express();
const port = 8080;

// Read the Firebase authentication JSON file
const serviceAccount = JSON.parse(readFileSync(path.resolve('./sendopt-20057-b6de5656112f.json'), 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),  // Make sure to provide the correct JSON file
  databaseURL: 'https://sendopt-20057-default-rtdb.asia-southeast1.firebasedatabase.app',  // Firebase Realtime Database URL
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 
//\\\     #root file server_post_cutImg_dataFB.js        \\\\
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const db = admin.database();

// async function Img2Text(base64Image) {
//   return new Promise((resolve, reject) => {
//     const requestData = { image_base64: base64Image };

//     fetch('http://127.0.0.1:5000/process_image', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(requestData),
//     })
//     .then(response => response.json())  // Assuming response is in JSON format
//     .then(data => {
//       if (data.number) {
//         resolve(data.number);  // Only resolve if 'number' is available in response
//         console.log(data.number)
//       } else {
//         reject(new Error('No number found in response'));
//       }
//     })
//     .catch(error => {
//       console.error('Error processing image:', error);
//       reject(error);
//     });
//   });
// }


// Post endpoint to process image and store result in Firebase
appServer.post('/processImage', async (req, res) => {
  try {
    // Retrieve 'id' and 'imgRef' from query parameters
    const { id, imgRef } = req.query;
    
    if (!id || !imgRef) {
      return res.status(400).send('Missing "id" or "imgRef" query parameter');
    }

    // Lấy dữ liệu từ Firebase
    const snapshot = await db.ref(`/${id}/${imgRef}`).get();
    const img = snapshot.val(); // Base64 Image

    const snapshot1 = await db.ref(`/${id}/angle`).get();
    const angle = snapshot1.val(); // Angle value

    const snapshot2 = await db.ref(`/${id}/startX`).get();
    const startX = snapshot2.val(); // Start X

    const snapshot3 = await db.ref(`/${id}/startY`).get();
    const startY = snapshot3.val(); // Start Y

    const snapshot4 = await db.ref(`/${id}/endX`).get();
    const endX = snapshot4.val(); // End X

    const snapshot5 = await db.ref(`/${id}/endY`).get();
    const endY = snapshot5.val(); // End Y

  // Convert Base64 to Buffer
  const buffer = Buffer.from(img, 'base64');

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

    // Generate cutRef for the processed image
    const cutRef = "cut_" + imgRef;
    const cutimgrRef = db.ref(`/${id}/${cutRef}`);

    // Store the processed image (Base64) into Firebase
    await cutimgrRef.set(processedBase64);

    
    // Wait for Img2Text result
    // const number = await Img2Text(processedBase64);  // Use await to get the number from Img2Text

    // // Store the result into Firebase
    // const numbRef = "number_" + imgRef;
    // const numberRef = db.ref(`/${id}/${numbRef}`);
    // await numberRef.set(number);  // Save the number into Firebase


    // Return success response
    res.status(200).send('Image processed and sent to Firebase');

  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to process and store image');
  }
});

// Start the server
appServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});