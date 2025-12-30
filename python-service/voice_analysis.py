from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import librosa
import soundfile as sf
import io
import tempfile
import os

app = Flask(__name__)
CORS(app)

def analyze_audio(audio_data, sample_rate=44100):
    """Analyze audio for speech metrics"""
    try:
        # Load audio from bytes
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name
        
        # Load audio file
        y, sr = librosa.load(tmp_path, sr=sample_rate)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Calculate speech rate (words per minute estimation)
        # Extract syllables
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        
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
            speech_rate = len(intervals) / duration * 60  # Approx words per minute
            pause_ratio = total_pause_duration / duration
        else:
            speech_rate = 0
            pause_ratio = 0
        
        # Confidence score (composite metric)
        confidence_score = calculate_confidence(
            energy_std, 
            pitch_std, 
            pause_ratio, 
            speech_rate
        )
        
        # Clarity score (based on energy consistency)
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
                "tempo": float(tempo[0] if len(tempo) > 0 else 0)
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
    # Normalize metrics
    energy_score = 1 - min(energy_std / 0.1, 1)  # Lower energy variation is better
    pitch_score = 1 - min(pitch_std / 50, 1)      # Lower pitch variation is better
    pause_score = 1 - min(pause_ratio / 0.3, 1)   # Lower pause ratio is better
    
    # Ideal speech rate is 150-180 WPM
    if 150 <= speech_rate <= 180:
        rate_score = 1.0
    else:
        rate_score = 1 - min(abs(speech_rate - 165) / 100, 1)
    
    # Weighted average
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
        "service": "voice-analysis"
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)