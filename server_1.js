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

async function Img2Text(base64Image) {
  return new Promise((resolve, reject) => {
    const requestData = { image_base64: base64Image };

    fetch('https://virtually-excited-quail.ngrok-free.app/process_image', {
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

const processImg_branch = "processImage"

// Post endpoint to process image and store result in Firebase
appServer.post(`/${processImg_branch}`, async (req, res) => {
  try {
    // Retrieve 'id' and 'imgRef' from query parameters
    const { id, imgRef } = req.query;
    
    if (!id || !imgRef) {
      return res.status(400).send('Missing "id" or "imgRef" query parameter');
    }

    // Retrieve image and additional data from Firebase
    const snapshot = await db.ref(`/${id}/${imgRef}`).get();
    if (!snapshot.exists()) {
      return res.status(404).send('Image not found in Firebase');
    }
    const img = snapshot.val();  // Base64 Image

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
    const number = await Img2Text(processedBase64);  // Use await to get the number from Img2Text

    // Store the result into Firebase
    const numbRef = "number_" + imgRef;
    const numberRef = db.ref(`/${id}/${numbRef}`);
    await numberRef.set(number);  // Save the number into Firebase

    // Return success response
    res.status(200).send(`${processImg_branch} processed and sent to Firebase`);

  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).send(`Failed to process and store img -${processImg_branch}: ` + error.message);
  }
});

const swapImg_branch = "swapImageMonthly"
appServer.post(`/${swapImg_branch}`, async (req, res) => {
  try {

    const { id, preRef, curRef, newcurRef  } = req.query;
    
    if (!id || !preRef || !curRef || !newcurRef) {
      return res.status(400).send('Missing "id", "preRef", "curRef" or "newcurRef"');
    }

    // Lấy dữ liệu từ Firebase
    const snapshot1 = await db.ref(`/${id}/${curRef}`).get();
    const current = snapshot1.val(); // Base64 Image

    const snapshot2 = await db.ref(`/${id}/${newcurRef}`).get();
    const newcurrent = snapshot2.val(); // Base64 Image
    
    const currentRef = db.ref(`/${id}/${curRef}`);
    await currentRef.set(newcurrent);  // Save the number into Firebase

    const previousRef = db.ref(`/${id}/${preRef}`);
    await previousRef.set(current);  // Save the number into Firebase


    // Return success response
    res.status(200).send(`${swapImg_branch} processed and sent to Firebase`);

  } catch (error) {
    console.error(error);
    res.status(500).send(`Failed to process and store image ${swapImg_branch}`);
  }
});

// Start the server
appServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
