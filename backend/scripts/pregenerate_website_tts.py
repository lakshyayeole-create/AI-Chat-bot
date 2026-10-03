"""Pregenerates and caches complete website narration audio from start to finish."""
import asyncio
import os
import shutil
import sys
from pathlib import Path

# Add backend to python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.core.logging_config import setup_logging, get_logger
from app.tts.elevenlabs_client import get_elevenlabs_client
from app.tts.cache import get_audio_cache, compute_cache_key, normalize_text_for_tts

logger = get_logger(__name__)

SECTIONS = [
    (
        "Introduction",
        "Welcome to Anantya 2026, the Annual National Technical Symposium organized by the "
        "Department of Computer Engineering at Pimpri Chinchwad College of Engineering, Pune. "
        "Step into the Multiverse of Technology, Innovation, and Interdisciplinary Excellence "
        "from October 6 to October 10, 2026."
    ),
    (
        "Events 1 to 4",
        "Here are the eight official events of Anantya 2026. "
        "Event 1: DecentraHack 2.0. A 3-round Web3, Blockchain, Agentic AI, and Open Source Hackathon presented by "
        "the LFDT Student Chapter. Teams of 2 to 4 members compete for a 15,000 rupee prize pool. "
        "Event 2: She Solves 3.0. The premier women-oriented hackathon organized by ACM-W PCCOE, empowering female "
        "developers to build impactful solutions with a 16,000 rupee prize pool. "
        "Event 3: BYTE ME CTF '26. A national-level Capture The Flag cybersecurity competition organized by OWASP PCCOE, "
        "featuring Web Security, OSINT, Cryptography, and Forensics with 1.5 Lakhs in prizes. "
        "Event 4: IoThrone 2026. Hardware and prototype innovation hackathon organized by IRIS PCCOE, integrating IoT, "
        "Edge AI, Computer Vision, and Robotics with a 15,000 rupee prize pool."
    ),
    (
        "Events 5 to 8",
        "Event 5: MasterChef UI. A 3-round UI/UX and frontend design competition organized by GDGC PCCOE, "
        "testing designers on rapid prototyping and user experience with a 12,000 rupee prize pool. "
        "Event 6: Make a Doodle 2026. A creative digital art and illustration challenge organized by the Computer "
        "Department Art Circle, celebrating artistic creativity with a 13,000 rupee prize pool. "
        "Event 7: Codigo 2026. An ICPC-style 3-round competitive programming contest organized by CESA-SDW and ACM PCCOE, "
        "testing algorithmic speed and DSA with an 18,000 rupee prize pool. "
        "Event 8: INNOVATE-X. The flagship B.Tech final-year capstone project presentation and system architecture showcase, "
        "organized by the Department of Computer Engineering across all student chapters. Round 1 online PPT evaluation "
        "on October 6, and Round 2 offline final presentation on October 10 with a 12,000 rupee prize pool. "
        "Participation is compulsory for all final-year students."
    ),
    (
        "Central Command & Closing",
        "Anantya Central Command is located at PCCOE Sector 26, Pradhikaran, Nigdi, Pune. Connect with student "
        "coordinators Divya Ughade, Aditi Joshi, and Srushti Argade, or transmit an encrypted message directly "
        "through our contact terminal. Anantya 2026 is brought to you by CESA, ACM, ACM-W, OWASP, GDGC, LFDT and IRIS at PCCOE. "
        "We look forward to welcoming you to the Multiverse of Technology!"
    ),
]


async def main():
    settings = get_settings()
    setup_logging("info")
    print("=" * 65)
    print("Anantya '26 — Complete Website TTS Audio Generator & Cache Primer")
    print("=" * 65)

    cache = get_audio_cache()
    client = get_elevenlabs_client()
    voice_id = settings.elevenlabs_voice_id
    model_id = settings.elevenlabs_model_id

    # 1. Delete all old cache files
    print("\n[1/4] Clearing existing cache...")
    deleted_count = cache.clear()
    print(f"  Deleted {deleted_count} cached audio files from {cache.cache_dir}")

    try:
        from app.rag.semantic_cache import clear_cache
        await clear_cache()
        print("  Reset semantic cache (MongoDB Atlas / JSON)")
    except Exception as e:
        print(f"  Note on semantic cache reset: {e}")

    # 2. Generate and cache speech for each section
    print(f"\n[2/4] Generating speech for {len(SECTIONS)} sections...")
    combined_mp3_bytes = bytearray()

    # Determine provider (test ElevenLabs quota for full script length)
    provider = "elevenlabs"
    try:
        # Check if ElevenLabs has enough quota for substantial generation
        test_audio = await client.generate_speech(
            text="Anantya 2026 By the Department of Computer Engineering PCCOE Pune",
            voice_id=voice_id,
            model_id=model_id,
        )
        # If test passes, also test if quota can handle large event section
        await client.generate_speech(
            text="Here are the eight official events of Anantya 2026. Testing quota capacity.",
            voice_id=voice_id,
            model_id=model_id,
        )
        print("  Using ElevenLabs Neural Voice (Voice ID: " + voice_id + ")")
    except Exception as e:
        provider = "edge-tts"
        print(f"  ElevenLabs quota depleted ({e}). Using Edge-TTS Neural Voice (en-US-ChristopherNeural) for uniform narration.")

    for i, (name, text) in enumerate(SECTIONS, start=1):
        print(f"\n  Generating [{i}/{len(SECTIONS)}]: {name} ({len(text)} chars)...")
        cache_key = compute_cache_key(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            output_format="mp3",
        )

        audio_bytes = None
        if provider == "elevenlabs":
            try:
                audio_bytes = await client.generate_speech(
                    text=normalize_text_for_tts(text),
                    voice_id=voice_id,
                    model_id=model_id,
                )
            except Exception as e:
                print(f"    ElevenLabs failed on section {i} ({e}). Switching to Edge-TTS neural engine...")
                provider = "edge-tts"

        if not audio_bytes or provider == "edge-tts":
            import edge_tts
            import io
            communicate = edge_tts.Communicate(normalize_text_for_tts(text), "en-US-ChristopherNeural")
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            audio_bytes = buf.getvalue()

        # Store individual chunk in cache
        cache.put(cache_key, audio_bytes)
        print(f"    Saved section chunk: {len(audio_bytes):,} bytes (key: {cache_key[:12]}...)")
        combined_mp3_bytes.extend(audio_bytes)
        await asyncio.sleep(0.3)

    # 3. Save combined full-website narration audio
    print("\n[3/4] Storing combined complete website narration in cache folder...")
    full_audio_path = cache.cache_dir / "full_website_read.mp3"
    full_audio_path.write_bytes(combined_mp3_bytes)
    print(f"  Successfully created: {full_audio_path.name}")
    print(f"  Total audio size: {len(combined_mp3_bytes):,} bytes (~{len(combined_mp3_bytes) / 1024 / 1024:.2f} MB)")

    # Mirror to frontend/public so it is also accessible statically and tracked in git
    frontend_public = backend_dir.parent / "frontend" / "public" / "full_website_read.mp3"
    frontend_public.write_bytes(combined_mp3_bytes)
    print(f"  Mirrored to frontend/public: {frontend_public.name}")

    # 4. Verification check
    print("\n[4/4] Verifying cache contents...")
    files = list(cache.cache_dir.glob("*.mp3"))
    print(f"  Files in {cache.cache_dir}:")
    for f in sorted(files, key=lambda x: x.name):
        print(f"    - {f.name} ({f.stat().st_size:,} bytes)")

    print("\n" + "=" * 65)
    print("SUCCESS: Full website audio generated and cached permanently!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
