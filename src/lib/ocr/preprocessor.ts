import sharp from 'sharp';

export interface PreprocessOptions {
  maxWidth?: number;
  maxHeight?: number;
  grayscale?: boolean;
  normalize?: boolean;
  sharpen?: boolean;
  threshold?: number;
  denoise?: boolean;
}

export async function preprocessImage(
  buffer: Buffer,
  options: PreprocessOptions = {}
): Promise<Buffer> {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    grayscale = true,
    normalize = true,
    sharpen = true,
    threshold,
    denoise = true,
  } = options;

  let processed = sharp(buffer);

  // Resize
  processed = processed.resize(maxWidth, maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Grayscale
  if (grayscale) {
    processed = processed.grayscale();
  }

  // Normalize (contrast + brightness)
  if (normalize) {
    processed = processed.normalize();
  }

  // Denoise
  if (denoise) {
    processed = processed.median(3);
  }

  // Sharpen
  if (sharpen) {
    processed = processed.sharpen();
  }

  // Threshold
  if (threshold !== undefined && threshold >= 0 && threshold <= 255) {
    processed = processed.threshold(threshold);
  }

  return processed.toBuffer();
}

// Detect image quality
export async function analyzeImageQuality(buffer: Buffer): Promise<{
  width: number;
  height: number;
  size: number;
  aspectRatio: number;
  isBlurry: boolean;
}> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const size = buffer.length;

  // Simple blur detection based on file size vs resolution
  const pixelCount = width * height;
  const bytesPerPixel = size / pixelCount;
  const isBlurry = bytesPerPixel < 0.5; // Threshold for blurry images

  return {
    width,
    height,
    size,
    aspectRatio: height > 0 ? width / height : 0,
    isBlurry,
  };
}

// Extract text regions from image
export async function extractTextRegions(buffer: Buffer): Promise<Array<{
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}>> {
  // This is a placeholder - in production, use a text detection model
  // For now, return the whole image as one region
  const metadata = await sharp(buffer).metadata();
  return [{
    x: 0,
    y: 0,
    width: metadata.width || 0,
    height: metadata.height || 0,
    confidence: 0.8,
  }];
}