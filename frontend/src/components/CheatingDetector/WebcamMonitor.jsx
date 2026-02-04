import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const WebcamMonitor = ({ videoMetrics, isActive, onViolation }) => {
    const lastFaceDetectedTimeRef = useRef(Date.now());
    const multipleFaceStartTimeRef = useRef(null);

    useEffect(() => {
        if (!isActive || !videoMetrics) return;

        const now = Date.now();

        // 1. Face Presence Detection
        if (videoMetrics.faceDetected) {
            lastFaceDetectedTimeRef.current = now;
        } else {
            // If face missing for > 3 seconds
            if (now - lastFaceDetectedTimeRef.current > 3000) {
                onViolation({
                    type: 'no_face',
                    details: 'Candidate face not visible for > 3 seconds',
                    severity: 'high'
                });
                // Reset timer to avoid spamming every frame, but maybe keep alerting? 
                // For now, let's reset to allow another 3s grace period or we can throttle alerts in Manager.
                lastFaceDetectedTimeRef.current = now;
            }
        }

        // 2. Multiple Faces Detection
        if (videoMetrics.faceCount > 1) {
            if (!multipleFaceStartTimeRef.current) {
                multipleFaceStartTimeRef.current = now;
            } else if (now - multipleFaceStartTimeRef.current > 1000) { // 1 second persistence
                onViolation({
                    type: 'multiple_faces',
                    details: `Multiple faces detected (${videoMetrics.faceCount})`,
                    severity: 'critical'
                });
                multipleFaceStartTimeRef.current = null; // Reset
            }
        } else {
            multipleFaceStartTimeRef.current = null;
        }

        // 3. Object Detection (Cell phone, etc.)
        if (videoMetrics.detectedObjects && videoMetrics.detectedObjects.length > 0) {
            // Immediate violation for prohibited objects
            onViolation({
                type: 'prohibited_object',
                details: `Detected prohibited object: ${videoMetrics.detectedObjects.join(', ')}`,
                severity: 'high'
            });
        }

        // 4. Gaze/Head Pose (Suspicious)
        if (videoMetrics.gazePattern === 'suspicious_side' || videoMetrics.gazePattern === 'suspicious_side_eye') {
            // We might want to throttle this significantly as it can change rapidly
            // Let's assume onViolation/Manager handles some throttling or we do it here.
            // For now, let's treat it as a warning if it persists, but MediaAnalyzer already calculates pattern over history.
            // We'll log it occasionally.
            if (Math.random() < 0.05) { // 5% chance per frame (approx once per sec at 20fps) - naive throttling
                onViolation({
                    type: 'suspicious_gaze',
                    details: 'Frequent looking away detected',
                    severity: 'medium'
                });
            }
        }

    }, [videoMetrics, isActive, onViolation]);

    return null;
};

export default WebcamMonitor;
