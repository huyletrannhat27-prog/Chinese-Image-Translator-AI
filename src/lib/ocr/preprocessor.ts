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
    maxWidth = 1600,
    maxHeight = 1600,
    grayscale = true,
    normalize = true,
    sharpen = true,
    threshold,
    denoise = true,
  } = options;

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const isLarge = (width || 0) > 2000 || (height || 0) > 2000;

  let processed = sharp(buffer);

  processed = processed.resize(
    isLarge ? maxWidth : Math.min(width || maxWidth, maxWidth),
    isLarge ? maxHeight : Math.min(height || maxHeight, maxHeight),
    {
      fit: 'inside',
      withoutEnlargement: true,
    }
  );

  if (grayscale) {
    processed = processed.grayscale();
  }

  if (normalize) {
    processed = processed.normalize();
  }

  if (denoise) {
    processed = processed.median(2);
  }

  if (sharpen) {
    processed = processed.sharpen();
  }

  if (threshold !== undefined && threshold >= 0 && threshold <= 255) {
    processed = processed.threshold(threshold);
  }

  return processed.toBuffer({ resolveWithObject: false });
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