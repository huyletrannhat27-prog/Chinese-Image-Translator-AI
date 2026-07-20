import sharp from 'sharp';

for (const size of [192, 512]) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.52);
  const svg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
      <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="white">译</text>
    </svg>`);

  await sharp(svg).png().toFile(`public/icon-${size}.png`);
}
