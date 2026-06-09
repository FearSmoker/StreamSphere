'use strict';

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function processLogo() {
  const inputPath = '/Users/aryansaxena/Downloads/StreamSphere_Logo1.png';
  
  // Define destination paths in the client directory
  const clientPublicDir = '/Users/aryansaxena/Desktop/StreamSphere/StreamSphereOTT/client/public';
  
  const destLogo = path.join(clientPublicDir, 'logo.png');
  const destFaviconDir = path.join(clientPublicDir, 'favicon');
  
  console.log(`Loading input image from: ${inputPath}`);
  
  try {
    // 1. Read the image and get raw pixel buffer
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const { width, height, channels } = info;
    console.log(`Image loaded successfully: ${width}x${height} with ${channels} channels`);
    
    // Create a new buffer for the modified pixel data
    const modifiedData = Buffer.alloc(data.length);
    
    // Threshold to detect black/near-black background
    // If all R, G, B are below this value, we treat it as background and make it transparent.
    const threshold = 18; 
    
    let transparentCount = 0;
    
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let a = data[i + 3];
      
      // Calculate brightness or simply check if all colors are close to black
      if (r < threshold && g < threshold && b < threshold) {
        // Set alpha to 0 (fully transparent)
        a = 0;
        transparentCount++;
      }
      
      modifiedData[i] = r;
      modifiedData[i + 1] = g;
      modifiedData[i + 2] = b;
      modifiedData[i + 3] = a;
    }
    
    console.log(`Processed pixels: ${transparentCount} out of ${width * height} pixels made transparent.`);
    
    // 2. Write the processed transparent image to the target directories
    
    // Write main logo.png (transparent)
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .png()
    .toFile(destLogo);
    
    console.log(`Saved transparent logo to: ${destLogo}`);
    
    // Write favicon-32x32.png
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .resize(32, 32)
    .png()
    .toFile(path.join(destFaviconDir, 'favicon-32x32.png'));
    console.log(`Saved favicon-32x32.png`);

    // Write favicon-16x16.png
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .resize(16, 16)
    .png()
    .toFile(path.join(destFaviconDir, 'favicon-16x16.png'));
    console.log(`Saved favicon-16x16.png`);
    
    // Write apple-touch-icon.png
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .resize(180, 180)
    .png()
    .toFile(path.join(destFaviconDir, 'apple-touch-icon.png'));
    console.log(`Saved apple-touch-icon.png`);

    // Write android-chrome-192x192.png
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .resize(192, 192)
    .png()
    .toFile(path.join(destFaviconDir, 'android-chrome-192x192.png'));
    console.log(`Saved android-chrome-192x192.png`);

    // Write android-chrome-512x512.png
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .resize(512, 512)
    .png()
    .toFile(path.join(destFaviconDir, 'android-chrome-512x512.png'));
    console.log(`Saved android-chrome-512x512.png`);

    // Write favicon.ico (using ICO format / png format resized to 48x48 or multi-size)
    // Sharp does not directly support .ico format, but modern browsers support .ico as renamed png or we can write a png format as favicon.ico, or resize to 48x48.
    // Let's write it as a 48x48 PNG and save it as favicon.ico (most browsers support PNG in .ico extension).
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .resize(48, 48)
    .png()
    .toFile(path.join(destFaviconDir, 'favicon.ico'));
    console.log(`Saved favicon.ico`);
    
    console.log('All logo and favicon assets processed successfully!');
    
  } catch (error) {
    console.error('Error processing logo:', error);
  }
}

processLogo();
