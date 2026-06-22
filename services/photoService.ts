import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template/core';

const BUCKET = 'job-photos';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

type UploadResult = { path: string | null; error: string | null; cancelled?: boolean };

/**
 * Let the user take or pick a photo and upload it to the private job-photos
 * bucket at {userId}/{jobId}/{timestamp}.{ext}. Returns the storage path.
 */
export async function pickAndUploadJobPhoto(
  userId: string,
  jobId: string,
  source: 'camera' | 'library',
): Promise<UploadResult> {
  // Permissions
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { path: null, error: 'Camera permission is needed to take a photo.' };
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { path: null, error: 'Photo library permission is needed.' };
  }

  const result = await (source === 'camera'
    ? ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
    : ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true }));

  if (result.canceled || !result.assets?.[0]) return { path: null, error: null, cancelled: true };

  const asset = result.assets[0];
  if (!asset.base64) return { path: null, error: 'Could not read the selected image.' };

  const isPng = (asset.mimeType || '').includes('png');
  const ext = isPng ? 'png' : 'jpg';
  const path = `${userId}/${jobId}/${Date.now()}.${ext}`;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(asset.base64), {
    contentType: isPng ? 'image/png' : 'image/jpeg',
    upsert: false,
  });
  if (error) return { path: null, error: error.message };

  return { path, error: null };
}

/** Resolve a private storage path to a temporary signed URL for display. */
export async function getJobPhotoUrl(path: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Resolve many paths to signed URLs, preserving order; failed ones become null. */
export async function getJobPhotoUrls(paths: string[]): Promise<(string | null)[]> {
  return Promise.all(paths.map(getJobPhotoUrl));
}

/** Permanently delete a photo object from storage. */
export async function deleteJobPhoto(path: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return !error;
}
