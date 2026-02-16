"""
Advanced Eye Movement Analysis Service
Detects micro-saccades, reading patterns, and stress levels
"""

import cv2
import numpy as np
from scipy import signal
from scipy.spatial import distance
from collections import deque
import time
import json

class EyeMovementAnalyzer:
    def __init__(self):
        # Saccade detection parameters
        self.gaze_history = deque(maxlen=60)  # 2 seconds at 30fps
        self.saccade_threshold = 0.05  # Minimum movement to count as saccade
        self.reading_pattern_threshold = 0.7  # Confidence threshold
        
        # Stress monitoring
        self.blink_history = deque(maxlen=300)  # 10 seconds
        self.pupil_history = deque(maxlen=150)  # 5 seconds
        self.last_blink_time = time.time()
        
    def detect_micro_saccades(self, left_iris, right_iris, left_eye_corners, right_eye_corners, timestamp):
        """
        Detect micro-saccades (small, rapid eye movements)
        Returns: saccade_detected (bool), velocity (float)
        """
        # Calculate normalized iris positions
        left_gaze_x = self._normalize_gaze(left_iris, left_eye_corners, axis='x')
        right_gaze_x = self._normalize_gaze(right_iris, right_eye_corners, axis='x')
        avg_gaze_x = (left_gaze_x + right_gaze_x) / 2
        
        left_gaze_y = self._normalize_gaze(left_iris, left_eye_corners, axis='y')
        right_gaze_y = self._normalize_gaze(right_iris, right_eye_corners, axis='y')
        avg_gaze_y = (left_gaze_y + right_gaze_y) / 2
        
        # Store in history
        self.gaze_history.append({
            'x': avg_gaze_x,
            'y': avg_gaze_y,
            'time': timestamp
        })
        
        if len(self.gaze_history) < 3:
            return False, 0.0
        
        # Calculate velocity (change in position over time)
        recent = list(self.gaze_history)[-3:]
        dx = recent[-1]['x'] - recent[0]['x']
        dy = recent[-1]['y'] - recent[0]['y']
        dt = recent[-1]['time'] - recent[0]['time']
        
        if dt == 0:
            return False, 0.0
        
        velocity = np.sqrt(dx**2 + dy**2) / dt
        
        # Saccade detected if velocity exceeds threshold
        saccade_detected = velocity > self.saccade_threshold
        
        return saccade_detected, velocity
    
    def detect_reading_pattern(self):
        """
        Detect if eye movements match reading behavior
        Returns: is_reading (bool), confidence (float), pattern_type (str)
        """
        if len(self.gaze_history) < 30:  # Need at least 1 second of data
            return False, 0.0, "insufficient_data"
        
        gaze_data = list(self.gaze_history)
        x_positions = [g['x'] for g in gaze_data]
        y_positions = [g['y'] for g in gaze_data]
        
        # Detect horizontal scanning (reading)
        x_range = max(x_positions) - min(x_positions)
        y_range = max(y_positions) - min(y_positions)
        
        # Reading typically has more horizontal than vertical movement
        horizontal_dominance = x_range / (y_range + 0.001)  # Avoid division by zero
        
        # Detect left-to-right resets (line breaks in reading)
        resets = 0
        for i in range(1, len(x_positions)):
            # Large leftward jump = potential line break
            if x_positions[i] - x_positions[i-1] < -0.3:
                resets += 1
        
        # Calculate reading confidence
        confidence = 0.0
        pattern_type = "natural"
        
        if horizontal_dominance > 2.0 and resets >= 2:
            # Strong reading pattern
            confidence = min(1.0, (horizontal_dominance / 5.0) + (resets / 10.0))
            pattern_type = "reading_horizontal"
        elif horizontal_dominance > 1.5 and resets >= 1:
            # Moderate reading pattern
            confidence = min(0.7, (horizontal_dominance / 6.0) + (resets / 15.0))
            pattern_type = "possible_reading"
        
        is_reading = confidence > self.reading_pattern_threshold
        
        return is_reading, confidence, pattern_type
    
    def analyze_stress_level(self, left_eye_landmarks, right_eye_landmarks, pupil_size):
        """
        Analyze stress level based on blink rate and pupil dilation
        Returns: stress_score (0-100), indicators (dict)
        """
        current_time = time.time()
        
        # Detect blink (eye aspect ratio)
        left_ear = self._eye_aspect_ratio(left_eye_landmarks)
        right_ear = self._eye_aspect_ratio(right_eye_landmarks)
        avg_ear = (left_ear + right_ear) / 2
        
        # Blink detected if EAR < threshold
        blink_detected = avg_ear < 0.2
        
        if blink_detected:
            time_since_last_blink = current_time - self.last_blink_time
            self.blink_history.append(time_since_last_blink)
            self.last_blink_time = current_time
        
        # Store pupil size
        self.pupil_history.append(pupil_size)
        
        # Calculate stress indicators
        indicators = {}
        stress_score = 0
        
        # 1. Blink Rate Analysis
        if len(self.blink_history) > 5:
            avg_blink_interval = np.mean(list(self.blink_history))
            blink_rate = 60 / avg_blink_interval if avg_blink_interval > 0 else 0
            
            # Normal: 15-20 blinks/min, Stressed: <10 or >30
            if blink_rate < 10 or blink_rate > 30:
                stress_score += 30
                indicators['blink_rate'] = f"{blink_rate:.1f} bpm (abnormal)"
            else:
                indicators['blink_rate'] = f"{blink_rate:.1f} bpm (normal)"
        
        # 2. Pupil Dilation Variability
        if len(self.pupil_history) > 10:
            pupil_std = np.std(list(self.pupil_history))
            pupil_mean = np.mean(list(self.pupil_history))
            
            # High variability indicates stress
            variability_ratio = pupil_std / (pupil_mean + 0.001)
            if variability_ratio > 0.15:
                stress_score += 40
                indicators['pupil_variability'] = "high"
            else:
                indicators['pupil_variability'] = "normal"
        
        # 3. Sustained Pupil Dilation
        if len(self.pupil_history) > 30:
            recent_pupils = list(self.pupil_history)[-30:]
            if np.mean(recent_pupils) > np.mean(list(self.pupil_history)) * 1.2:
                stress_score += 30
                indicators['pupil_dilation'] = "elevated"
            else:
                indicators['pupil_dilation'] = "normal"
        
        stress_score = min(100, stress_score)
        
        return stress_score, indicators
    
    def _normalize_gaze(self, iris_point, eye_corners, axis='x'):
        """Normalize iris position relative to eye corners"""
        if axis == 'x':
            eye_width = abs(eye_corners[1][0] - eye_corners[0][0])
            iris_offset = iris_point[0] - eye_corners[0][0]
            return iris_offset / (eye_width + 0.001)
        else:  # y-axis
            eye_height = abs(eye_corners[1][1] - eye_corners[0][1])
            iris_offset = iris_point[1] - eye_corners[0][1]
            return iris_offset / (eye_height + 0.001)
    
    def _eye_aspect_ratio(self, eye_landmarks):
        """
        Calculate Eye Aspect Ratio (EAR) for blink detection
        eye_landmarks: [(x1,y1), (x2,y2), (x3,y3), (x4,y4), (x5,y5), (x6,y6)]
        """
        if len(eye_landmarks) < 6:
            return 0.3  # Default open eye value
        
        # Vertical distances
        v1 = distance.euclidean(eye_landmarks[1], eye_landmarks[5])
        v2 = distance.euclidean(eye_landmarks[2], eye_landmarks[4])
        
        # Horizontal distance
        h = distance.euclidean(eye_landmarks[0], eye_landmarks[3])
        
        # EAR formula
        ear = (v1 + v2) / (2.0 * h + 0.001)
        
        return ear
    
    def process_frame(self, landmarks_data):
        """
        Main processing function
        landmarks_data: dict with iris positions, eye corners, pupil size, timestamp
        """
        timestamp = landmarks_data.get('timestamp', time.time())
        
        # Extract landmarks
        left_iris = landmarks_data['left_iris']  # (x, y)
        right_iris = landmarks_data['right_iris']
        left_eye_corners = landmarks_data['left_eye_corners']  # [(inner_x, inner_y), (outer_x, outer_y)]
        right_eye_corners = landmarks_data['right_eye_corners']
        left_eye_landmarks = landmarks_data.get('left_eye_landmarks', [])
        right_eye_landmarks = landmarks_data.get('right_eye_landmarks', [])
        pupil_size = landmarks_data.get('pupil_size', 0.5)
        
        # Run analyses
        saccade_detected, saccade_velocity = self.detect_micro_saccades(
            left_iris, right_iris, left_eye_corners, right_eye_corners, timestamp
        )
        
        is_reading, reading_confidence, pattern_type = self.detect_reading_pattern()
        
        stress_score, stress_indicators = self.analyze_stress_level(
            left_eye_landmarks, right_eye_landmarks, pupil_size
        )
        
        # Return comprehensive analysis
        return {
            'saccade': {
                'detected': saccade_detected,
                'velocity': float(saccade_velocity)
            },
            'reading_pattern': {
                'is_reading': is_reading,
                'confidence': float(reading_confidence),
                'pattern_type': pattern_type
            },
            'stress': {
                'score': int(stress_score),
                'level': 'high' if stress_score > 70 else 'medium' if stress_score > 40 else 'low',
                'indicators': stress_indicators
            },
            'timestamp': timestamp
        }


# Example usage
if __name__ == "__main__":
    analyzer = EyeMovementAnalyzer()
    
    # Simulate frame data
    test_data = {
        'left_iris': (0.45, 0.5),
        'right_iris': (0.55, 0.5),
        'left_eye_corners': [(0.3, 0.5), (0.6, 0.5)],
        'right_eye_corners': [(0.4, 0.5), (0.7, 0.5)],
        'left_eye_landmarks': [(0.3, 0.5), (0.35, 0.48), (0.4, 0.48), (0.6, 0.5), (0.55, 0.52), (0.5, 0.52)],
        'right_eye_landmarks': [(0.4, 0.5), (0.45, 0.48), (0.5, 0.48), (0.7, 0.5), (0.65, 0.52), (0.6, 0.52)],
        'pupil_size': 0.5,
        'timestamp': time.time()
    }
    
    result = analyzer.process_frame(test_data)
    print(json.dumps(result, indent=2))
