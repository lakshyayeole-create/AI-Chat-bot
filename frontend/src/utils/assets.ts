/**
 * Asset Manager Module
 * Dynamically resolves Cloudinary URLs for static 3D models, textures, event logos,
 * and audio from the backend `/api/assets` manifest, with zero-downtime local fallbacks.
 */

import defaultManifest from '../data/assets.json';

export interface AssetEntry {
  name: string;
  filename: string;
  category: 'models' | 'images' | 'audio';
  local_path: string;
  public_id: string;
  url: string;
  secure_url: string;
  resource_type: string;
  format: string;
  bytes: number;
  sha256: string;
}

export interface AssetManifest {
  version: number;
  generated_at?: string;
  models: Record<string, AssetEntry>;
  images: Record<string, AssetEntry>;
  audio: Record<string, AssetEntry>;
}

const BACKEND_BASE = (typeof window !== 'undefined' && (window as any).__BACKEND_URL__) || 'http://localhost:8001';

// In-memory registry pre-populated with Cloudinary URLs from bundled manifest
let manifest: AssetManifest = (defaultManifest as unknown as AssetManifest) || {
  version: 1,
  models: {},
  images: {},
  audio: {},
};


let isLoaded = false;
let loadPromise: Promise<AssetManifest> | null = null;

// Clean search key helper
function normalizeKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/\\/g, '/');
}

/**
 * Initializes and fetches the latest static asset manifest from the backend.
 * Can be called at application startup or on-demand.
 */
export async function initAssets(): Promise<AssetManifest> {
  if (isLoaded) return manifest;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Fetch latest live Cloudinary URLs from backend
      const res = await fetch(`${BACKEND_BASE}/api/assets`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });


      if (res.ok) {
        const liveManifest = await res.json();
        if (liveManifest && (liveManifest.models || liveManifest.images)) {
          manifest = liveManifest as AssetManifest;
          isLoaded = true;
          return manifest;
        }
      }
    } catch (err) {
      console.warn('[Assets] Could not retrieve live assets manifest from backend, using fallbacks.', err);
    }

    isLoaded = true;
    return manifest;
  })();

  return loadPromise;
}

/**
 * Resolve an asset URL from Cloudinary by key, path, or filename.
 * If not yet loaded or not present in manifest, returns fallback or raw path.
 */
export function getAssetUrl(
  category: 'models' | 'images' | 'audio',
  keyOrPath: string,
  fallback?: string
): string {
  const norm = normalizeKey(keyOrPath);
  const catDict = manifest[category] || {};

  // Check direct normalized key or original key
  if (catDict[keyOrPath]?.secure_url) {
    return catDict[keyOrPath].secure_url;
  }
  if (catDict[norm]?.secure_url) {
    return catDict[norm].secure_url;
  }

  // Check with leading slash or without leading slash
  const withSlash = norm.startsWith('/') ? norm : `/${norm}`;
  const withoutSlash = norm.startsWith('/') ? norm.slice(1) : norm;

  if (catDict[withSlash]?.secure_url) {
    return catDict[withSlash].secure_url;
  }
  if (catDict[withoutSlash]?.secure_url) {
    return catDict[withoutSlash].secure_url;
  }

  // Check stem/filename match
  const filename = norm.split('/').pop() || norm;
  if (catDict[filename]?.secure_url) {
    return catDict[filename].secure_url;
  }

  const stem = filename.split('.')[0];
  if (catDict[stem]?.secure_url) {
    return catDict[stem].secure_url;
  }

  return fallback || keyOrPath;
}

/**
 * Dedicated helpers for models, images, and audio
 */
export function getModelUrl(nameOrPath: string, fallback?: string): string {
  return getAssetUrl('models', nameOrPath, fallback);
}

export function getImageUrl(nameOrPath: string, fallback?: string): string {
  return getAssetUrl('images', nameOrPath, fallback);
}

export function getAudioUrl(nameOrPath: string, fallback?: string): string {
  return getAssetUrl('audio', nameOrPath, fallback);
}

// Auto-trigger manifest prefetch on client load
if (typeof window !== 'undefined') {
  initAssets().catch(() => {});
}

export default {
  initAssets,
  getAssetUrl,
  getModelUrl,
  getImageUrl,
  getAudioUrl,
};
