'use strict';

const sharp = require('sharp');
const path = require('path');

async function processLogoWhite() {
  const inputPath = '/Users/aryansaxena/Downloads/StreamSphere_Logo_White.png';
  const clientPublicDir = '/Users/aryansaxena/Desktop/StreamSphere/StreamSphereOTT/client/public';
  const destLogo = path.join(clientPublicDir, 'logo_light.png');
  
  console.log(`Loading input white-background image from: ${inputPath}`);
  
  try {
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const { width, height, channels } = info;
    console.log(`Image loaded successfully: ${width}x${height} with ${channels} channels`);
    
    const modifiedData = Buffer.alloc(data.length);
    
    // Threshold to detect white/near-white background
    // If all R, G, B are above this value, we make it transparent.
    const threshold = 240; 
    
    let transparentCount = 0;
    
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let a = data[i + 3];
      
      if (r > threshold && g > threshold && b > threshold) {
        a = 0;
        transparentCount++;
      }
      
      modifiedData[i] = r;
      modifiedData[i + 1] = g;
      modifiedData[i + 2] = b;
      modifiedData[i + 3] = a;
    }
    
    console.log(`Processed pixels: ${transparentCount} out of ${width * height} pixels made transparent.`);
    
    await sharp(modifiedData, {
      raw: { width, height, channels }
    })
    .png()
    .toFile(destLogo);
    
    console.log(`Saved transparent light-mode logo to: ${destLogo}`);
    
  } catch (error) {
    console.error('Error processing light logo:', error);
  }
}

processLogoWhite();
