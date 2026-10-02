#!/usr/bin/env python3
"""Idempotent static asset seed and synchronization script for Cloudinary.

Uploads frontend 3D models, textures, event logos, gallery images, and static
background audio to Cloudinary, generating a deterministic backend manifest at
`backend/data/assets.json`.

Storage Principle:
- Cloudinary = Static website assets ONLY (.glb, .webp, .png, .jpg, static .mpeg)
- Backend = Dynamically generated TTS audio cache (NEVER uploaded here)
- MongoDB = Chat logs, contact queries, visitor counters (NEVER stored here)
"""
import os
import sys
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

# Ensure backend root is on Python path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import cloudinary
import cloudinary.uploader
from app.core.config import get_settings

# Supported extensions by category
EXT_MODELS = {".glb", ".gltf"}
EXT_IMAGES = {".webp", ".png", ".jpg", ".jpeg", ".svg"}
EXT_AUDIO = {".mpeg", ".mp3", ".wav"}


def compute_file_sha256(filepath: Path) -> str:
    """Calculate deterministic SHA-256 hash of a local file."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def get_asset_category_and_resource_type(filepath: Path) -> Tuple[Optional[str], Optional[str]]:
    """Determine category (models/images/audio) and Cloudinary resource_type."""
    ext = filepath.suffix.lower()
    if ext in EXT_MODELS:
        # GLTF/GLB models must use resource_type='raw' to preserve binary geometry
        return "models", "raw"
    elif ext in EXT_IMAGES:
        return "images", "image"
    elif ext in EXT_AUDIO:
        # Cloudinary handles audio files under the 'video' resource type
        return "audio", "video"
    return None, None


def generate_public_id(base_dir: Path, filepath: Path, category: str, resource_type: str) -> str:
    """Generate a clean, deterministic Cloudinary public ID reflecting local asset hierarchy."""
    rel = filepath.relative_to(base_dir)
    parent_parts = [p for p in rel.parent.parts if p not in (".", "")]
    prefix = "anantya2026"

    # For raw models, preserving .glb in public_id ensures the delivered Cloudinary URL ends in .glb
    if resource_type == "raw":
        filename = filepath.name
        if parent_parts:
            subfolder = "/".join(parent_parts)
            return f"{prefix}/{category}/{subfolder}/{filename}".replace("\\", "/")
        return f"{prefix}/{category}/{filename}".replace("\\", "/")

    # For images and audio, include clean stem and format if differentiating
    stem = filepath.stem
    ext_tag = filepath.suffix.lstrip(".").lower()
    clean_name = f"{stem}_{ext_tag}"

    if parent_parts:
        subfolder = "/".join(parent_parts)
        return f"{prefix}/{category}/{subfolder}/{clean_name}".replace("\\", "/")
    return f"{prefix}/{category}/{clean_name}".replace("\\", "/")


def build_manifest_keys(category: str, filepath: Path, base_dir: Path) -> list[str]:
    """Build unique and alias keys inside the category dictionary."""
    rel = filepath.relative_to(base_dir)
    clean_stem = filepath.stem.lower().replace(" ", "_").replace("-", "_")
    ext = filepath.suffix.lstrip(".").lower()
    parent_parts = [p.lower().replace("-", "_") for p in rel.parent.parts if p not in (".", "")]

    keys = []
    # 1. Exact relative path with extension (e.g. "assets/iron_man_hud_bg.webp" or "logos/codigo.webp")
    keys.append(str(rel).replace("\\", "/"))
    # Also relative path starting with slash (e.g. "/assets/iron_man_hud_bg.webp")
    keys.append("/" + str(rel).replace("\\", "/"))

    # 2. Key with category prefix and extension (e.g. "assets_iron_man_hud_bg_webp")
    if parent_parts:
        full_key = f"{'_'.join(parent_parts)}_{clean_stem}_{ext}"
        keys.append(full_key)
        # Without ext if unique
        keys.append(f"{'_'.join(parent_parts)}_{clean_stem}")
    else:
        keys.append(f"{clean_stem}_{ext}")
        keys.append(clean_stem)

    # 3. Filename key (e.g. "iron_man_detailed_web.glb", "codigo.webp")
    keys.append(filepath.name)
    keys.append(clean_stem)

    return list(dict.fromkeys(keys))


def seed_assets(dry_run: bool = False, force: bool = False) -> Dict[str, Any]:
    """Scan frontend assets, upload new/modified files, and update manifest."""
    settings = get_settings()

    if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        print("[ERROR] Cloudinary credentials missing in .env! Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.")
        sys.exit(1)

    # Configure Cloudinary SDK
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )

    repo_root = BACKEND_ROOT.parent
    frontend_public = repo_root / "frontend" / "public"
    frontend_assets = repo_root / "frontend" / "assets"
    manifest_path = settings.resolved_assets_manifest_path
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("ANANTYA 2026 — CLOUDINARY STATIC ASSET SEED & SYNC")
    print("=" * 70)
    print(f"Cloudinary Cloud: {settings.cloudinary_cloud_name}")
    print(f"Frontend Public:  {frontend_public}")
    print(f"Manifest Path:    {manifest_path}")
    print("=" * 70)

    # 1. Load existing manifest for idempotency checks
    existing_manifest: Dict[str, Any] = {
        "version": 1,
        "generated_at": None,
        "models": {},
        "images": {},
        "audio": {},
    }
    if manifest_path.is_file() and not force:
        try:
            existing_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            print(f"[INFO] Loaded existing manifest with {len(existing_manifest.get('models', {}))} models, {len(existing_manifest.get('images', {}))} images, {len(existing_manifest.get('audio', {}))} audio.")
        except Exception as e:
            print(f"[WARN] Could not parse existing manifest: {e}. Starting fresh.")

    # Prepare updated manifest copies
    new_manifest = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "models": dict(existing_manifest.get("models", {})),
        "images": dict(existing_manifest.get("images", {})),
        "audio": dict(existing_manifest.get("audio", {})),
    }

    # 2. Gather files to process
    scan_targets = []
    if frontend_public.is_dir():
        for path in sorted(frontend_public.rglob("*")):
            if path.is_file():
                scan_targets.append((frontend_public, path))

    # Also scan frontend/assets for any fallback files not in public
    if frontend_assets.is_dir():
        for path in sorted(frontend_assets.rglob("*")):
            if path.is_file():
                matching_public = frontend_public / "assets" / path.name
                if not matching_public.is_file():
                    scan_targets.append((frontend_assets, path))

    summary = {"new": 0, "updated": 0, "skipped": 0, "failed": 0}

    print(f"\nScanning {len(scan_targets)} local asset files...\n")

    for base_dir, filepath in scan_targets:
        category, resource_type = get_asset_category_and_resource_type(filepath)
        if not category:
            continue

        rel_path = filepath.relative_to(base_dir)
        file_sha256 = compute_file_sha256(filepath)
        file_bytes = filepath.stat().st_size
        public_id = generate_public_id(base_dir, filepath, category, resource_type)
        primary_key = "/" + str(rel_path).replace("\\", "/")
        alias_keys = build_manifest_keys(category, filepath, base_dir)

        category_dict = new_manifest[category]
        existing_entry = category_dict.get(primary_key)

        # IDEMPOTENCY CHECK:
        if (
            not force
            and existing_entry
            and existing_entry.get("sha256") == file_sha256
            and existing_entry.get("public_id") == public_id
            and existing_entry.get("secure_url")
        ):
            print(f"  [SKIP]    {category.upper():<6} {rel_path} (unchanged)")
            summary["skipped"] += 1
            # Ensure alias keys are present
            for k in alias_keys:
                category_dict[k] = existing_entry
            continue

        is_update = existing_entry is not None
        status_label = "[UPDATED]" if is_update else "[NEW]    "
        print(f"  {status_label} {category.upper():<6} {rel_path} ({file_bytes / 1024:.1f} KB)")

        if dry_run:
            print(f"            [DRY RUN] Would upload to public_id '{public_id}' ({resource_type})")
            continue

        try:
            print(f"            Uploading to Cloudinary as '{public_id}' ({resource_type})...")
            upload_options = {
                "public_id": public_id,
                "resource_type": resource_type,
                "overwrite": True,
                "invalidate": True,
                "unique_filename": False,
                "use_filename": False,
            }

            upload_result = cloudinary.uploader.upload(str(filepath), **upload_options)

            secure_url = upload_result.get("secure_url")
            raw_url = upload_result.get("url")

            entry_data = {
                "name": filepath.stem,
                "filename": filepath.name,
                "category": category,
                "local_path": "/" + str(rel_path).replace("\\", "/"),
                "public_id": upload_result.get("public_id", public_id),
                "url": raw_url,
                "secure_url": secure_url,
                "resource_type": resource_type,
                "format": upload_result.get("format", filepath.suffix.lstrip(".")),
                "bytes": file_bytes,
                "sha256": file_sha256,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }

            # Map primary key and all aliases to this entry
            for k in alias_keys:
                category_dict[k] = entry_data

            if is_update:
                summary["updated"] += 1
            else:
                summary["new"] += 1

            print(f"            -> Success: {secure_url}")

        except Exception as e:
            print(f"            [ERROR] Failed to upload {rel_path}: {e}")
            summary["failed"] += 1

    # 3. Save updated manifest
    if not dry_run:
        manifest_path.write_text(json.dumps(new_manifest, indent=2), encoding="utf-8")
        print(f"\n[OK] Saved manifest to {manifest_path}")

        # Also write a copy to frontend/src/data/assets.json so frontend can bundle/fallback instantly
        frontend_manifest_path = repo_root / "frontend" / "src" / "data" / "assets.json"
        try:
            frontend_manifest_path.parent.mkdir(parents=True, exist_ok=True)
            frontend_manifest_path.write_text(json.dumps(new_manifest, indent=2), encoding="utf-8")
            print(f"[OK] Synced build-time copy to {frontend_manifest_path}")
        except Exception as e:
            print(f"[WARN] Could not copy manifest to frontend: {e}")

    print("\n" + "=" * 70)
    print("SEED SUMMARY:")
    print(f"  New:     {summary['new']}")
    print(f"  Updated: {summary['updated']}")
    print(f"  Skipped: {summary['skipped']}")
    print(f"  Failed:  {summary['failed']}")
    print("=" * 70 + "\n")

    return summary


if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    is_force = "--force" in sys.argv
    seed_assets(dry_run=is_dry, force=is_force)
