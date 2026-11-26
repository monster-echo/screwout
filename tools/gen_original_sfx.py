#!/usr/bin/env python3
"""
Synthesize 17 original ASMR mechanical & casual UI sound effects for ScrewOut.
100% original procedural audio (zero third-party samples).
"""

import math
import os
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

AUDIO_DIR = Path("/Users/echo/workspace/CocosGames/ScrewOut/assets/resources/audio")
SR = 44100


def write_mp3(samples, out_mp3: Path):
    """Write float samples [-1, 1] to MP3 via ffmpeg (or fallback WAV)."""
    pcm = bytearray()
    for s in samples:
        v = max(-1.0, min(1.0, s))
        pcm += struct.pack("<h", int(v * 32767))
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav_path = tf.name
    try:
        with wave.open(wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            wf.writeframes(pcm)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-b:a", "128k", str(out_mp3)],
            check=True,
        )
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def env_exp(t, tau):
    return math.exp(-t / max(1e-5, tau))


def synth_tone(dur, fn):
    n = int(SR * dur)
    return [fn(i / SR) for i in range(n)]


def gen_screw_out():
    # Crisp ASMR metallic ratchet click + ascending zip
    def fn(t):
        f = 520 + 1800 * (t / 0.16)
        click = (random.uniform(-1, 1) * env_exp(t, 0.008)) * 0.45
        ratchet = math.sin(2 * math.pi * f * t) * env_exp(t, 0.055) * 0.55
        overtone = math.sin(2 * math.pi * (f * 2.1) * t) * env_exp(t, 0.03) * 0.25
        return (click + ratchet + overtone) * 0.85
    return synth_tone(0.18, fn)


def gen_screw_in():
    # Satisfying metallic pop + snug lock thunk
    def fn(t):
        f = 920 * math.exp(-t * 8) + 260
        pop = math.sin(2 * math.pi * f * t) * env_exp(t, 0.045) * 0.65
        chime = math.sin(2 * math.pi * 1320 * t) * env_exp(t, 0.04) * 0.25
        return (pop + chime) * 0.85
    return synth_tone(0.16, fn)


def gen_click():
    def fn(t):
        f = 680 + 420 * math.exp(-t * 45)
        return math.sin(2 * math.pi * f * t) * env_exp(t, 0.025) * 0.65
    return synth_tone(0.09, fn)


def gen_click_error():
    # Soft double dull knock
    def fn(t):
        s = 0.0
        for onset in (0.0, 0.08):
            if t >= onset:
                dt = t - onset
                s += math.sin(2 * math.pi * 195 * dt) * env_exp(dt, 0.028) * 0.6
        return s
    return synth_tone(0.20, fn)


def gen_screw_empty():
    def fn(t):
        return math.sin(2 * math.pi * 240 * t) * env_exp(t, 0.04) * 0.55
    return synth_tone(0.14, fn)


def gen_box_full():
    # Cheerful 3-note ascending chime + lid snap
    notes = [(0.0, 523.25), (0.07, 659.25), (0.14, 783.99), (0.21, 1046.5)]
    def fn(t):
        s = 0.0
        for onset, freq in notes:
            if t >= onset:
                dt = t - onset
                s += (math.sin(2 * math.pi * freq * dt) + 0.3 * math.sin(4 * math.pi * freq * dt)) * env_exp(dt, 0.14) * 0.35
        return s
    return synth_tone(0.55, fn)


def gen_get_gold():
    # Sparkling metallic coin/star chime
    notes = [(0.0, 1318.5), (0.06, 1760.0)]
    def fn(t):
        s = 0.0
        for onset, freq in notes:
            if t >= onset:
                dt = t - onset
                s += math.sin(2 * math.pi * freq * dt) * env_exp(dt, 0.11) * 0.45
        return s
    return synth_tone(0.35, fn)


def gen_win():
    # Bright victory fanfare arpeggio
    notes = [(0.0, 523.25), (0.09, 659.25), (0.18, 783.99), (0.28, 1046.5), (0.42, 1318.5)]
    def fn(t):
        s = 0.0
        for onset, freq in notes:
            if t >= onset:
                dt = t - onset
                s += (math.sin(2 * math.pi * freq * dt) + 0.25 * math.sin(6 * math.pi * freq * dt)) * env_exp(dt, 0.28) * 0.30
        return s
    return synth_tone(1.05, fn)


def gen_lose():
    # Gentle descending 3-note sigh
    notes = [(0.0, 440.0), (0.18, 392.0), (0.36, 329.63)]
    def fn(t):
        s = 0.0
        for onset, freq in notes:
            if t >= onset:
                dt = t - onset
                s += math.sin(2 * math.pi * freq * dt) * env_exp(dt, 0.18) * 0.42
        return s
    return synth_tone(0.85, fn)


def gen_skill_unlock():
    notes = [(0.0, 587.33), (0.07, 880.0), (0.14, 1174.66)]
    def fn(t):
        s = 0.0
        for onset, freq in notes:
            if t >= onset:
                dt = t - onset
                s += math.sin(2 * math.pi * freq * dt) * env_exp(dt, 0.12) * 0.40
        return s
    return synth_tone(0.45, fn)


def gen_skill_clear():
    # Airy sweep whoosh + sparkle
    def fn(t):
        noise = random.uniform(-1, 1) * math.sin(math.pi * min(1.0, t / 0.32)) * 0.28
        sweep = math.sin(2 * math.pi * (400 + 1200 * t) * t) * env_exp(t, 0.12) * 0.45
        return noise + sweep
    return synth_tone(0.35, fn)


def gen_skill_remove():
    # Crisp glass shatter / melt sparkle
    def fn(t):
        crack = random.uniform(-1, 1) * env_exp(t, 0.04) * 0.45
        ring = (math.sin(2 * math.pi * 1650 * t) + math.sin(2 * math.pi * 2210 * t)) * env_exp(t, 0.09) * 0.25
        return crack + ring
    return synth_tone(0.30, fn)


def main():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    clips = {
        "screw_out.mp3": gen_screw_out(),
        "screw_in.mp3": gen_screw_in(),
        "game_click.mp3": gen_click(),
        "clickerror2.mp3": gen_click_error(),
        "screw_empty.mp3": gen_screw_empty(),
        "box_full.mp3": gen_box_full(),
        "get_gold.mp3": gen_get_gold(),
        "game_win.mp3": gen_win(),
        "game_lose.mp3": gen_lose(),
        "skill_unlock.mp3": gen_skill_unlock(),
        "skill_clear.mp3": gen_skill_clear(),
        "skill_remove.mp3": gen_skill_remove(),
        "block_remove.mp3": gen_skill_remove(),
        "MatchItem.mp3": gen_get_gold(),
        "paint_finish.mp3": gen_box_full(),
        "reloading.mp3": gen_screw_in(),
        "game_timer.mp3": gen_click(),
    }
    for fname, samples in clips.items():
        write_mp3(samples, AUDIO_DIR / fname)
    print(f"Synthesized {len(clips)} original ASMR/UI MP3 clips in {AUDIO_DIR}")


if __name__ == "__main__":
    main()
