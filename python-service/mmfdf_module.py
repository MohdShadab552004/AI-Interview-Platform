"""
MMFDF Module: Multi-Modal Fusion Detection Framework
Combines multiple detection signals into a unified cheating probability score.

Based on research paper specifications:
- Formula: Final_Score = (0.30 * Gaze) + (0.25 * Timing) + (0.25 * Network) + (0.20 * Audio)
- Threshold: Alert if Final_Score > 0.65
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime
import json


@dataclass
class ModalityScore:
    """Individual modality score with metadata"""
    score: float  # 0-1 range
    confidence: float  # How confident we are in this score
    timestamp: datetime
    details: dict


@dataclass
class FusionResult:
    """Result of multi-modal fusion"""
    final_score: float
    is_suspicious: bool
    modality_scores: Dict[str, float]
    weighted_contributions: Dict[str, float]
    alert_level: str  # 'none', 'low', 'medium', 'high'
    timestamp: datetime


class MMFDFEngine:
    """
    Multi-Modal Fusion Detection Framework
    
    Combines signals from:
    - Gaze tracking (GRCDA)
    - Timing analysis (response patterns)
    - Network monitoring (suspicious traffic)
    - Audio analysis (background voices, stress)
    """
    
    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        alert_threshold: float = 0.65,
        high_alert_threshold: float = 0.85
    ):
        """
        Initialize MMFDF Engine
        
        Args:
            weights: Custom weights for each modality (must sum to 1.0)
            alert_threshold: Threshold for triggering alerts
            high_alert_threshold: Threshold for high-priority alerts
        """
        # Default weights from research paper
        self.weights = weights or {
            'gaze': 0.30,
            'timing': 0.25,
            'network': 0.25,
            'audio': 0.20
        }
        
        # Validate weights
        total_weight = sum(self.weights.values())
        if not np.isclose(total_weight, 1.0):
            raise ValueError(f"Weights must sum to 1.0, got {total_weight}")
        
        self.alert_threshold = alert_threshold
        self.high_alert_threshold = high_alert_threshold
        
        # History tracking
        self.fusion_history: List[FusionResult] = []
        self.max_history = 1000
        
        # Alert tracking
        self.alert_count = 0
        self.high_alert_count = 0
        
    def fuse_scores(
        self,
        gaze_score: float,
        timing_score: float,
        network_score: float,
        audio_score: float,
        confidences: Optional[Dict[str, float]] = None
    ) -> FusionResult:
        """
        Fuse multiple modality scores into final cheating probability
        
        Args:
            gaze_score: Gaze anomaly score (0-1)
            timing_score: Timing anomaly score (0-1)
            network_score: Network anomaly score (0-1)
            audio_score: Audio anomaly score (0-1)
            confidences: Optional confidence values for each modality
            
        Returns:
            FusionResult with final score and alert status
        """
        # Default confidences
        if confidences is None:
            confidences = {
                'gaze': 1.0,
                'timing': 1.0,
                'network': 1.0,
                'audio': 1.0
            }
        
        # Normalize scores to [0, 1]
        scores = {
            'gaze': np.clip(gaze_score, 0.0, 1.0),
            'timing': np.clip(timing_score, 0.0, 1.0),
            'network': np.clip(network_score, 0.0, 1.0),
            'audio': np.clip(audio_score, 0.0, 1.0)
        }
        
        # Calculate weighted contributions
        weighted_contributions = {
            modality: scores[modality] * self.weights[modality] * confidences.get(modality, 1.0)
            for modality in scores
        }
        
        # Calculate final fusion score
        final_score = sum(weighted_contributions.values())
        
        # Normalize by total confidence
        total_confidence = sum(confidences.values())
        if total_confidence > 0:
            final_score = final_score / (total_confidence / 4.0)  # 4 modalities
        
        final_score = np.clip(final_score, 0.0, 1.0)
        
        # Determine alert level
        is_suspicious = final_score > self.alert_threshold
        
        if final_score >= self.high_alert_threshold:
            alert_level = 'high'
            self.high_alert_count += 1
        elif final_score >= self.alert_threshold:
            alert_level = 'medium'
            self.alert_count += 1
        elif final_score >= 0.45:
            alert_level = 'low'
        else:
            alert_level = 'none'
        
        # Create result
        result = FusionResult(
            final_score=final_score,
            is_suspicious=is_suspicious,
            modality_scores=scores,
            weighted_contributions=weighted_contributions,
            alert_level=alert_level,
            timestamp=datetime.now()
        )
        
        # Store in history
        self.fusion_history.append(result)
        if len(self.fusion_history) > self.max_history:
            self.fusion_history.pop(0)
        
        return result
    
    def get_temporal_trend(self, window_size: int = 10) -> Dict[str, float]:
        """
        Analyze temporal trends in fusion scores
        
        Args:
            window_size: Number of recent results to analyze
            
        Returns:
            Dictionary with trend statistics
        """
        if len(self.fusion_history) < 2:
            return {
                'trend': 'insufficient_data',
                'average_score': 0.0,
                'score_variance': 0.0,
                'is_escalating': False
            }
        
        recent_results = self.fusion_history[-window_size:]
        scores = [r.final_score for r in recent_results]
        
        avg_score = np.mean(scores)
        variance = np.var(scores)
        
        # Check if scores are escalating
        if len(scores) >= 3:
            first_half_avg = np.mean(scores[:len(scores)//2])
            second_half_avg = np.mean(scores[len(scores)//2:])
            is_escalating = second_half_avg > first_half_avg + 0.1
        else:
            is_escalating = False
        
        # Determine trend
        if is_escalating:
            trend = 'escalating'
        elif avg_score > self.alert_threshold:
            trend = 'sustained_high'
        elif variance > 0.1:
            trend = 'volatile'
        else:
            trend = 'stable'
        
        return {
            'trend': trend,
            'average_score': float(avg_score),
            'score_variance': float(variance),
            'is_escalating': is_escalating,
            'recent_scores': scores
        }
    
    def get_dominant_modality(self) -> Dict[str, any]:
        """
        Identify which modality is contributing most to alerts
        
        Returns:
            Dictionary with dominant modality analysis
        """
        if not self.fusion_history:
            return {'dominant_modality': 'none', 'contribution': 0.0}
        
        # Analyze recent suspicious events
        suspicious_results = [r for r in self.fusion_history if r.is_suspicious]
        
        if not suspicious_results:
            return {'dominant_modality': 'none', 'contribution': 0.0}
        
        # Aggregate contributions
        modality_totals = {
            'gaze': 0.0,
            'timing': 0.0,
            'network': 0.0,
            'audio': 0.0
        }
        
        for result in suspicious_results:
            for modality, contribution in result.weighted_contributions.items():
                modality_totals[modality] += contribution
        
        # Find dominant
        dominant_modality = max(modality_totals, key=modality_totals.get)
        total_contribution = sum(modality_totals.values())
        
        return {
            'dominant_modality': dominant_modality,
            'contribution': modality_totals[dominant_modality],
            'percentage': (modality_totals[dominant_modality] / total_contribution * 100) if total_contribution > 0 else 0,
            'all_contributions': modality_totals
        }
    
    def generate_alert_message(self, result: FusionResult) -> str:
        """
        Generate human-readable alert message
        
        Args:
            result: FusionResult to generate message for
            
        Returns:
            Alert message string
        """
        if result.alert_level == 'none':
            return "No suspicious activity detected."
        
        # Find top contributing modalities
        sorted_contributions = sorted(
            result.weighted_contributions.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        top_modality, top_contribution = sorted_contributions[0]
        
        messages = {
            'gaze': "Suspicious gaze patterns detected (possible overlay reading)",
            'timing': "Unusual response timing patterns detected",
            'network': "Suspicious network activity detected",
            'audio': "Unusual audio patterns detected (background voices/stress)"
        }
        
        alert_msg = f"⚠️ ALERT [{result.alert_level.upper()}] - Cheating Probability: {result.final_score:.1%}\n"
        alert_msg += f"Primary Concern: {messages.get(top_modality, 'Unknown')}\n"
        alert_msg += f"Contributing Factors:\n"
        
        for modality, contribution in sorted_contributions:
            if contribution > 0.05:  # Only show significant contributors
                percentage = (contribution / result.final_score * 100) if result.final_score > 0 else 0
                alert_msg += f"  - {modality.capitalize()}: {result.modality_scores[modality]:.2f} ({percentage:.0f}%)\n"
        
        return alert_msg
    
    def get_statistics(self) -> Dict[str, any]:
        """
        Get comprehensive statistics about fusion performance
        
        Returns:
            Dictionary with statistics
        """
        if not self.fusion_history:
            return {
                'total_analyses': 0,
                'alert_rate': 0.0,
                'average_score': 0.0
            }
        
        total = len(self.fusion_history)
        suspicious = sum(1 for r in self.fusion_history if r.is_suspicious)
        
        scores = [r.final_score for r in self.fusion_history]
        
        return {
            'total_analyses': total,
            'total_alerts': self.alert_count,
            'high_alerts': self.high_alert_count,
            'alert_rate': suspicious / total if total > 0 else 0,
            'average_score': float(np.mean(scores)),
            'max_score': float(np.max(scores)),
            'min_score': float(np.min(scores)),
            'std_deviation': float(np.std(scores)),
            'current_trend': self.get_temporal_trend()['trend']
        }
    
    def export_report(self, filepath: str):
        """
        Export detailed analysis report to JSON
        
        Args:
            filepath: Path to save JSON report
        """
        report = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'total_analyses': len(self.fusion_history),
                'weights': self.weights,
                'thresholds': {
                    'alert': self.alert_threshold,
                    'high_alert': self.high_alert_threshold
                }
            },
            'statistics': self.get_statistics(),
            'dominant_modality': self.get_dominant_modality(),
            'temporal_trend': self.get_temporal_trend(),
            'history': [
                {
                    'timestamp': r.timestamp.isoformat(),
                    'final_score': r.final_score,
                    'alert_level': r.alert_level,
                    'modality_scores': r.modality_scores,
                    'weighted_contributions': r.weighted_contributions
                }
                for r in self.fusion_history
            ]
        }
        
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"[MMFDF] Report exported to {filepath}")
    
    def reset(self):
        """Reset engine state"""
        self.fusion_history.clear()
        self.alert_count = 0
        self.high_alert_count = 0
        print("[MMFDF] Engine reset")


# Demo/Testing function
def demo_mmfdf():
    """
    Demo function to test MMFDF fusion engine
    """
    print("=" * 60)
    print("MMFDF Demo - Multi-Modal Fusion Engine")
    print("=" * 60)
    
    engine = MMFDFEngine()
    
    # Simulate different scenarios
    scenarios = [
        {
            'name': 'Normal Behavior',
            'gaze': 0.1, 'timing': 0.15, 'network': 0.05, 'audio': 0.1
        },
        {
            'name': 'Suspicious Gaze (Overlay Reading)',
            'gaze': 0.85, 'timing': 0.2, 'network': 0.1, 'audio': 0.15
        },
        {
            'name': 'Network Cheating',
            'gaze': 0.3, 'timing': 0.4, 'network': 0.9, 'audio': 0.2
        },
        {
            'name': 'Multiple Violations',
            'gaze': 0.75, 'timing': 0.7, 'network': 0.65, 'audio': 0.8
        },
        {
            'name': 'Borderline Case',
            'gaze': 0.5, 'timing': 0.6, 'network': 0.4, 'audio': 0.55
        }
    ]
    
    for scenario in scenarios:
        print(f"\n{'='*60}")
        print(f"Scenario: {scenario['name']}")
        print(f"{'='*60}")
        
        result = engine.fuse_scores(
            gaze_score=scenario['gaze'],
            timing_score=scenario['timing'],
            network_score=scenario['network'],
            audio_score=scenario['audio']
        )
        
        print(f"\nFinal Score: {result.final_score:.3f}")
        print(f"Alert Level: {result.alert_level.upper()}")
        print(f"Suspicious: {result.is_suspicious}")
        print(f"\nModality Scores:")
        for modality, score in result.modality_scores.items():
            contribution = result.weighted_contributions[modality]
            print(f"  {modality.capitalize():12s}: {score:.3f} (weighted: {contribution:.3f})")
        
        print(f"\n{engine.generate_alert_message(result)}")
    
    # Show statistics
    print(f"\n{'='*60}")
    print("OVERALL STATISTICS")
    print(f"{'='*60}")
    stats = engine.get_statistics()
    for key, value in stats.items():
        if key != 'current_trend':
            print(f"{key}: {value}")
    
    # Show dominant modality
    print(f"\n{'='*60}")
    print("DOMINANT MODALITY ANALYSIS")
    print(f"{'='*60}")
    dominant = engine.get_dominant_modality()
    for key, value in dominant.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    demo_mmfdf()
