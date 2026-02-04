"""
IAIS - Intelligent AI-Powered Interview System
Main integration module combining all detection systems.

Modules:
1. GRCDA - Gaze-Reference Correlation Detection
2. MMFDF - Multi-Modal Fusion Detection Framework
3. CCAQE - Context-Aware Adaptive Questioning Engine
4. SAFAS - Stress-Aware Fairness Adjustment System
5. Network Monitor - Network Traffic Analysis
"""

import cv2
import numpy as np
from typing import Optional, Dict, List
from datetime import datetime
import json
import os

# Import all modules
from grcda_module import GRCDADetector
from mmfdf_module import MMFDFEngine
from ccaqe_module import CCAQEEngine
from safas_module import SAFASDetector
from network_monitor import NetworkMonitor


class IAISPlatform:
    """
    Intelligent AI-Powered Interview System
    
    Complete interview proctoring and adaptive questioning platform
    integrating all research paper modules.
    """
    
    def __init__(
        self,
        openrouter_api_key: str,
        enable_network_monitoring: bool = False,
        model: str = "anthropic/claude-3-haiku"
    ):
        """
        Initialize IAIS Platform
        
        Args:
            openrouter_api_key: OpenRouter API key for question generation
            enable_network_monitoring: Enable network monitoring (requires admin)
            model: OpenRouter model to use (default: Claude 3 Haiku)
        """
        print("=" * 70)
        print("Initializing IAIS - Intelligent AI-Powered Interview System")
        print("=" * 70)
        
        # Initialize all modules
        print("\n[1/5] Initializing GRCDA (Gaze Tracking)...")
        self.grcda = GRCDADetector()
        
        print("[2/5] Initializing MMFDF (Multi-Modal Fusion)...")
        self.mmfdf = MMFDFEngine()
        
        print("[3/5] Initializing CCAQE (Adaptive Questioning)...")
        self.ccaqe = CCAQEEngine(openrouter_api_key=openrouter_api_key, model=model)
        
        print("[4/5] Initializing SAFAS (Stress & Fairness)...")
        self.safas = SAFASDetector()
        
        print("[5/5] Initializing Network Monitor...")
        self.network_monitor = NetworkMonitor(monitoring_enabled=enable_network_monitoring)
        
        # Interview state
        self.interview_active = False
        self.current_question = None
        self.question_start_time = None
        
        # Session data
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_data = {
            'start_time': None,
            'end_time': None,
            'candidate_info': {},
            'questions_asked': [],
            'fusion_results': [],
            'final_report': {}
        }
        
        print("\n✓ IAIS Platform initialized successfully!")
        print("=" * 70 + "\n")
    
    def start_interview(
        self,
        resume_path: str,
        job_description: str,
        candidate_info: Optional[Dict] = None
    ):
        """
        Start a new interview session
        
        Args:
            resume_path: Path to candidate's PDF resume
            job_description: Job description text
            candidate_info: Optional candidate information
        """
        print("\n" + "=" * 70)
        print("STARTING INTERVIEW SESSION")
        print("=" * 70)
        
        self.interview_active = True
        self.session_data['start_time'] = datetime.now().isoformat()
        self.session_data['candidate_info'] = candidate_info or {}
        
        # Start network monitoring
        self.network_monitor.start_monitoring()
        
        # Parse resume and generate questions
        print("\n[1/2] Parsing resume...")
        resume_text = self.ccaqe.extract_text_from_pdf(resume_path)
        resume_data = self.ccaqe.parse_resume(resume_text)
        
        print("[2/2] Generating adaptive questions...")
        questions = self.ccaqe.generate_questions(
            resume_data,
            job_description,
            num_questions=10
        )
        
        print(f"\n✓ Interview ready with {len(questions)} questions")
        print("=" * 70 + "\n")
        
        return questions
    
    def ask_next_question(self):
        """
        Get and present the next adaptive question
        
        Returns:
            Question object or None if no more questions
        """
        self.current_question = self.ccaqe.select_next_question()
        
        if self.current_question:
            self.question_start_time = datetime.now()
            
            # Start GRCDA pre-answer phase monitoring
            self.grcda.start_question_timer()
            
            print(f"\n{'='*70}")
            print(f"QUESTION [{self.current_question.difficulty.name}]")
            print(f"{'='*70}")
            print(f"{self.current_question.question_text}")
            print(f"{'='*70}\n")
            
            self.session_data['questions_asked'].append({
                'question_id': self.current_question.id,
                'question_text': self.current_question.question_text,
                'difficulty': self.current_question.difficulty.name,
                'asked_at': self.question_start_time.isoformat()
            })
        
        return self.current_question
    
    def process_video_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Process video frame through all detection modules
        
        Args:
            frame: BGR video frame from webcam
            
        Returns:
            Annotated frame with all visualizations
        """
        # Process through GRCDA (Gaze Tracking)
        gaze_frame, gaze_metrics = self.grcda.process_frame(frame)
        
        # Process through SAFAS (Stress Detection)
        stress_frame, stress_metrics = self.safas.process_frame(frame)
        
        # Combine visualizations (use gaze_frame as base, add stress overlay)
        combined_frame = gaze_frame.copy()
        
        # Add stress indicator in top-right corner
        h, w = combined_frame.shape[:2]
        stress_level = stress_metrics.get('stress_level', 0.0)
        
        # Draw combined status
        status_y = h - 40
        cv2.putText(
            combined_frame,
            f"Gaze Score: {gaze_metrics.get('gaze_score', 0.0):.2f} | Stress: {stress_level:.2f}",
            (10, status_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )
        
        return combined_frame
    
    def submit_answer(self, answer_text: str):
        """
        Submit answer to current question and evaluate
        
        Args:
            answer_text: Candidate's answer
        """
        if not self.current_question or not self.question_start_time:
            print("⚠️ No active question")
            return
        
        # Calculate response time
        response_time = (datetime.now() - self.question_start_time).total_seconds()
        
        print(f"\n{'='*70}")
        print("EVALUATING ANSWER...")
        print(f"{'='*70}")
        
        # Evaluate response using CCAQE
        evaluation = self.ccaqe.evaluate_response(
            self.current_question,
            answer_text,
            response_time
        )
        
        # Get current stress level from SAFAS
        stress_level = self.safas.current_stress_level
        
        # Apply fairness adjustment if stressed
        fairness_adjustment = self.safas.apply_fairness_adjustment(
            evaluation.correctness_score,
            context=f"Question {self.current_question.id}"
        )
        
        # Calculate timing score (based on response time)
        # Optimal time: 30-120 seconds
        if 30 <= response_time <= 120:
            timing_score = 0.1  # Normal timing
        elif response_time < 10:
            timing_score = 0.8  # Too fast (suspicious)
        elif response_time > 300:
            timing_score = 0.6  # Too slow (possible searching)
        else:
            timing_score = 0.3
        
        # Get network score
        network_score = self.network_monitor.get_network_score()
        
        # Get gaze score from GRCDA
        gaze_report = self.grcda.get_final_report()
        gaze_score = gaze_report.get('gaze_anomaly_score', 0.0)
        
        # Audio score (placeholder - would come from audio analysis)
        audio_score = 0.1  # Default low score
        
        # Fuse all scores using MMFDF
        fusion_result = self.mmfdf.fuse_scores(
            gaze_score=gaze_score,
            timing_score=timing_score,
            network_score=network_score,
            audio_score=audio_score
        )
        
        # Store fusion result
        self.session_data['fusion_results'].append({
            'question_id': self.current_question.id,
            'timestamp': datetime.now().isoformat(),
            'evaluation': {
                'original_score': evaluation.correctness_score,
                'adjusted_score': fairness_adjustment.adjusted_score,
                'response_time': response_time
            },
            'fusion': {
                'final_score': fusion_result.final_score,
                'alert_level': fusion_result.alert_level,
                'modality_scores': fusion_result.modality_scores
            }
        })
        
        # Display results
        print(f"\nResponse Time: {response_time:.1f}s")
        print(f"Correctness Score: {evaluation.correctness_score:.2f}")
        print(f"Stress-Adjusted Score: {fairness_adjustment.adjusted_score:.2f}")
        print(f"\n{self.mmfdf.generate_alert_message(fusion_result)}")
        print(f"{'='*70}\n")
        
        # Reset for next question
        self.current_question = None
        self.question_start_time = None
    
    def end_interview(self):
        """End interview session and generate final report"""
        print("\n" + "=" * 70)
        print("ENDING INTERVIEW SESSION")
        print("=" * 70)
        
        self.interview_active = False
        self.session_data['end_time'] = datetime.now().isoformat()
        
        # Stop network monitoring
        self.network_monitor.stop_monitoring()
        
        # Generate comprehensive report
        print("\nGenerating final report...")
        
        final_report = {
            'session_id': self.session_id,
            'session_duration': self._calculate_duration(),
            'grcda_report': self.grcda.get_final_report(),
            'safas_report': self.safas.get_stress_report(),
            'ccaqe_report': self.ccaqe.get_performance_summary(),
            'mmfdf_statistics': self.mmfdf.get_statistics(),
            'network_statistics': self.network_monitor.get_statistics(),
            'overall_assessment': self._generate_overall_assessment()
        }
        
        self.session_data['final_report'] = final_report
        
        # Save report
        report_path = f"interview_report_{self.session_id}.json"
        with open(report_path, 'w') as f:
            json.dump(self.session_data, f, indent=2)
        
        print(f"\n✓ Final report saved to: {report_path}")
        print("=" * 70 + "\n")
        
        return final_report
    
    def _calculate_duration(self) -> str:
        """Calculate interview duration"""
        if self.session_data['start_time'] and self.session_data['end_time']:
            start = datetime.fromisoformat(self.session_data['start_time'])
            end = datetime.fromisoformat(self.session_data['end_time'])
            duration = end - start
            return str(duration)
        return "Unknown"
    
    def _generate_overall_assessment(self) -> Dict[str, any]:
        """Generate overall candidate assessment"""
        mmfdf_stats = self.mmfdf.get_statistics()
        ccaqe_summary = self.ccaqe.get_performance_summary()
        safas_report = self.safas.get_stress_report()
        
        # Calculate overall integrity score (inverse of cheating probability)
        avg_fusion_score = mmfdf_stats.get('average_score', 0.0)
        integrity_score = 1.0 - avg_fusion_score
        
        # Calculate performance score
        performance_score = ccaqe_summary.get('average_score', 0.0)
        
        # Determine recommendation
        if integrity_score >= 0.7 and performance_score >= 0.7:
            recommendation = "STRONG HIRE"
        elif integrity_score >= 0.5 and performance_score >= 0.6:
            recommendation = "HIRE"
        elif integrity_score >= 0.4:
            recommendation = "MAYBE"
        else:
            recommendation = "DO NOT HIRE - Integrity Concerns"
        
        return {
            'integrity_score': integrity_score,
            'performance_score': performance_score,
            'stress_level': safas_report.get('average_stress_level', 0.0),
            'recommendation': recommendation,
            'total_alerts': mmfdf_stats.get('total_alerts', 0),
            'high_alerts': mmfdf_stats.get('high_alerts', 0)
        }
    
    def display_live_dashboard(self, frame: np.ndarray) -> np.ndarray:
        """
        Display live monitoring dashboard on video frame
        
        Args:
            frame: Video frame
            
        Returns:
            Frame with dashboard overlay
        """
        h, w = frame.shape[:2]
        
        # Create semi-transparent overlay
        overlay = frame.copy()
        
        # Dashboard background
        cv2.rectangle(overlay, (10, 10), (w-10, 200), (0, 0, 0), -1)
        frame = cv2.addWeighted(overlay, 0.3, frame, 0.7, 0)
        
        # Title
        cv2.putText(
            frame,
            "IAIS - Live Monitoring Dashboard",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2
        )
        
        # Current metrics
        y = 70
        metrics = [
            f"Gaze Score: {self.grcda._calculate_gaze_anomaly_score():.2f}",
            f"Stress Level: {self.safas.current_stress_level:.2f}",
            f"Network Score: {self.network_monitor.get_network_score():.2f}",
            f"Questions Asked: {len(self.ccaqe.asked_questions)}"
        ]
        
        for metric in metrics:
            cv2.putText(
                frame,
                metric,
                (20, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                1
            )
            y += 30
        
        return frame


# Main demo function
def main():
    """
    Main demo of complete IAIS system
    """
    print("\n" + "=" * 70)
    print("IAIS PLATFORM - COMPLETE SYSTEM DEMO")
    print("=" * 70)
    
    # Get OpenRouter API key
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        print("\n⚠️ OPENROUTER_API_KEY not set!")
        print("Please set it: set OPENROUTER_API_KEY='your-key-here'")
        print("\nRunning limited demo without question generation...")
        api_key = "DEMO_MODE"
    
    # Initialize platform
    iais = IAISPlatform(
        openrouter_api_key=api_key,
        enable_network_monitoring=True
    )
    
    print("\n[DEMO MODE]")
    print("This demo shows the integrated system.")
    print("For full functionality, provide:")
    print("  1. Resume PDF path")
    print("  2. Job description")
    print("  3. Gemini API key")
    
    print("\n" + "=" * 70)
    print("Press 'q' to start question")
    print("Press 'a' to submit answer")
    print("Press 'r' to generate report")
    print("Press 'ESC' to exit")
    print("=" * 70 + "\n")
    
    # Start webcam
    cap = cv2.VideoCapture(0)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Process frame through all modules
        processed_frame = iais.process_video_frame(frame)
        
        # Add dashboard
        dashboard_frame = iais.display_live_dashboard(processed_frame)
        
        cv2.imshow('IAIS Platform - Live Interview', dashboard_frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        if key == 27:  # ESC
            break
        elif key == ord('q'):
            # Simulate question (in real system, this comes from CCAQE)
            print("\n[SIMULATED] Question asked - Pre-answer monitoring active")
            iais.grcda.start_question_timer()
        elif key == ord('a'):
            # Simulate answer submission
            print("\n[SIMULATED] Answer submitted - Analyzing...")
        elif key == ord('r'):
            # Generate report
            print("\n[GENERATING REPORT]")
            grcda_report = iais.grcda.get_final_report()
            safas_report = iais.safas.get_stress_report()
            network_stats = iais.network_monitor.get_statistics()
            
            print("\n" + "=" * 70)
            print("SYSTEM STATUS REPORT")
            print("=" * 70)
            print(f"\nGRCDA (Gaze): {grcda_report.get('gaze_anomaly_score', 0):.2f}")
            print(f"SAFAS (Stress): {safas_report.get('current_stress_level', 0):.2f}")
            print(f"Network Score: {network_stats.get('network_score', 0):.2f}")
            print("=" * 70 + "\n")
    
    cap.release()
    cv2.destroyAllWindows()
    
    print("\n✓ IAIS Demo completed")


if __name__ == "__main__":
    main()
