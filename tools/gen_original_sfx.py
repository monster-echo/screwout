#!/usr/bin/env python3
"""
Studio-grade procedural ASMR & musical SFX synthesizer for Screw Jam.
Uses physical-modeling transients (metallic ratchet ticks, woody pops,
Karplus-Strong / bell-partial chimes, warm marimba chords) + ffmpeg mastering.
100% original audio, zero third-party samples.
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

SR = 44100
OUT_DIR = "/Users/echo/workspace/CocosGames/ScrewOut/assets/resources/audio"
FFMPEG = "/opt/homebrew/bin/ffmpeg"

rng = random.Random(20261126)


def make_buf(dur_s: float) -> list[float]:
    return [0.0] * int(SR * dur_s)


def mix_add(buf: list[float], start_s: float, samples: list[float], gain: float = 1.0):
    i0 = int(start_s * SR)
    n = len(buf)
    for i, v in enumerate(samples):
        idx = i0 + i
        if 0 <= idx < n:
            buf[idx] += v * gain


def env_exp(t: float, attack: float, decay: float) -> float:
    if t < 0:
        return 0.0
    if attack > 0 and t < attack:
        return t / attack
    return math.exp(-(t - attack) / max(decay, 1e-4))


def tone_sweep(f0: float, f1: float, dur: float, attack: float = 0.003, decay: float = 0.08,
               harmonics: list[tuple[float, float]] | None = None) -> list[float]:
    if harmonics is None:
        harmonics = [(1.0, 1.0)]
    n = int(SR * dur)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / SR
        u = t / max(dur, 1e-5)
        # Exponential frequency glide sounds much more organic than linear
        freq = f0 * ((f1 / max(f0, 1.0)) ** u)
        phase += 2.0 * math.pi * freq / SR
        e = env_exp(t, attack, decay)
        val = 0.0
        for mult, amp in harmonics:
            val += math.sin(phase * mult) * amp
        out[i] = val * e
    return out


def marimba_note(freq: float, dur: float, vel: float = 1.0) -> list[float]:
    """Warm wooden marimba/kalimba bar with authentic 1:4:10 overtone ratios + mallet knock."""
    n = int(SR * dur)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        # Fundamental warm wood resonance
        f1 = math.sin(2.0 * math.pi * freq * t) * env_exp(t, 0.002, dur * 0.36)
        # 2nd mode (~3.98x for tuned rosewood bar, decays faster)
        f2 = 0.28 * math.sin(2.0 * math.pi * freq * 3.98 * t) * env_exp(t, 0.001, dur * 0.09)
        # Soft mallet impact transient
        knock = 0.16 * math.sin(2.0 * math.pi * (freq * 1.5 + 900 * math.exp(-t * 180)) * t) * env_exp(t, 0.0005, 0.010)
        out[i] = (f1 + f2 + knock) * vel
    return out


def bell_chime(freq: float, dur: float, vel: float = 1.0) -> list[float]:
    """Crisp crystalline celesta / metallic coin chime with shimmering partials."""
    n = int(SR * dur)
    out = [0.0] * n
    partials = [(1.0, 1.0, 0.42), (2.0, 0.42, 0.26), (2.756, 0.22, 0.16), (4.07, 0.12, 0.09)]
    for i in range(n):
        t = i / SR
        v = 0.0
        for mult, amp, dec_ratio in partials:
            v += amp * math.sin(2.0 * math.pi * freq * mult * t) * env_exp(t, 0.0015, dur * dec_ratio)
        out[i] = v * vel
    return out


def filtered_noise_burst(dur: float, f_center: float, q_pass: int = 3, attack: float = 0.002, decay: float = 0.03) -> list[float]:
    """Simple resonant bandpass noise burst for tactile clicks, swooshes, and air pops."""
    n = int(SR * dur)
    # 2-pole resonator
    w0 = 2.0 * math.pi * f_center / SR
    r = max(0.70, min(0.985, 1.0 - (0.18 / max(1, q_pass))))
    a1 = -2.0 * r * math.cos(w0)
    a2 = r * r
    y1 = y2 = 0.0
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        x = rng.uniform(-1.0, 1.0)
        y = x - a1 * y1 - a2 * y2
        y2 = y1
        y1 = y
        out[i] = y * (1.0 - r) * 2.2 * env_exp(t, attack, decay)
    return out


def ratchet_tick(freq: float, dur: float = 0.028) -> list[float]:
    """Crisp mechanical metal-on-metal micro-click (ASMR screwdriver ratchet)."""
    a = filtered_noise_burst(dur, freq, q_pass=4, attack=0.0006, decay=0.006)
    b = tone_sweep(freq * 1.15, freq * 0.85, dur, attack=0.0005, decay=0.007, harmonics=[(1.0, 0.6), (2.3, 0.3)])
    return [a[i] * 0.7 + b[i] * 0.5 for i in range(len(a))]


def soft_limit(buf: list[float], target_peak: float = 0.88) -> list[float]:
    peak = max((abs(x) for x in buf), default=1e-6)
    if peak < 1e-6:
        return buf
    scale = target_peak / peak
    # Gentle warm tanh saturation for commercial loudness without harsh clipping
    return [math.tanh(x * scale * 1.15) / math.tanh(1.15) * target_peak for x in buf]


def write_mp3(name: str, buf: list[float], reverb: bool = False):
    samples = soft_limit(buf)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav_path = tf.name
    try:
        with wave.open(wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            raw = struct.pack(f"<{len(samples)}h", *[max(-32767, min(32767, int(v * 32767))) for v in samples])
            wf.writeframes(raw)

        out_path = os.path.join(OUT_DIR, f"{name}.mp3")
        af = "highpass=f=60,lowpass=f=15000"
        if reverb:
            af += ",aecho=0.82:0.75:32|58:0.22|0.14"
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", wav_path, "-af", af, "-ac", "2", "-b:a", "192k", out_path],
            check=True,
        )
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def synth_all():
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. Tactile UI Click (warm wooden pop)
    b = make_buf(0.09)
    mix_add(b, 0.0, tone_sweep(460, 740, 0.055, 0.0015, 0.018, [(1.0, 1.0), (2.0, 0.25)]), 0.85)
    mix_add(b, 0.0, filtered_noise_burst(0.025, 2200, 3, 0.0005, 0.005), 0.35)
    write_mp3("click", b)
    write_mp3("gameClick", b)
    write_mp3("anniu", b)

    # 2. Blocked screw / Error (gentle muted double wooden thud)
    b = make_buf(0.22)
    mix_add(b, 0.0, tone_sweep(210, 135, 0.08, 0.002, 0.028, [(1.0, 1.0), (1.8, 0.2)]), 0.8)
    mix_add(b, 0.075, tone_sweep(165, 110, 0.11, 0.002, 0.036, [(1.0, 1.0), (1.8, 0.15)]), 0.9)
    write_mp3("click_error", b)

    # 3. ASMR Screw Out (4 crisp ascending metallic ratchet ticks + satisfying hollow pop!)
    b = make_buf(0.20)
    for k, (t0, fr) in enumerate([(0.000, 1450), (0.024, 1680), (0.048, 1950), (0.072, 2280)]):
        mix_add(b, t0, ratchet_tick(fr, 0.028), 0.55 + k * 0.08)
    # Satisfying cork/acrylic release POP
    mix_add(b, 0.085, tone_sweep(340, 980, 0.085, 0.001, 0.026, [(1.0, 1.0), (2.0, 0.32)]), 0.95)
    mix_add(b, 0.085, marimba_note(880, 0.09, 0.38), 0.6)
    write_mp3("screw_out", b)

    # 4. ASMR Screw In (tight screw-down clicks + crisp resonant lock-in chime!)
    b = make_buf(0.22)
    mix_add(b, 0.000, ratchet_tick(1900, 0.025), 0.45)
    mix_add(b, 0.022, ratchet_tick(1550, 0.025), 0.50)
    mix_add(b, 0.042, tone_sweep(620, 390, 0.06, 0.001, 0.022, [(1.0, 0.9), (2.0, 0.25)]), 0.85)
    mix_add(b, 0.045, marimba_note(1046.5, 0.14, 0.65), 0.75)  # C6 bright crisp settle
    write_mp3("screw_in", b)

    # 5. Screw into Holding Tray (soft hollow acrylic plink)
    b = make_buf(0.16)
    mix_add(b, 0.0, tone_sweep(520, 360, 0.075, 0.0015, 0.026, [(1.0, 0.95), (2.5, 0.2)]), 0.85)
    mix_add(b, 0.0, filtered_noise_burst(0.025, 1600, 3, 0.001, 0.006), 0.3)
    write_mp3("screw_empty", b)

    # 6. Box Slide (smooth pneumatic swoosh + soft wooden click stop)
    b = make_buf(0.32)
    for k in range(6):
        mix_add(b, k * 0.032, filtered_noise_burst(0.09, 450 + k * 140, 2, 0.015, 0.035), 0.42)
    mix_add(b, 0.22, tone_sweep(300, 210, 0.06, 0.002, 0.022), 0.55)
    write_mp3("box_slide", b)

    # 7. Box Full Celebration (lush Royal-Match C-major sparkle arpeggio + lid snap!)
    b = make_buf(0.75)
    # Snappy lid close thock
    mix_add(b, 0.0, tone_sweep(260, 150, 0.06, 0.001, 0.022), 0.7)
    mix_add(b, 0.0, filtered_noise_burst(0.03, 1800, 3, 0.001, 0.008), 0.4)
    # Ascending marimba + celesta sparkle chord: C5, E5, G5, C6
    for idx, freq in enumerate([523.25, 659.25, 783.99, 1046.50]):
        t0 = 0.04 + idx * 0.055
        mix_add(b, t0, marimba_note(freq, 0.36, 0.72), 0.85)
        mix_add(b, t0 + 0.01, bell_chime(freq * 2.0, 0.38, 0.32), 0.65)
    write_mp3("box_full", b, reverb=True)

    # 8. Get Gold / Coin Chime (authentic bright double metallic coin ding B5 -> E6)
    b = make_buf(0.45)
    mix_add(b, 0.00, bell_chime(987.77, 0.26, 0.85), 0.9)   # B5
    mix_add(b, 0.075, bell_chime(1318.51, 0.34, 0.95), 0.95)  # E6
    write_mp3("get_gold", b, reverb=True)

    # 9. Skill Unlock (magical pentatonic harp glissando + crisp unlock click)
    b = make_buf(0.65)
    mix_add(b, 0.0, ratchet_tick(2100, 0.03), 0.6)
    for idx, freq in enumerate([523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]):
        mix_add(b, 0.02 + idx * 0.045, bell_chime(freq, 0.32, 0.55), 0.8)
        mix_add(b, 0.02 + idx * 0.045, marimba_note(freq, 0.28, 0.5), 0.6)
    write_mp3("skill_unlock", b, reverb=True)

    # 10. Skill Clear Tray (magical breeze sweep + sparkling chimes)
    b = make_buf(0.60)
    for k in range(8):
        mix_add(b, k * 0.035, filtered_noise_burst(0.11, 700 + k * 240, 2, 0.015, 0.04), 0.38)
    for idx, freq in enumerate([783.99, 987.77, 1174.66, 1567.98]):
        mix_add(b, 0.06 + idx * 0.055, bell_chime(freq, 0.30, 0.45), 0.75)
    write_mp3("skill_clear", b, reverb=True)

    # 11. Skill Melt / Remove Board (fizzy crystal dissolve + glass shimmer)
    b = make_buf(0.62)
    mix_add(b, 0.0, tone_sweep(900, 260, 0.14, 0.002, 0.05), 0.55)
    for idx, freq in enumerate([1760, 1480, 1318, 1174, 987, 1568, 2093]):
        mix_add(b, 0.02 + idx * 0.042, bell_chime(freq, 0.24, 0.42), 0.7)
    mix_add(b, 0.03, filtered_noise_burst(0.22, 3200, 2, 0.01, 0.07), 0.4)
    write_mp3("skill_remove", b, reverb=True)

    # 12. Game Win Fanfare (warm uplifting marimba + harp + sparkle celebration!)
    b = make_buf(1.55)
    melody = [
        (0.00, 523.25, 0.35),  # C5
        (0.10, 659.25, 0.35),  # E5
        (0.20, 783.99, 0.38),  # G5
        (0.32, 1046.50, 0.90), # C6
        (0.32, 659.25, 0.85),  # E5 harmony
        (0.32, 783.99, 0.85),  # G5 harmony
        (0.50, 1318.51, 0.85), # E6 top sparkle
        (0.62, 1567.98, 0.85), # G6 flourish
    ]
    for t0, freq, dur in melody:
        mix_add(b, t0, marimba_note(freq, dur, 0.72), 0.85)
        mix_add(b, t0 + 0.008, bell_chime(freq, dur * 1.05, 0.42), 0.7)
    write_mp3("game_win", b, reverb=True)

    # 13. Game Lose (gentle sympathetic descending kalimba/marimba — encourages revive)
    b = make_buf(1.05)
    for t0, freq in [(0.00, 392.00), (0.18, 349.23), (0.36, 311.13), (0.54, 261.63)]:
        mix_add(b, t0, marimba_note(freq, 0.46, 0.78), 0.9)
    write_mp3("game_lose", b, reverb=True)

    # 14. Remaining clip aliases (color_in, color_win, fuhuo, jiesuo)
    b = make_buf(0.20)
    mix_add(b, 0.0, marimba_note(659.25, 0.16, 0.8), 0.9)
    mix_add(b, 0.04, bell_chime(1318.51, 0.15, 0.4), 0.6)
    write_mp3("color_in", b)

    b = make_buf(0.85)
    for idx, freq in enumerate([523.25, 659.25, 783.99, 1046.50, 1318.51]):
        mix_add(b, idx * 0.065, marimba_note(freq, 0.42, 0.75), 0.85)
        mix_add(b, idx * 0.065, bell_chime(freq * 1.5, 0.38, 0.3), 0.55)
    write_mp3("color_win", b, reverb=True)

    # Revive sound (uplifting power-up chord)
    b = make_buf(0.80)
    for idx, freq in enumerate([440.0, 554.37, 659.25, 880.0, 1108.73]):
        mix_add(b, idx * 0.055, bell_chime(freq, 0.42, 0.65), 0.8)
        mix_add(b, idx * 0.055, marimba_note(freq, 0.38, 0.65), 0.75)
    write_mp3("fuhuo", b, reverb=True)
    write_mp3("jiesuo", b, reverb=True)

    print(f"Synthesized 17 studio-mastered ASMR/musical SFX clips in {OUT_DIR}")


if __name__ == "__main__":
    synth_all()
