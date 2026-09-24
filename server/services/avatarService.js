const sharp = require('sharp');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const supabase = createClient(supabaseUrl, supabaseKey);
const AVATAR_BUCKET = 'avatars';
const DEFAULT_AVATAR_URL = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';

/**
 * Validates image binary magic bytes.
 * Strictly permits JPEG, PNG, and WebP.
 * Strictly rejects SVG, HTML, JS, Executables, and arbitrary binaries.
 */
function validateAvatarMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, error: 'Empty or corrupt image buffer.' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // 3. WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  return { 
    valid: false, 
    error: 'Unsupported image format. Only JPG, PNG, and WebP images are permitted for profile pictures.' 
  };
}

/**
 * Strips EXIF/GPS/device metadata, normalizes rotation, resizes to 512x512 avatar square,
 * and compresses into modern WebP format.
 */
async function processAvatar(buffer) {
  try {
    const pipeline = sharp(buffer)
      .rotate() // Auto-orient based on EXIF before stripping
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .webp({
        quality: 85,
        effort: 4
      });

    const optimizedBuffer = await pipeline.toBuffer();
    return {
      success: true,
      buffer: optimizedBuffer,
      mime: 'image/webp',
      ext: 'webp',
      size: optimizedBuffer.length
    };
  } catch (err) {
    console.error('[Avatar Sharp Processing Error]:', err.message);
    throw new Error('Image could not be processed. Please upload a valid JPG, PNG, or WebP image.');
  }
}

/**
 * Uploads processed avatar buffer to Supabase Storage under user-specific isolated folder.
 * File path format: {userId}/{timestamp}_{uuid}.webp
 */
async function uploadAvatarToStorage(userId, buffer) {
  if (!userId) throw new Error('User ID is required for avatar storage.');

  const uniqueSuffix = `${Date.now()}_${crypto.randomUUID()}`;
  const storagePath = `${userId}/${uniqueSuffix}.webp`;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '3600'
    });

  if (error) {
    console.error('[Supabase Avatar Upload Error]:', error);
    throw new Error('Failed to save profile picture to cloud storage. Please try again.');
  }

  const { data: pubData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: pubData.publicUrl,
    storagePath
  };
}

/**
 * Extracts storage path from an avatar public URL and removes it from Supabase Storage.
 * Verifies that the path belongs to the given userId (or admin action) to prevent unauthorized file deletion.
 */
async function deleteAvatarFromStorage(avatarUrl, userId = null) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return;
  if (!avatarUrl.includes(AVATAR_BUCKET)) return; // Not stored in our avatars bucket (e.g. Unsplash fallback)

  try {
    // Extract path after /avatars/
    const parts = avatarUrl.split(`/${AVATAR_BUCKET}/`);
    if (parts.length < 2) return;

    const rawPath = parts[1].split('?')[0]; // Strip query parameters if any
    const decodedPath = decodeURIComponent(rawPath);

    // If userId provided, enforce that path starts with {userId}/
    if (userId && !decodedPath.startsWith(`${userId}/`)) {
      console.warn(`[Security Warning]: Attempted deletion of avatar outside user scope: ${decodedPath} by ${userId}`);
      return;
    }

    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([decodedPath]);

    if (error) {
      console.warn('[Avatar Cleanup Warning]: Could not remove old avatar:', error.message);
    }
  } catch (err) {
    console.warn('[Avatar Deletion Catch]:', err.message);
  }
}

module.exports = {
  AVATAR_BUCKET,
  DEFAULT_AVATAR_URL,
  validateAvatarMagicBytes,
  processAvatar,
  uploadAvatarToStorage,
  deleteAvatarFromStorage
};
