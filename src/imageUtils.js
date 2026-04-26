/**
 * Resizes and compresses an image to reduce upload size.
 * @param {File|Blob|string} imageSource - The source of the image (File object or Data URL).
 * @param {Object} options - Compression options.
 * @param {number} options.maxWidth - Maximum width of the resized image.
 * @param {number} options.maxHeight - Maximum height of the resized image.
 * @param {number} options.quality - JPEG quality (0 to 1).
 * @returns {Promise<{base64: string, preview: string}>} - A promise that resolves to an object containing the compressed base64 data and a preview URL.
 */
export async function compressImage(imageSource, { maxWidth = 1200, maxHeight = 1600, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Return as base64 JPEG
      const preview = canvas.toDataURL('image/jpeg', quality);
      const base64 = preview.split(',')[1];
      resolve({ base64, preview });
    };

    img.onerror = (err) => reject(new Error('Failed to load image for compression.'));

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => (img.src = e.target.result);
      reader.onerror = (err) => reject(new Error('Failed to read file for compression.'));
      reader.readAsDataURL(imageSource);
    }
  });
}
