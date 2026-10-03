import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Validates selected file for image type and reasonable size.
 */
export const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPG, PNG, WEBP, or GIF image.',
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image size (${sizeMb} MB) exceeds maximum allowed limit of 5 MB.`,
    };
  }
  return { valid: true, error: null };
};

/**
 * Compresses/resizes large photos in browser canvas to prevent bloated uploads.
 */
export const compressImage = async (file, maxDimension = 1600, quality = 0.85) => {
  if (file.type === 'image/gif') {
    // Return animated GIFs unmodified
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a validated problem image to Firebase Storage.
 * Secure storage path: problem-images/{workspaceId}/{userId}/{problemId}/{filename}
 */
export const uploadProblemImage = async ({ workspaceId, userId, problemId = 'temp', file }) => {
  if (!file) return null;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!storage) {
    throw new Error(
      'Firebase Storage is not enabled on this Firebase project yet. Please activate Cloud Storage in the Firebase Console (Storage > Get Started).'
    );
  }

  const cleanFileName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 60);
  const uniquePrefix = Date.now().toString(36);
  const finalFileName = `${uniquePrefix}_${cleanFileName}`;

  const imagePath = `problem-images/${workspaceId}/${userId}/${finalFileName}`;
  const storageRef = ref(storage, imagePath);

  try {
    const compressed = await compressImage(file);
    const metadata = {
      contentType: compressed.type || file.type,
      customMetadata: {
        workspaceId,
        uploadedBy: userId,
        problemId,
      },
    };

    const snapshot = await uploadBytes(storageRef, compressed, metadata);
    const imageUrl = await getDownloadURL(snapshot.ref);

    return {
      imageUrl,
      imagePath,
      fileName: file.name,
      fileSize: compressed.size,
    };
  } catch (err) {
    console.error('[UNSAID Storage Upload Error]', err);
    if (err.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Please verify your workspace membership permissions.');
    }
    if (err.code === 'storage/project-not-found' || err.code === 'storage/bucket-not-found' || err.message?.includes('not found')) {
      throw new Error(
        'Firebase Storage has not been initialized in Firebase Console. Go to Firebase Console > Build > Storage and click "Get Started".'
      );
    }
    throw new Error(err.message || 'Failed to upload image. Please try again.');
  }
};
