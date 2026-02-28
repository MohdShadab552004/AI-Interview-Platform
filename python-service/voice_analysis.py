from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import librosa
import io
import tempfile
import os
from gtts import gTTS
from transformers import pipeline
import torch
from flask import send_file
import scipy.signal
import warnings
import soundfile as sf

# Suppress specific warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message="PySoundFile failed")
warnings.filterwarnings("ignore", message="librosa.core.audio.__audioread_load")
warnings.filterwarnings("ignore", message="Using `chunk_length_s` is very experimental")

if not hasattr(scipy.signal, 'hann'):
    try:
        import scipy.signal.windows
        scipy.signal.hann = scipy.signal.windows.hann
    except:
        pass

app = Flask(__name__)
CORS(app)

# Load ASR pipeline at startup
try:
    print("Loading Transformers ASR pipeline...")
    device = 0 if torch.cuda.is_available() else -1
    asr_pipeline = pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-base",
        device=device,
        chunk_length_s=30,
        stride_length_s=5,
        generate_kwargs={"task": "transcribe"}
    )
    print(f"ASR pipeline loaded on {'cuda' if device == 0 else 'cpu'}")
except Exception as e:
    print(f"Error loading ASR pipeline: {str(e)}")
    asr_pipeline = None

def load_audio_file(file_path, sample_rate=44100):
    """Load audio file using soundfile with librosa fallback"""
    try:
        # Try using soundfile first (no warnings)
        y, sr = sf.read(file_path)
        # Convert to mono if stereo
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        # Resample if needed
        if sr != sample_rate:
            y = librosa.resample(y, orig_sr=sr, target_sr=sample_rate)
        return y, sample_rate
    except Exception as e:
        # Fallback to librosa
        try:
            y, sr = librosa.load(file_path, sr=sample_rate, mono=True)
            return y, sr
        except Exception as e2:
            raise Exception(f"Failed to load audio: {str(e)}, {str(e2)}")

def analyze_audio(audio_data, sample_rate=44100):
    """Analyze audio for speech metrics"""
    try:
        # Load audio from bytes
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name
        
        # Load audio file with improved function
        y, sr = load_audio_file(tmp_path, sample_rate)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Calculate speech rate (words per minute estimation)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo_result = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        
        # Handle different return types of beat_track (older vs newer librosa versions)
        if isinstance(tempo_result, tuple):
            tempo = tempo_result[0]
        else:
            tempo = tempo_result
            
        # Ensure tempo is a float value
        if hasattr(tempo, "__len__"):
            tempo_val = float(tempo[0]) if len(tempo) > 0 else 0
        else:
            tempo_val = float(tempo)
        
        # Pitch analysis
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_mean = np.mean(pitches[pitches > 0]) if np.any(pitches > 0) else 0
        pitch_std = np.std(pitches[pitches > 0]) if np.any(pitches > 0) and len(pitches[pitches > 0]) > 1 else 0
        
        # Energy/Volume analysis
        rms = librosa.feature.rms(y=y)[0]
        energy_mean = np.mean(rms)
        energy_std = np.std(rms)
        
        # Detect pauses (silence)
        intervals = librosa.effects.split(y, top_db=30)
        pause_count = len(intervals) - 1
        total_pause_duration = sum((intervals[i+1][0] - intervals[i][1]) / sr 
                                  for i in range(len(intervals)-1))
        
        # Duration in seconds
        duration = librosa.get_duration(y=y, sr=sr)
        
        # Calculate metrics
        if duration > 0:
            speech_rate = len(intervals) / duration * 60
            pause_ratio = total_pause_duration / duration
        else:
            speech_rate = 0
            pause_ratio = 0
        
        # Confidence score
        confidence_score = calculate_confidence(
            energy_std, 
            pitch_std, 
            pause_ratio, 
            speech_rate
        )
        
        # Clarity score
        clarity_score = 1 - min(energy_std / (energy_mean + 1e-10), 1)
        
        return {
            "success": True,
            "analysis": {
                "duration": float(duration),
                "speechRate": float(speech_rate),
                "pitchStability": float(1 - min(pitch_std / (pitch_mean + 1e-10), 1)),
                "volumeConsistency": float(clarity_score),
                "pauseCount": int(pause_count),
                "pauseRatio": float(pause_ratio),
                "confidence": float(confidence_score),
                "clarity": float(clarity_score),
                "energy": float(energy_mean),
                "tempo": tempo_val
            }
        }
        
    except Exception as e:
        print(f"Error analyzing audio: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "analysis": get_default_analysis()
        }

def calculate_confidence(energy_std, pitch_std, pause_ratio, speech_rate):
    """Calculate composite confidence score"""
    energy_score = 1 - min(energy_std / 0.1, 1)
    pitch_score = 1 - min(pitch_std / 50, 1)
    pause_score = 1 - min(pause_ratio / 0.3, 1)
    
    if 150 <= speech_rate <= 180:
        rate_score = 1.0
    else:
        rate_score = 1 - min(abs(speech_rate - 165) / 100, 1)
    
    confidence = (
        0.3 * energy_score +
        0.2 * pitch_score +
        0.3 * pause_score +
        0.2 * rate_score
    )
    
    return max(0, min(1, confidence))

def get_default_analysis():
    """Return default analysis in case of error"""
    return {
        "duration": 0,
        "speechRate": 150,
        "pitchStability": 0.5,
        "volumeConsistency": 0.5,
        "pauseCount": 0,
        "pauseRatio": 0.1,
        "confidence": 0.5,
        "clarity": 0.5,
        "energy": 0.5,
        "tempo": 120
    }

@app.route('/analyze', methods=['POST'])
def analyze():
    """Main analysis endpoint"""
    try:
        if 'audio' not in request.files:
            return jsonify({
                "success": False,
                "error": "No audio file provided"
            }), 400
        
        audio_file = request.files['audio']
        audio_data = audio_file.read()
        
        if len(audio_data) == 0:
            return jsonify({
                "success": False,
                "error": "Empty audio file"
            }), 400
        
        result = analyze_audio(audio_data)
        print(result)
        return jsonify(result)
        
    except Exception as e:
        print(f"Endpoint error: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Analysis failed: {str(e)}",
            "analysis": get_default_analysis()
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "voice-analysis",
        "asr_pipeline_status": "loaded" if asr_pipeline else "not_loaded"
    })

@app.route('/tts', methods=['POST'])
def tts():
    """Convert text to speech using gTTS"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
        
        text = data['text']
        lang = data.get('lang', 'en')
        
        # Generate audio using gTTS
        tts_obj = gTTS(text=text, lang=lang)
        
        # Save to a byte stream or temp file
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
            tmp_path = tmp.name
            tts_obj.save(tmp_path)
        
        return send_file(
            tmp_path,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name="speech.mp3"
        )
        
    except Exception as e:
        print(f"TTS error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Transcribe audio to text using Transformers ASR pipeline"""
    temp_file_path = None
    try:
        print("Transcribing audio with pipeline...")
        if asr_pipeline is None:
            return jsonify({
                "success": False,
                "error": "ASR pipeline not loaded"
            }), 500
        
        if 'audio' not in request.files:
            return jsonify({
                "success": False,
                "error": "No audio file provided"
            }), 400
        
        audio_file = request.files['audio']
        print(f"Audio file received: {audio_file.filename}")
        
        # Get file extension
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        if not file_ext or file_ext not in ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm']:
            content_type = audio_file.content_type
            if content_type:
                if 'wav' in content_type: file_ext = '.wav'
                elif 'mp3' in content_type or 'mpeg' in content_type: file_ext = '.mp3'
                elif 'ogg' in content_type: file_ext = '.ogg'
                elif 'flac' in content_type: file_ext = '.flac'
                else: file_ext = '.wav'
        
        temp_fd, temp_file_path = tempfile.mkstemp(suffix=file_ext)
        os.close(temp_fd)
        
        print(f"Saving audio to: {temp_file_path}")
        audio_file.save(temp_file_path)
        
        if os.path.getsize(temp_file_path) == 0:
            return jsonify({"success": False, "error": "Audio file is empty"}), 400
        
        # Transcribe with pipeline - ignore experimental warnings
        print(f"Starting pipeline transcription of {temp_file_path}...")
        result = asr_pipeline(
            temp_file_path,
            return_timestamps=False  # Avoid ending timestamp warning
        )
        print(f"Transcription complete")
        print(f"Result: {result}")
        
        return jsonify({
            "success": True,
            "text": result["text"].strip()
        })
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Transcription failed: {str(e)}"
        }), 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                print(f"Cleaned up temp file: {temp_file_path}")
            except: pass


# DeepFace lazy loader (avoids slow startup)
deepface_model = None

def get_deepface():
    global deepface_model
    if deepface_model is None:
        try:
            from deepface import DeepFace
            deepface_model = DeepFace
            print("DeepFace loaded successfully")
        except ImportError as e:
            print(f"DeepFace not available: {e}")
    return deepface_model

@app.route('/analyze-stress', methods=['POST'])
def analyze_stress():
    """Analyze facial emotions for stress & confidence using DeepFace"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({
                "success": False,
                "error": "No image provided"
            }), 400

        # Decode base64 image
        import base64
        image_data = data['image']
        # Strip data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)

        import cv2
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({
                "success": False,
                "error": "Failed to decode image"
            }), 400

        DeepFace = get_deepface()
        if DeepFace is None:
            return jsonify({
                "success": False,
                "error": "DeepFace not installed"
            }), 500

        # Run emotion analysis
        result = DeepFace.analyze(
            frame,
            actions=['emotion'],
            enforce_detection=False,
            silent=True
        )

        # DeepFace returns a list of results (one per face)
        if isinstance(result, list):
            result = result[0]

        emotions = result.get('emotion', {})
        dominant = result.get('dominant_emotion', 'neutral')

        # Stress score: weighted negative emotions (0-100)
        stress_score = (
            emotions.get('angry', 0) * 0.30 +
            emotions.get('fear', 0) * 0.35 +
            emotions.get('sad', 0) * 0.20 +
            emotions.get('disgust', 0) * 0.15
        )

        # Confidence score: weighted positive/neutral emotions (0-100)
        confidence_score = (
            emotions.get('neutral', 0) * 0.40 +
            emotions.get('happy', 0) * 0.40 +
            emotions.get('surprise', 0) * 0.20
        )

        return jsonify({
            "success": True,
            "stress_score": round(stress_score, 2),
            "confidence_score": round(confidence_score, 2),
            "dominant_emotion": dominant,
            "emotions": {k: round(v, 2) for k, v in emotions.items()}
        })

    except Exception as e:
        print(f"DeepFace analysis error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "stress_score": 0,
            "confidence_score": 50,
            "dominant_emotion": "unknown",
            "emotions": {}
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    # Use a different port if 5001 is in use
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)  # debug=False for production