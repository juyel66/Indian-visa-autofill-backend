/**
 * Validation utility for Applicant Passport Photo
 * 
 * Supports JPEG, PNG, and WebP images.
 * Validates magic byte signatures, max size (5MB), and dimensions.
 */

export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export interface ValidationResult {
  valid: boolean;
  isTooLarge?: boolean;
  mimeType?: string;
  width?: number;
  height?: number;
  size?: number;
  error?: string;
}

/**
 * Validates magic bytes and determines the genuine MIME type of the image buffer.
 */
export function detectImageMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // 3. WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Extracts dimensions (width, height) from JPEG, PNG, or WebP buffers without heavy external libraries.
 */
export function extractImageDimensions(
  buffer: Buffer,
  detectedMime: string
): { width: number; height: number } | null {
  try {
    if (detectedMime === 'image/png') {
      if (buffer.length >= 24) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    } else if (detectedMime === 'image/jpeg') {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];

        // SOF0 to SOF15 (excluding DHT, JPG, DAC)
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);

        if (isSOF) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }

        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    } else if (detectedMime === 'image/webp') {
      const format = buffer.subarray(12, 16).toString('ascii');
      if (format === 'VP8 ' && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      } else if (format === 'VP8L' && buffer.length >= 26) {
        const b1 = buffer[21];
        const b2 = buffer[22];
        const b3 = buffer[23];
        const b4 = buffer[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height };
      } else if (format === 'VP8X' && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Validates the uploaded photo buffer against file size, magic bytes, client MIME, and dimensions.
 */
export function validatePhotoBuffer(
  buffer: Buffer,
  clientMimeType?: string
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Photo file buffer is empty or missing.' };
  }

  // 1. Size check (<= 5MB)
  if (buffer.length > MAX_PHOTO_SIZE) {
    return {
      valid: false,
      isTooLarge: true,
      size: buffer.length,
      error: `Photo file size exceeds the maximum allowed limit of 5 MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // 2. Client-provided MIME verification if present
  if (clientMimeType) {
    const normalizedClientMime = clientMimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(normalizedClientMime)) {
      return {
        valid: false,
        size: buffer.length,
        error: `Unsupported MIME type "${clientMimeType}". Allowed formats: image/jpeg, image/png, image/webp.`,
      };
    }
  }

  // 3. Genuine Magic Byte Signature detection
  const detectedMime = detectImageMimeType(buffer);
  if (!detectedMime) {
    return {
      valid: false,
      size: buffer.length,
      error: 'Invalid or corrupted image file. Signature does not match valid JPEG, PNG, or WebP magic bytes.',
    };
  }

  // 4. Verify dimensions if extractable
  const dimensions = extractImageDimensions(buffer, detectedMime);
  if (dimensions) {
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      return {
        valid: false,
        size: buffer.length,
        error: 'Corrupted image file: invalid image dimensions.',
      };
    }
    return {
      valid: true,
      mimeType: detectedMime,
      width: dimensions.width,
      height: dimensions.height,
      size: buffer.length,
    };
  }

  return {
    valid: true,
    mimeType: detectedMime,
    size: buffer.length,
  };
}

/**
 * Parses photo input from either multipart file or base64 string.
 */
export function parsePhotoInput(
  file?: Express.Multer.File,
  base64String?: string,
  explicitFileName?: string,
  explicitMimeType?: string
): { buffer: Buffer; fileName: string; mimeType: string } | null {
  if (file && file.buffer && file.buffer.length > 0) {
    return {
      buffer: file.buffer,
      fileName: file.originalname || explicitFileName || 'applicant_photo.jpg',
      mimeType: file.mimetype || explicitMimeType || 'image/jpeg',
    };
  }

  if (base64String && typeof base64String === 'string' && base64String.trim().length > 0) {
    let cleanBase64 = base64String.trim();
    let detectedMime = explicitMimeType || 'image/jpeg';

    const dataUrlMatch = cleanBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.*)$/);
    if (dataUrlMatch) {
      detectedMime = dataUrlMatch[1];
      cleanBase64 = dataUrlMatch[2];
    }

    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length > 0) {
        return {
          buffer,
          fileName: explicitFileName || 'applicant_photo.jpg',
          mimeType: detectedMime,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}
