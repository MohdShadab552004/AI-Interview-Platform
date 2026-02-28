import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import BrowserMonitor from './BrowserMonitor';
import WebcamMonitor from './WebcamMonitor';
import AudioMonitor from './AudioMonitor';
import SystemMonitor from './SystemMonitor';
import PatternMonitor from './PatternMonitor';
import toast from 'react-hot-toast';

const CheatingDetectionManager = ({ interviewId, isActive = true, onViolation, videoMetrics, audioLevel, webcamRef }) => {
    const [violations, setViolations] = useState([]);

    // Capture screenshot from webcam
    const captureScreenshot = useCallback(() => {
        if (!webcamRef?.current?.video) return null;

        try {
            const video = webcamRef.current.video;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.8); // Base64 screenshot
        } catch (err) {
            console.error("Failed to capture screenshot:", err);
            return null;
        }
    }, [webcamRef]);

    // Aggregate violation handler
    const handleViolation = useCallback(async (violation) => {
        // Capture screenshot for high/critical violations
        let screenshot = null;
        if (violation.severity === 'critical' || violation.severity === 'high') {
            screenshot = captureScreenshot();
        }

        // Add processed timestamp if missing
        const newViolation = {
            ...violation,
            interviewId,
            detectedAt: new Date().toISOString(),
            screenshot: screenshot
        };

        console.warn("Cheating Violation Detected:", newViolation);

        // Throttle toasts?
        if (violation.severity === 'critical' || violation.severity === 'high') {
            // For prohibited objects, use unique toast id (no dedup) so every detection is visible
            const toastId = violation.type === 'prohibited_object'
                ? `prohibited_${Date.now()}`
                : violation.type;
            toast.error(violation.details, {
                id: toastId,
                duration: violation.type === 'prohibited_object' ? 8000 : 4000
            });
        }

        setViolations(prev => [...prev, newViolation]);

        // Send to Backend
        try {
            await axios.post(`${import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api'}/interview/${interviewId}/cheat-log`, newViolation);
        } catch (err) {
            console.error("Failed to log cheat violation:", err);
        }

        // Notify parent component (InterviewPage) if callback provided
        if (onViolation) {
            onViolation(newViolation);
        }
    }, [interviewId, onViolation]);

    return (
        <>
            <BrowserMonitor onViolation={handleViolation} isActive={isActive} />
            <WebcamMonitor videoMetrics={videoMetrics} onViolation={handleViolation} isActive={isActive} />
            <AudioMonitor audioLevel={audioLevel} onViolation={handleViolation} isActive={isActive} />
            <SystemMonitor onViolation={handleViolation} isActive={isActive} />
            <PatternMonitor onViolation={handleViolation} isActive={isActive} />
        </>
    );
};

export default CheatingDetectionManager;
