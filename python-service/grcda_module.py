"""
GRCDA Module: Gaze-Reference Correlation Detection Algorithm
Implements real-time gaze tracking and overlay reading detection using DBSCAN clustering.

Based on research paper specifications:
- Tracks gaze coordinates during Pre-Answer Phase (3-8 seconds after question)
- Uses DBSCAN clustering to detect fixed gaze patterns (overlay reading)
- Outputs a gaze anomaly score (0-1)
"""

import cv2
import mediapipe as mp
import numpy as np
from sklearn.cluster import DBSCAN
from collections import deque
from dataclasses import dataclass
from typing import List, Tuple, Optional
import time


@dataclass
class GazePoint:
    """Represents a single gaze point with timestamp"""
    x: float
    y: float
    timestamp: float
    screen_width: int
    screen_height: int


@dataclass
class GazeCluster:
    """Represents a detected gaze cluster"""
    center: Tuple[float, float]
    density: int
    duration: float
    is_suspicious: bool


class GRCDADetector:
    """
    Gaze-Reference Correlation Detection Algorithm
    
    Detects overlay reading by analyzing gaze patterns during the Pre-Answer Phase.
    Uses DBSCAN clustering to identify fixed reference points.
    """
    
    def __init__(
        self,
        pre_answer_window: Tuple[float, float] = (3.0, 8.0),
        dbscan_eps: float = 0.05,
        dbscan_min_samples: int = 5,
        suspicious_cluster_threshold: int = 8,
        max_gaze_history: int = 200
    ):
        """
        Initialize GRCDA Detector
        
        Args:
            pre_answer_window: Time window (start, end) in seconds after question
            dbscan_eps: DBSCAN epsilon parameter (max distance between points)
            dbscan_min_samples: Minimum samples to form a cluster
            suspicious_cluster_threshold: Min cluster size to flag as suspicious
            max_gaze_history: Maximum gaze points to keep in memory
        """
        self.pre_answer_window = pre_answer_window
        self.dbscan_eps = dbscan_eps
        self.dbscan_min_samples = dbscan_min_samples
        self.suspicious_cluster_threshold = suspicious_cluster_threshold
        self.max_gaze_history = max_gaze_history
        
        # MediaPipe Face Mesh for gaze tracking
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Gaze tracking state
        self.gaze_history: deque = deque(maxlen=max_gaze_history)
        self.pre_answer_gaze: List[GazePoint] = []
        
        # Question timing
        self.question_start_time: Optional[float] = None
        self.is_in_pre_answer_phase: bool = False
        
        # Iris landmark indices (MediaPipe Face Mesh)
        self.LEFT_IRIS = [468, 469, 470, 471, 472]
        self.RIGHT_IRIS = [473, 474, 475, 476, 477]
        
        # Eye boundary landmarks
        self.LEFT_EYE_INNER = 133
        self.LEFT_EYE_OUTER = 33
        self.RIGHT_EYE_INNER = 362
        self.RIGHT_EYE_OUTER = 263
        
        # Vertical eye landmarks
        self.LEFT_EYE_TOP = 159
        self.LEFT_EYE_BOTTOM = 145
        self.RIGHT_EYE_TOP = 386
        self.RIGHT_EYE_BOTTOM = 374
        
    def start_question_timer(self):
        """Call this when a new question is asked"""
        self.question_start_time = time.time()
        self.is_in_pre_answer_phase = True
        self.pre_answer_gaze = []
        print(f"[GRCDA] Question timer started. Pre-answer phase active.")
        
    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, dict]:
        """
        Process a video frame and extract gaze data
        
        Args:
            frame: BGR image from webcam
            
        Returns:
            Tuple of (annotated_frame, metrics_dict)
        """
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)
        
        h, w, _ = frame.shape
        current_time = time.time()
        
        metrics = {
            'gaze_x': 0.5,
            'gaze_y': 0.5,
            'gaze_score': 0.0,
            'in_pre_answer_phase': False,
            'clusters_detected': 0,
            'suspicious_pattern': False
        }
        
        # Check if we're in pre-answer phase
        if self.question_start_time:
            elapsed = current_time - self.question_start_time
            
            if self.pre_answer_window[0] <= elapsed <= self.pre_answer_window[1]:
                self.is_in_pre_answer_phase = True
                metrics['in_pre_answer_phase'] = True
            elif elapsed > self.pre_answer_window[1]:
                # Pre-answer phase ended, analyze collected data
                if self.is_in_pre_answer_phase:
                    self._analyze_pre_answer_gaze()
                    self.is_in_pre_answer_phase = False
        
        if not results.multi_face_landmarks:
            return frame, metrics
        
        landmarks = results.multi_face_landmarks[0].landmark
        
        # Calculate gaze coordinates
        gaze_x, gaze_y = self._calculate_gaze(landmarks, w, h)
        
        # Store gaze point
        gaze_point = GazePoint(
            x=gaze_x,
            y=gaze_y,
            timestamp=current_time,
            screen_width=w,
            screen_height=h
        )
        
        self.gaze_history.append(gaze_point)
        
        # If in pre-answer phase, collect for clustering analysis
        if self.is_in_pre_answer_phase:
            self.pre_answer_gaze.append(gaze_point)
        
        # Draw gaze visualization
        annotated_frame = self._draw_gaze_overlay(frame, landmarks, gaze_x, gaze_y, w, h)
        
        # Calculate gaze score from recent history
        gaze_score = self._calculate_gaze_anomaly_score()
        
        metrics.update({
            'gaze_x': gaze_x,
            'gaze_y': gaze_y,
            'gaze_score': gaze_score,
            'gaze_points_collected': len(self.pre_answer_gaze)
        })
        
        return annotated_frame, metrics
    
    def _calculate_gaze(self, landmarks, width: int, height: int) -> Tuple[float, float]:
        """
        Calculate normalized gaze coordinates (0-1 range)
        
        Uses iris position relative to eye boundaries
        """
        # Get iris centers
        left_iris_x = np.mean([landmarks[i].x for i in self.LEFT_IRIS])
        left_iris_y = np.mean([landmarks[i].y for i in self.LEFT_IRIS])
        
        right_iris_x = np.mean([landmarks[i].x for i in self.RIGHT_IRIS])
        right_iris_y = np.mean([landmarks[i].y for i in self.RIGHT_IRIS])
        
        # Get eye boundaries
        left_eye_inner = landmarks[self.LEFT_EYE_INNER].x
        left_eye_outer = landmarks[self.LEFT_EYE_OUTER].x
        right_eye_inner = landmarks[self.RIGHT_EYE_INNER].x
        right_eye_outer = landmarks[self.RIGHT_EYE_OUTER].x
        
        left_eye_top = landmarks[self.LEFT_EYE_TOP].y
        left_eye_bottom = landmarks[self.LEFT_EYE_BOTTOM].y
        right_eye_top = landmarks[self.RIGHT_EYE_TOP].y
        right_eye_bottom = landmarks[self.RIGHT_EYE_BOTTOM].y
        
        # Calculate horizontal gaze ratio (0 = looking left, 1 = looking right)
        left_gaze_x = (left_iris_x - left_eye_outer) / (left_eye_inner - left_eye_outer + 1e-6)
        right_gaze_x = (right_iris_x - right_eye_outer) / (right_eye_inner - right_eye_outer + 1e-6)
        gaze_x = (left_gaze_x + right_gaze_x) / 2.0
        
        # Calculate vertical gaze ratio (0 = looking up, 1 = looking down)
        left_gaze_y = (left_iris_y - left_eye_top) / (left_eye_bottom - left_eye_top + 1e-6)
        right_gaze_y = (right_iris_y - right_eye_top) / (right_eye_bottom - right_eye_top + 1e-6)
        gaze_y = (left_gaze_y + right_gaze_y) / 2.0
        
        # Clamp to [0, 1]
        gaze_x = np.clip(gaze_x, 0.0, 1.0)
        gaze_y = np.clip(gaze_y, 0.0, 1.0)
        
        return gaze_x, gaze_y
    
    def _analyze_pre_answer_gaze(self) -> List[GazeCluster]:
        """
        Analyze gaze patterns collected during pre-answer phase using DBSCAN
        
        Returns:
            List of detected gaze clusters
        """
        if len(self.pre_answer_gaze) < self.dbscan_min_samples:
            print(f"[GRCDA] Insufficient gaze points: {len(self.pre_answer_gaze)}")
            return []
        
        # Extract coordinates for clustering
        coordinates = np.array([[gp.x, gp.y] for gp in self.pre_answer_gaze])
        
        # Apply DBSCAN clustering
        clustering = DBSCAN(
            eps=self.dbscan_eps,
            min_samples=self.dbscan_min_samples
        ).fit(coordinates)
        
        labels = clustering.labels_
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        
        print(f"[GRCDA] DBSCAN found {n_clusters} clusters from {len(coordinates)} points")
        
        clusters = []
        
        for cluster_id in set(labels):
            if cluster_id == -1:  # Noise points
                continue
            
            cluster_mask = labels == cluster_id
            cluster_points = coordinates[cluster_mask]
            cluster_times = [self.pre_answer_gaze[i].timestamp for i, m in enumerate(cluster_mask) if m]
            
            # Calculate cluster properties
            center = cluster_points.mean(axis=0)
            density = len(cluster_points)
            duration = max(cluster_times) - min(cluster_times)
            
            # Flag as suspicious if cluster is dense and persistent
            is_suspicious = density >= self.suspicious_cluster_threshold
            
            cluster = GazeCluster(
                center=tuple(center),
                density=density,
                duration=duration,
                is_suspicious=is_suspicious
            )
            
            clusters.append(cluster)
            
            if is_suspicious:
                print(f"[GRCDA] ⚠️ SUSPICIOUS CLUSTER DETECTED!")
                print(f"  - Center: ({center[0]:.3f}, {center[1]:.3f})")
                print(f"  - Density: {density} points")
                print(f"  - Duration: {duration:.2f}s")
        
        return clusters
    
    def _calculate_gaze_anomaly_score(self) -> float:
        """
        Calculate gaze anomaly score based on recent clustering analysis
        
        Returns:
            Score from 0 (normal) to 1 (highly suspicious)
        """
        if len(self.gaze_history) < 20:
            return 0.0
        
        # Use recent gaze history (last 50 points)
        recent_points = list(self.gaze_history)[-50:]
        coordinates = np.array([[gp.x, gp.y] for gp in recent_points])
        
        # Quick DBSCAN on recent data
        clustering = DBSCAN(eps=self.dbscan_eps, min_samples=3).fit(coordinates)
        labels = clustering.labels_
        
        # Count points in largest cluster
        if len(set(labels)) > 1:
            cluster_sizes = [np.sum(labels == i) for i in set(labels) if i != -1]
            if cluster_sizes:
                max_cluster_size = max(cluster_sizes)
                # Normalize: if >70% of points in one cluster, it's suspicious
                score = min(1.0, max_cluster_size / len(recent_points) * 1.5)
                return score
        
        return 0.0
    
    def _draw_gaze_overlay(
        self,
        frame: np.ndarray,
        landmarks,
        gaze_x: float,
        gaze_y: float,
        width: int,
        height: int
    ) -> np.ndarray:
        """Draw gaze tracking visualization on frame"""
        
        # Draw iris positions
        left_iris_x = int(np.mean([landmarks[i].x for i in self.LEFT_IRIS]) * width)
        left_iris_y = int(np.mean([landmarks[i].y for i in self.LEFT_IRIS]) * height)
        right_iris_x = int(np.mean([landmarks[i].x for i in self.RIGHT_IRIS]) * width)
        right_iris_y = int(np.mean([landmarks[i].y for i in self.RIGHT_IRIS]) * height)
        
        # Draw iris circles
        cv2.circle(frame, (left_iris_x, left_iris_y), 3, (0, 255, 255), -1)
        cv2.circle(frame, (right_iris_x, right_iris_y), 3, (0, 255, 255), -1)
        
        # Draw gaze direction vectors
        vector_length = 80
        dx = int((gaze_x - 0.5) * vector_length)
        dy = int((gaze_y - 0.5) * vector_length)
        
        cv2.arrowedLine(
            frame,
            (left_iris_x, left_iris_y),
            (left_iris_x + dx, left_iris_y + dy),
            (255, 0, 255),
            2
        )
        cv2.arrowedLine(
            frame,
            (right_iris_x, right_iris_y),
            (right_iris_x + dx, right_iris_y + dy),
            (255, 0, 255),
            2
        )
        
        # Display gaze coordinates
        cv2.putText(
            frame,
            f"Gaze: ({gaze_x:.2f}, {gaze_y:.2f})",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )
        
        # Show pre-answer phase indicator
        if self.is_in_pre_answer_phase:
            cv2.putText(
                frame,
                "PRE-ANSWER PHASE - MONITORING",
                (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 165, 255),
                2
            )
            cv2.putText(
                frame,
                f"Points: {len(self.pre_answer_gaze)}",
                (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 165, 255),
                2
            )
        
        return frame
    
    def get_final_report(self) -> dict:
        """
        Generate final gaze analysis report
        
        Returns:
            Dictionary with analysis results
        """
        clusters = self._analyze_pre_answer_gaze()
        
        suspicious_clusters = [c for c in clusters if c.is_suspicious]
        
        # Calculate final gaze score
        if suspicious_clusters:
            # Weight by density and duration
            max_density = max(c.density for c in suspicious_clusters)
            max_duration = max(c.duration for c in suspicious_clusters)
            gaze_score = min(1.0, (max_density / 20) * 0.6 + (max_duration / 5) * 0.4)
        else:
            gaze_score = 0.0
        
        return {
            'total_gaze_points': len(self.gaze_history),
            'pre_answer_points': len(self.pre_answer_gaze),
            'clusters_detected': len(clusters),
            'suspicious_clusters': len(suspicious_clusters),
            'gaze_anomaly_score': gaze_score,
            'cluster_details': [
                {
                    'center': c.center,
                    'density': c.density,
                    'duration': c.duration,
                    'suspicious': c.is_suspicious
                }
                for c in clusters
            ]
        }
    
    def reset(self):
        """Reset detector state"""
        self.gaze_history.clear()
        self.pre_answer_gaze = []
        self.question_start_time = None
        self.is_in_pre_answer_phase = False
        print("[GRCDA] Detector reset")


# Demo/Testing function
def demo_grcda():
    """
    Demo function to test GRCDA with webcam
    """
    detector = GRCDADetector()
    cap = cv2.VideoCapture(0)
    
    print("=" * 60)
    print("GRCDA Demo - Gaze Tracking with Overlay Detection")
    print("=" * 60)
    print("Press 'q' to start question timer (Pre-Answer Phase)")
    print("Press 'r' to get report")
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
        
        cv2.imshow('GRCDA - Gaze Tracking', annotated_frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == 27:  # ESC
            break
        elif key == ord('q'):
            detector.start_question_timer()
        elif key == ord('r'):
            report = detector.get_final_report()
            print("\n" + "=" * 60)
            print("GAZE ANALYSIS REPORT")
            print("=" * 60)
            for k, v in report.items():
                if k != 'cluster_details':
                    print(f"{k}: {v}")
            print("=" * 60 + "\n")
    
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    demo_grcda()
