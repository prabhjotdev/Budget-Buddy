const sharp = require('sharp');
const path = require('path');

// Create a simple placeholder icon with 'BB' text
const createIcon = async (size, filename) => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#4f46e5"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.35}"
            font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">
        BB
      </text>
    </svg>
  `;

  const outputPath = path.join(__dirname, '..', 'public', filename);

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`Created ${filename}`);
};

Promise.all([
  createIcon(192, 'pwa-192x192.png'),
  createIcon(512, 'pwa-512x512.png'),
  createIcon(180, 'apple-touch-icon.png')
]).then(() => console.log('All icons created!'));
