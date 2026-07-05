// src/lib/ocr/tesseractLoader.ts

let tesseractInstance: any = null;

export async function loadTesseract() {
  if (tesseractInstance) return tesseractInstance;

  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return await import('tesseract.js');
    }

    // Tải Tesseract từ CDN hoặc cache
    const scriptUrl = localStorage.getItem('tesseract_script_content');
    if (scriptUrl) {
      // Load từ cache
      tesseractInstance = await import('tesseract.js');
    } else {
      // Load từ CDN
      const module = await import('tesseract.js');
      tesseractInstance = module;
      
      // Cache script để dùng offline
      try {
        const response = await fetch(
          'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js'
        );
        const content = await response.text();
        localStorage.setItem('tesseract_script_content', content);
        localStorage.setItem('tesseract_script_version', '4.1.1');
      } catch (e) {
        console.warn('Failed to cache Tesseract script');
      }
    }
    return tesseractInstance;
  } catch (error) {
    console.error('Failed to load Tesseract:', error);
    throw error;
  }
}