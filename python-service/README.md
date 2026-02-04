# IAIS - Intelligent AI-Powered Interview System

## 🎯 Overview

The **Intelligent AI-Powered Interview System (IAIS)** is a comprehensive Python-based platform for conducting AI-powered interviews with advanced proctoring and adaptive questioning capabilities, based on research paper specifications.

## 🏗️ System Architecture

### Module 1: GRCDA (Gaze-Reference Correlation Detection Algorithm)
**File:** `grcda_module.py`

- **Purpose:** Detect overlay reading by analyzing gaze patterns
- **Technology:** MediaPipe Face Mesh + DBSCAN Clustering
- **Key Features:**
  - Real-time gaze tracking using iris position
  - Pre-Answer Phase monitoring (3-8 seconds after question)
  - DBSCAN clustering to detect fixed reference points
  - Gaze anomaly scoring (0-1)

**How it works:**
1. Tracks gaze coordinates (x, y) relative to screen
2. Collects gaze points during Pre-Answer Phase
3. Applies DBSCAN clustering to detect dense clusters
4. Flags clusters as "Overlay Reading" if density > threshold

### Module 2: MMFDF (Multi-Modal Fusion Detection Framework)
**File:** `mmfdf_module.py`

- **Purpose:** Combine multiple detection signals into unified cheating probability
- **Formula:** `Final_Score = (0.30 × Gaze) + (0.25 × Timing) + (0.25 × Network) + (0.20 × Audio)`
- **Threshold:** Alert if `Final_Score > 0.65`

**Key Features:**
- Weighted fusion of 4 modality scores
- Temporal trend analysis
- Dominant modality identification
- Alert level classification (none/low/medium/high)

### Module 3: CCAQE (Context-Aware Adaptive Questioning Engine)
**File:** `ccaqe_module.py`

- **Purpose:** Generate adaptive interview questions using Gemini 1.5 Pro API
- **Technology:** Google Gemini API + Item Response Theory (IRT)

**Key Features:**
- PDF resume parsing
- 3 question types:
  - **Verification:** Verify CV claims
  - **Technical:** Deep technical knowledge
  - **Behavioral:** Soft skills and scenarios
- IRT-based difficulty adjustment
- Automatic response evaluation

**IRT Logic:**
- Correct streak ≥ 2 → Increase difficulty
- Incorrect streak ≥ 2 → Decrease difficulty
- Ability estimate updated continuously

### Module 4: SAFAS (Stress-Aware Fairness Adjustment System)
**File:** `safas_module.py`

- **Purpose:** Detect stress and apply fairness compensation
- **Stress Indicators:**
  - Blink rate (>25 blinks/min = stress)
  - Head movement (jitter/shakiness)
  - Facial tension (jaw clenching, eyebrow tension)

**Key Features:**
- Real-time blink detection using Eye Aspect Ratio (EAR)
- Stress event logging
- Fairness score adjustment (up to 15% boost)
- Prevents unfair penalization due to nervousness

### Module 5: Network Monitor
**File:** `network_monitor.py`

- **Purpose:** Monitor network traffic for suspicious activity
- **Technology:** Scapy (optional, requires admin)

**Key Features:**
- Suspicious port detection (SSH, VNC, RDP)
- High traffic detection
- Network anomaly scoring
- Simulation mode for demo (no admin required)

### Main Integration: IAIS Platform
**File:** `iais_main.py`

- **Purpose:** Integrate all modules into complete interview system
- **Features:**
  - Complete interview workflow
  - Live monitoring dashboard
  - Comprehensive reporting
  - Session management

## 📋 Requirements

### Python Version
- Python 3.9 or higher

### Dependencies
Install all dependencies:
```bash
pip install -r requirements.txt
```

### API Keys
- **Google Gemini API Key:** Required for question generation
  - Get key from: https://makersuite.google.com/app/apikey
  - Set environment variable:
    ```bash
    export GEMINI_API_KEY='your-api-key-here'
    ```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd python-service
pip install -r requirements.txt
```

### 2. Set API Key
```bash
# Windows (PowerShell)
$env:GEMINI_API_KEY="your-api-key-here"

# Linux/Mac
export GEMINI_API_KEY="your-api-key-here"
```

### 3. Test Individual Modules

#### Test GRCDA (Gaze Tracking)
```bash
python grcda_module.py
```
- Press 'q' to start question timer
- Press 'r' to get gaze report
- Press 'ESC' to exit

#### Test MMFDF (Fusion Engine)
```bash
python mmfdf_module.py
```
- Runs automated demo with different scenarios

#### Test CCAQE (Adaptive Questioning)
```bash
python ccaqe_module.py
```
- Requires GEMINI_API_KEY
- Generates sample questions and evaluates responses

#### Test SAFAS (Stress Detection)
```bash
python safas_module.py
```
- Press 's' to simulate score adjustment
- Press 'r' to get stress report
- Press 'ESC' to exit

#### Test Network Monitor
```bash
python network_monitor.py
```
- Runs in simulation mode (no admin required)

### 4. Run Complete IAIS System
```bash
python iais_main.py
```

**Controls:**
- Press 'q' to start question
- Press 'a' to submit answer
- Press 'r' to generate report
- Press 'ESC' to exit

## 📊 Usage Example

### Complete Interview Workflow

```python
from iais_main import IAISPlatform

# Initialize platform
iais = IAISPlatform(
    gemini_api_key="your-api-key",
    enable_network_monitoring=True
)

# Start interview
questions = iais.start_interview(
    resume_path="candidate_resume.pdf",
    job_description="Senior ML Engineer position...",
    candidate_info={
        "name": "John Doe",
        "email": "john@example.com"
    }
)

# Interview loop
import cv2
cap = cv2.VideoCapture(0)

while True:
    # Ask question
    question = iais.ask_next_question()
    if not question:
        break
    
    # Process video frames
    ret, frame = cap.read()
    processed_frame = iais.process_video_frame(frame)
    
    # Display
    cv2.imshow('Interview', processed_frame)
    
    # Get candidate answer (from UI/voice)
    answer = get_candidate_answer()  # Your implementation
    
    # Submit and evaluate
    iais.submit_answer(answer)

# End interview and get report
final_report = iais.end_interview()
print(final_report)
```

## 📈 Output Reports

### Interview Report Structure
```json
{
  "session_id": "20260131_160000",
  "session_duration": "0:45:23",
  "grcda_report": {
    "gaze_anomaly_score": 0.23,
    "clusters_detected": 2,
    "suspicious_clusters": 0
  },
  "safas_report": {
    "average_stress_level": 0.45,
    "total_blinks": 156,
    "fairness_adjustments_applied": 3
  },
  "ccaqe_report": {
    "total_questions": 10,
    "average_score": 0.78,
    "ability_estimate": 0.82
  },
  "mmfdf_statistics": {
    "average_score": 0.18,
    "total_alerts": 2,
    "high_alerts": 0
  },
  "overall_assessment": {
    "integrity_score": 0.82,
    "performance_score": 0.78,
    "recommendation": "STRONG HIRE"
  }
}
```

## 🔧 Configuration

### GRCDA Configuration
```python
grcda = GRCDADetector(
    pre_answer_window=(3.0, 8.0),  # Monitor 3-8s after question
    dbscan_eps=0.05,               # Cluster distance threshold
    dbscan_min_samples=5,          # Min points for cluster
    suspicious_cluster_threshold=8  # Min cluster size to flag
)
```

### MMFDF Configuration
```python
mmfdf = MMFDFEngine(
    weights={
        'gaze': 0.30,
        'timing': 0.25,
        'network': 0.25,
        'audio': 0.20
    },
    alert_threshold=0.65,
    high_alert_threshold=0.85
)
```

### SAFAS Configuration
```python
safas = SAFASDetector(
    high_blink_threshold=25.0,      # Blinks/min for stress
    stress_compensation_factor=0.15, # Max 15% score boost
    monitoring_window=60             # Analysis window (seconds)
)
```

## 🎓 Research Paper Implementation

This implementation follows the research paper specifications:

1. **GRCDA:** Uses DBSCAN clustering on gaze points during Pre-Answer Phase to detect overlay reading patterns
2. **MMFDF:** Implements exact weighted fusion formula with 0.65 threshold
3. **CCAQE:** Uses Gemini 1.5 Pro for question generation with IRT-based difficulty adaptation
4. **SAFAS:** Monitors blink rate (>25/min threshold) and applies fairness compensation

## 🐛 Troubleshooting

### Issue: "GEMINI_API_KEY not set"
**Solution:** Set environment variable before running:
```bash
export GEMINI_API_KEY='your-key-here'
```

### Issue: "Camera not found"
**Solution:** Check webcam connection and permissions

### Issue: "Network monitoring requires admin"
**Solution:** Run with admin privileges or disable network monitoring:
```python
iais = IAISPlatform(gemini_api_key="...", enable_network_monitoring=False)
```

### Issue: "MediaPipe not loading"
**Solution:** Reinstall MediaPipe:
```bash
pip uninstall mediapipe
pip install mediapipe==0.10.8
```

## 📝 License

This implementation is based on research paper specifications for educational and research purposes.

## 👥 Credits

- **GRCDA Algorithm:** Gaze-Reference Correlation Detection
- **MMFDF Framework:** Multi-Modal Fusion Detection
- **CCAQE Engine:** Context-Aware Adaptive Questioning
- **SAFAS System:** Stress-Aware Fairness Adjustment

## 🔗 Integration with Existing Platform

To integrate with your existing React frontend:

1. Create Flask/FastAPI REST API wrapper around IAIS
2. Expose endpoints:
   - `/api/interview/start` - Start interview
   - `/api/interview/question` - Get next question
   - `/api/interview/submit` - Submit answer
   - `/api/interview/video-frame` - Process video frame
   - `/api/interview/end` - End interview

3. Use WebSocket for real-time video processing
4. Store reports in your existing database

Example Flask integration coming soon!

---

**Built with ❤️ for Advanced AI-Powered Interviews**
