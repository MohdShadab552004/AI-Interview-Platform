"""
SAFAS Module: Stress-Aware Fairness Adjustment System
Detects candidate stress and applies compensation to prevent unfair penalties.

Based on research paper specifications:
- Monitors blink rate (>25 blinks/min indicates stress)
- Tracks physiological stress indicators
- Applies fairness compensation to final scores
"""

import cv2
import mediapipe as mp
import numpy as np
from collections import deque
from dataclasses import dataclass
from typing import List, Tuple, Optional
import time
from datetime import datetime


@dataclass
class StressEvent:
    """Represents a detected stress event"""
    timestamp: datetime
    stress_type: str  # 'high_blink_rate', 'facial_tension', 'rapid_movement'
    intensity: float  # 0-1
    duration: float  # seconds
    context: str  # What was happening (e.g., "difficult question")


@dataclass
class FairnessAdjustment:
    """Fairness compensation applied to scores"""
    original_score: float
    adjusted_score: float
    adjustment_factor: float
    reason: str
    stress_level: float


class SAFASDetector:
    """
    Stress-Aware Fairness Adjustment System
    
    Monitors candidate stress indicators and applies fairness compensation
    to prevent unfair penalization due to nervousness or anxiety.
    """
    
    def __init__(
        self,
        high_blink_threshold: float = 25.0,  # blinks per minute
        stress_compensation_factor: float = 0.15,  # max 15% score boost
        monitoring_window: int = 60  # seconds
    ):
        """
        Initialize SAFAS Detector
        
        Args:
            high_blink_threshold: Blinks/min threshold for stress detection
            stress_compensation_factor: Maximum score adjustment (0-1)
            monitoring_window: Time window for stress analysis (seconds)
        """
        self.high_blink_threshold = high_blink_threshold
        self.stress_compensation_factor = stress_compensation_factor
        self.monitoring_window = monitoring_window
        
        # MediaPipe Face Mesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Eye landmarks for blink detection
        self.LEFT_EYE_TOP = 159
        self.LEFT_EYE_BOTTOM = 145
        self.RIGHT_EYE_TOP = 386
        self.RIGHT_EYE_BOTTOM = 374
        
        # Blink tracking
        self.blink_timestamps: deque = deque(maxlen=100)
        self.is_eye_closed = False
        self.eye_aspect_ratio_threshold = 0.2
        
        # Stress tracking
        self.stress_events: List[StressEvent] = []
        self.current_stress_level = 0.0
        
        # Head movement tracking (for nervousness)
        self.head_positions: deque = deque(maxlen=30)
        
        # Facial tension tracking
        self.tension_history: deque = deque(maxlen=50)
        
        # Fairness adjustments log
        self.adjustments: List[FairnessAdjustment] = []
        
    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, dict]:
        """
        Process video frame for stress detection
        
        Args:
            frame: BGR image from webcam
            
        Returns:
            Tuple of (annotated_frame, metrics_dict)
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)
        
        h, w, _ = frame.shape
        current_time = time.time()
        
        metrics = {
            'blink_rate': 0.0,
            'stress_level': 0.0,
            'facial_tension': 0.0,
            'head_movement': 0.0,
            'stress_detected': False
        }
        
        if not results.multi_face_landmarks:
            return frame, metrics
        
        landmarks = results.multi_face_landmarks[0].landmark
        
        # 1. Blink Detection
        blink_detected = self._detect_blink(landmarks)
        if blink_detected:
            self.blink_timestamps.append(current_time)
        
        # Calculate blink rate (blinks per minute)
        blink_rate = self._calculate_blink_rate()
        
        # 2. Head Movement Analysis (nervousness indicator)
        head_movement_score = self._analyze_head_movement(landmarks)
        
        # 3. Facial Tension Analysis
        tension_score = self._analyze_facial_tension(landmarks)
        
        # 4. Calculate overall stress level
        stress_level = self._calculate_stress_level(
            blink_rate,
            head_movement_score,
            tension_score
        )
        
        self.current_stress_level = stress_level
        
        # 5. Log stress events
        if stress_level > 0.6:
            self._log_stress_event(stress_level, blink_rate, head_movement_score)
        
        # Draw visualization
        annotated_frame = self._draw_stress_overlay(
            frame,
            landmarks,
            blink_rate,
            stress_level,
            w,
            h
        )
        
        metrics.update({
            'blink_rate': blink_rate,
            'stress_level': stress_level,
            'facial_tension': tension_score,
            'head_movement': head_movement_score,
            'stress_detected': stress_level > 0.6,
            'total_blinks': len(self.blink_timestamps)
        })
        
        return annotated_frame, metrics
    
    def _detect_blink(self, landmarks) -> bool:
        """
        Detect eye blink using Eye Aspect Ratio (EAR)
        
        Args:
            landmarks: MediaPipe face landmarks
            
        Returns:
            True if blink detected
        """
        # Calculate Eye Aspect Ratio for both eyes
        left_ear = self._calculate_eye_aspect_ratio(
            landmarks,
            self.LEFT_EYE_TOP,
            self.LEFT_EYE_BOTTOM
        )
        
        right_ear = self._calculate_eye_aspect_ratio(
            landmarks,
            self.RIGHT_EYE_TOP,
            self.RIGHT_EYE_BOTTOM
        )
        
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Detect blink (eye closure)
        blink_detected = False
        
        if avg_ear < self.eye_aspect_ratio_threshold:
            if not self.is_eye_closed:
                # Eye just closed (blink start)
                self.is_eye_closed = True
        else:
            if self.is_eye_closed:
                # Eye just opened (blink complete)
                blink_detected = True
                self.is_eye_closed = False
        
        return blink_detected
    
    def _calculate_eye_aspect_ratio(
        self,
        landmarks,
        top_idx: int,
        bottom_idx: int
    ) -> float:
        """
        Calculate Eye Aspect Ratio (EAR)
        
        Args:
            landmarks: Face landmarks
            top_idx: Index of top eyelid landmark
            bottom_idx: Index of bottom eyelid landmark
            
        Returns:
            EAR value (0 = closed, 1 = open)
        """
        top = landmarks[top_idx]
        bottom = landmarks[bottom_idx]
        
        # Vertical distance
        vertical_dist = abs(top.y - bottom.y)
        
        # Normalize (typical open eye has ~0.3-0.4 ratio)
        ear = vertical_dist / 0.04  # Normalize
        
        return min(1.0, ear)
    
    def _calculate_blink_rate(self) -> float:
        """
        Calculate blinks per minute from recent history
        
        Returns:
            Blinks per minute
        """
        if len(self.blink_timestamps) < 2:
            return 0.0
        
        current_time = time.time()
        
        # Count blinks in last 60 seconds
        recent_blinks = [
            t for t in self.blink_timestamps
            if current_time - t <= 60.0
        ]
        
        if not recent_blinks:
            return 0.0
        
        # Calculate rate
        time_span = current_time - min(recent_blinks)
        if time_span > 0:
            blinks_per_minute = (len(recent_blinks) / time_span) * 60.0
        else:
            blinks_per_minute = 0.0
        
        return blinks_per_minute
    
    def _analyze_head_movement(self, landmarks) -> float:
        """
        Analyze head movement (jitter indicates nervousness)
        
        Args:
            landmarks: Face landmarks
            
        Returns:
            Movement score (0-1, higher = more movement)
        """
        # Use nose tip as reference point
        nose = landmarks[1]
        position = (nose.x, nose.y, nose.z)
        
        self.head_positions.append(position)
        
        if len(self.head_positions) < 5:
            return 0.0
        
        # Calculate movement variance
        positions = np.array(list(self.head_positions))
        variance = np.var(positions, axis=0).sum()
        
        # Normalize to 0-1 range
        movement_score = min(1.0, variance * 100)
        
        return movement_score
    
    def _analyze_facial_tension(self, landmarks) -> float:
        """
        Analyze facial tension (jaw clenching, eyebrow tension)
        
        Args:
            landmarks: Face landmarks
            
        Returns:
            Tension score (0-1)
        """
        # Simplified tension detection using mouth and eyebrow positions
        
        # Mouth landmarks (tight lips indicate tension)
        upper_lip = landmarks[13]
        lower_lip = landmarks[14]
        mouth_opening = abs(upper_lip.y - lower_lip.y)
        
        # Eyebrow landmarks (raised/furrowed indicates stress)
        left_eyebrow = landmarks[70]
        right_eyebrow = landmarks[300]
        left_eye = landmarks[159]
        right_eye = landmarks[386]
        
        left_eyebrow_height = abs(left_eyebrow.y - left_eye.y)
        right_eyebrow_height = abs(right_eyebrow.y - right_eye.y)
        avg_eyebrow_height = (left_eyebrow_height + right_eyebrow_height) / 2
        
        # Combine indicators
        # Tight mouth (small opening) + raised eyebrows = tension
        mouth_tension = 1.0 - min(1.0, mouth_opening * 20)
        eyebrow_tension = min(1.0, avg_eyebrow_height * 15)
        
        tension_score = (mouth_tension * 0.6 + eyebrow_tension * 0.4)
        
        self.tension_history.append(tension_score)
        
        # Return smoothed tension
        if len(self.tension_history) > 0:
            return np.mean(list(self.tension_history))
        
        return tension_score
    
    def _calculate_stress_level(
        self,
        blink_rate: float,
        head_movement: float,
        facial_tension: float
    ) -> float:
        """
        Calculate overall stress level from multiple indicators
        
        Args:
            blink_rate: Blinks per minute
            head_movement: Head movement score
            facial_tension: Facial tension score
            
        Returns:
            Overall stress level (0-1)
        """
        # Normalize blink rate (25+ blinks/min = high stress)
        blink_stress = min(1.0, blink_rate / self.high_blink_threshold)
        
        # Weighted combination
        stress_level = (
            0.4 * blink_stress +
            0.3 * head_movement +
            0.3 * facial_tension
        )
        
        return np.clip(stress_level, 0.0, 1.0)
    
    def _log_stress_event(
        self,
        stress_level: float,
        blink_rate: float,
        head_movement: float
    ):
        """Log a stress event"""
        
        # Determine stress type
        if blink_rate > self.high_blink_threshold:
            stress_type = 'high_blink_rate'
        elif head_movement > 0.6:
            stress_type = 'rapid_movement'
        else:
            stress_type = 'facial_tension'
        
        event = StressEvent(
            timestamp=datetime.now(),
            stress_type=stress_type,
            intensity=stress_level,
            duration=1.0,  # Approximate
            context="Interview in progress"
        )
        
        self.stress_events.append(event)
    
    def apply_fairness_adjustment(
        self,
        original_score: float,
        context: str = "General"
    ) -> FairnessAdjustment:
        """
        Apply fairness compensation to a score based on detected stress
        
        Args:
            original_score: Original score (0-1)
            context: Context of the score (e.g., "Question 5")
            
        Returns:
            FairnessAdjustment with adjusted score
        """
        # Calculate adjustment based on stress level
        adjustment_factor = self.current_stress_level * self.stress_compensation_factor
        
        # Apply adjustment (boost score if stressed)
        adjusted_score = min(1.0, original_score + adjustment_factor)
        
        reason = f"Stress level: {self.current_stress_level:.2f}"
        if self.current_stress_level > 0.6:
            reason += " (High stress detected - fairness compensation applied)"
        
        adjustment = FairnessAdjustment(
            original_score=original_score,
            adjusted_score=adjusted_score,
            adjustment_factor=adjustment_factor,
            reason=reason,
            stress_level=self.current_stress_level
        )
        
        self.adjustments.append(adjustment)
        
        print(f"[SAFAS] Fairness adjustment: {original_score:.3f} → {adjusted_score:.3f}")
        
        return adjustment
    
    def _draw_stress_overlay(
        self,
        frame: np.ndarray,
        landmarks,
        blink_rate: float,
        stress_level: float,
        width: int,
        height: int
    ) -> np.ndarray:
        """Draw stress monitoring visualization"""
        
        # Color coding based on stress level
        if stress_level < 0.3:
            color = (0, 255, 0)  # Green - calm
            status = "CALM"
        elif stress_level < 0.6:
            color = (0, 165, 255)  # Orange - moderate
            status = "MODERATE"
        else:
            color = (0, 0, 255)  # Red - stressed
            status = "STRESSED"
        
        # Display stress metrics
        y_offset = 30
        cv2.putText(
            frame,
            f"Stress Level: {stress_level:.2f} [{status}]",
            (10, y_offset),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2
        )
        
        y_offset += 30
        cv2.putText(
            frame,
            f"Blink Rate: {blink_rate:.1f} blinks/min",
            (10, y_offset),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1
        )
        
        # Stress indicator bar
        bar_width = 200
        bar_height = 20
        bar_x = width - bar_width - 10
        bar_y = 10
        
        # Background
        cv2.rectangle(
            frame,
            (bar_x, bar_y),
            (bar_x + bar_width, bar_y + bar_height),
            (50, 50, 50),
            -1
        )
        
        # Stress level fill
        fill_width = int(bar_width * stress_level)
        cv2.rectangle(
            frame,
            (bar_x, bar_y),
            (bar_x + fill_width, bar_y + bar_height),
            color,
            -1
        )
        
        # Label
        cv2.putText(
            frame,
            "Stress",
            (bar_x, bar_y - 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1
        )
        
        return frame
    
    def get_stress_report(self) -> dict:
        """
        Generate comprehensive stress analysis report
        
        Returns:
            Dictionary with stress metrics and fairness adjustments
        """
        if not self.stress_events:
            avg_stress = 0.0
            max_stress = 0.0
        else:
            avg_stress = np.mean([e.intensity for e in self.stress_events])
            max_stress = max(e.intensity for e in self.stress_events)
        
        return {
            'total_stress_events': len(self.stress_events),
            'average_stress_level': float(avg_stress),
            'max_stress_level': float(max_stress),
            'current_stress_level': self.current_stress_level,
            'total_blinks': len(self.blink_timestamps),
            'current_blink_rate': self._calculate_blink_rate(),
            'fairness_adjustments_applied': len(self.adjustments),
            'average_adjustment': np.mean([a.adjustment_factor for a in self.adjustments]) if self.adjustments else 0.0,
            'stress_events_by_type': {
                'high_blink_rate': sum(1 for e in self.stress_events if e.stress_type == 'high_blink_rate'),
                'rapid_movement': sum(1 for e in self.stress_events if e.stress_type == 'rapid_movement'),
                'facial_tension': sum(1 for e in self.stress_events if e.stress_type == 'facial_tension')
            }
        }
    
    def reset(self):
        """Reset detector state"""
        self.blink_timestamps.clear()
        self.stress_events.clear()
        self.adjustments.clear()
        self.head_positions.clear()
        self.tension_history.clear()
        self.current_stress_level = 0.0
        print("[SAFAS] Detector reset")


# Demo/Testing function
def demo_safas():
    """
    Demo function to test SAFAS with webcam
    """
    detector = SAFASDetector()
    cap = cv2.VideoCapture(0)
    
    print("=" * 60)
    print("SAFAS Demo - Stress Detection & Fairness System")
    print("=" * 60)
    print("Press 's' to simulate score adjustment")
    print("Press 'r' to get stress report")
    print("Press 'ESC' to exit")
    print("=" * 60)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Process frame
        annotated_frame, metrics = detector.process_frame(frame)
        
        # Display metrics
        y_offset = 120
        for key, value in metrics.items():
            if key != 'stress_detected':
                cv2.putText(
                    annotated_frame,
                    f"{key}: {value}",
                    (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (255, 255, 255),
                    1
                )
                y_offset += 25
        
        cv2.imshow('SAFAS - Stress Monitoring', annotated_frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == 27:  # ESC
            break
        elif key == ord('s'):
            # Simulate score adjustment
            original_score = 0.75
            adjustment = detector.apply_fairness_adjustment(original_score, "Test Question")
            print(f"\nScore Adjustment:")
            print(f"  Original: {adjustment.original_score:.3f}")
            print(f"  Adjusted: {adjustment.adjusted_score:.3f}")
            print(f"  Reason: {adjustment.reason}")
        elif key == ord('r'):
            report = detector.get_stress_report()
            print("\n" + "=" * 60)
            print("STRESS ANALYSIS REPORT")
            print("=" * 60)
            for k, v in report.items():
                print(f"{k}: {v}")
            print("=" * 60 + "\n")
    
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    demo_safas()
