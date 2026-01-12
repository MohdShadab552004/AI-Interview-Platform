import os
import tempfile
from gtts import gTTS
from transformers import pipeline
import torch

def test_tts():
    print("Testing TTS...")
    text = "Hello, this is a test of the text to speech system."
    tts_obj = gTTS(text=text, lang='en')
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
        tmp_path = tmp.name
        tts_obj.save(tmp_path)
    print(f"TTS saved to {tmp_path}")
    return tmp_path

def test_stt(audio_path):
    print("Testing STT...")
    device = 0 if torch.cuda.is_available() else -1
    asr_pipeline = pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-tiny", # Use tiny for faster testing
        device=device
    )
    result = asr_pipeline(audio_path)
    print(f"STT result: {result['text']}")
    return result['text']

if __name__ == "__main__":
    try:
        audio_path = test_tts()
        text = test_stt(audio_path)
        print("Test completed successfully!")
        if os.path.exists(audio_path):
            os.remove(audio_path)
    except Exception as e:
        print(f"Test failed: {str(e)}")
