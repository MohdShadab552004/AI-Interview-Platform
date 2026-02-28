import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const WebcamMonitor = ({ videoMetrics, isActive, onViolation }) => {
    const lastFaceDetectedTimeRef = useRef(Date.now());
    const multipleFaceStartTimeRef = useRef(null);
    const lastObjectViolationTimeRef = useRef(0); // Throttle for prohibited object toasts

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

        // 3. Object Detection (ANY object) - throttled to once per 5 seconds
        if (videoMetrics.detectedObjects && videoMetrics.detectedObjects.length > 0) {
            const timeSinceLast = now - lastObjectViolationTimeRef.current;
            if (timeSinceLast > 5000) { // At most once every 5 seconds
                lastObjectViolationTimeRef.current = now;
                onViolation({
                    type: 'prohibited_object',
                    details: `⚠️ Object detected near candidate: ${videoMetrics.detectedObjects.join(', ')} — No objects are allowed during the interview`,
                    severity: 'high'
                });
            }
        }

        // 4. Posture Check - REMOVED per user request
        // if (videoMetrics.posture && videoMetrics.posture.includes('Poor')) {
        //     onViolation({
        //         type: 'poor_posture',
        //         details: 'Please maintain a straight posture (Shoulders tilted)',
        //         severity: 'medium'
        //     });
        // }

        // 5. Excessive Movement Detection
        if (videoMetrics.movementScore > 15) { // Threshold for "Excessive"
            onViolation({
                type: 'excessive_movement',
                details: 'Excessive movement detected. Please stay still.',
                severity: 'medium'
            });
        }

        // 6. Gaze/Head Pose (Suspicious)
        if (videoMetrics.gazePattern === 'extreme_side_gaze') {
            onViolation({
                type: 'extreme_gaze',
                details: 'Extreme retina tilt detected (Possible phone reading)',
                severity: 'critical'
            });
        } else if (videoMetrics.gazePattern === 'suspicious_side' || videoMetrics.gazePattern === 'suspicious_side_eye') {
            // ...existing logic
            if (Math.random() < 0.05) {
                onViolation({
                    type: 'suspicious_gaze',
                    details: 'Frequent looking away detected',
                    severity: 'medium'
                });
            }
        }

        // 7. Asymmetric Eye Detection (One eye hidden)
        if (videoMetrics.eyeSymmetry === 'only_left_visible' || videoMetrics.eyeSymmetry === 'only_right_visible') {
            onViolation({
                type: 'asymmetric_eyes',
                details: 'One eye is not visible. Please face the camera directly.',
                severity: 'high'
            });
        } else if (videoMetrics.eyeSymmetry === 'neither_visible') {
            onViolation({
                type: 'eyes_not_visible',
                details: 'Eyes are not visible. Please adjust your position.',
                severity: 'critical'
            });
        }

        // 8. Off-Center Gaze Detection
        if (videoMetrics.isLookingAtCenter === false && videoMetrics.gazeDeviation > 0.3) {
            onViolation({
                type: 'not_looking_at_camera',
                details: 'Please look at the camera/center of screen.',
                severity: 'medium'
            });
        }

    }, [videoMetrics, isActive, onViolation]);

    return null;
};

export default WebcamMonitor;
