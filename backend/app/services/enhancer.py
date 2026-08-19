import subprocess
import os
import logging

logger = logging.getLogger(__name__)

def enhance_audio(
    input_path: str,
    output_path: str,
    normalize_volume: bool = True,
    reduce_noise: bool = True,
    speech_enhance: bool = True,
    strength: str = "normal"
) -> bool:
    """
    Enhances input audio file using FFmpeg and saves it as a 16kHz mono WAV file.
    """
    if not os.path.exists(input_path):
        logger.error(f"Input file not found: {input_path}")
        return False

    filters = []

    # 1. Volume Normalization (Loudnorm)
    if normalize_volume:
        if strength == "normal":
            filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        elif strength == "strong":
            filters.append("loudnorm=I=-14:TP=-1.0:LRA=9")
        elif strength == "aggressive":
            filters.append("loudnorm=I=-12:TP=-1.0:LRA=7")
        else:
            filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")

    # 2. Dynamic Range Compression (Compand) to pull quiet speech up
    if speech_enhance:
        if strength == "normal":
            # Mild compression
            filters.append("compand=attacks=0.3|0.3:decays=0.8|0.8:points=-90/-90|-40/-30|-20/-12|0/0")
        elif strength == "strong":
            # Stronger compression
            filters.append("compand=attacks=0.1|0.1:decays=0.5|0.5:points=-90/-70|-40/-20|-20/-10|0/0")
        elif strength == "aggressive":
            # Very heavy compression to bring extremely low-volume audio up
            filters.append("compand=attacks=0.05|0.05:decays=0.3|0.3:points=-90/-50|-30/-10|-10/-5|0/0")

    # 3. Noise Reduction (Bandpass Filtering)
    if reduce_noise:
        if strength == "normal":
            filters.append("highpass=f=100")
        elif strength == "strong":
            filters.append("highpass=f=150,lowpass=f=3800")
        elif strength == "aggressive":
            filters.append("highpass=f=200,lowpass=f=3200")

    # Assemble filtergraph
    filter_str = ",".join(filters) if filters else "anull"

    # Make output directory if not exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-af", filter_str,
        "-ar", "16000",
        "-ac", "1",
        output_path
    ]

    logger.info(f"Running FFmpeg enhancement command: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info("FFmpeg processing completed successfully.")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg error: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"Failed to run FFmpeg: {str(e)}")
        return False
