const sharp = require('sharp');
const path = require('path');

async function convertLogo() {
  try {
    const inputPath = path.join(__dirname, 'public', 'logo.webp');
    const outputPath = path.join(__dirname, 'public', 'logo.png');
    
    await sharp(inputPath)
      .png()
      .toFile(outputPath);
    
    console.log('✅ Logo converted successfully from webp to PNG!');
  } catch (error) {
    console.error('❌ Error converting logo:', error);
  }
}

convertLogo();