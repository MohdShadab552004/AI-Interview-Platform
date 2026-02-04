import React, { useEffect, useRef } from 'react';

const AudioMonitor = ({ audioLevel, isActive, onViolation }) => {
    // audioLevel is normalized 0 to 1
    const silenceStartTimeRef = useRef(null);
    const whisperStartTimeRef = useRef(null);
    const noiseStartTimeRef = useRef(null);
    const lastViolatedRef = useRef(0);

    useEffect(() => {
        if (!isActive) return;

        const now = Date.now();
        // Throttle checks
        if (now - lastViolatedRef.current < 2000) return;

        // 1. Whispering Detection (Low volume but constant activity)
        // Adjust thresholds based on calibration (ideally)
        // Assuming silence is < 0.02, whispering is 0.02 - 0.15, normal is > 0.15
        if (audioLevel > 0.02 && audioLevel < 0.15) {
            if (!whisperStartTimeRef.current) whisperStartTimeRef.current = now;
            else if (now - whisperStartTimeRef.current > 4000) { // 4 seconds of whispering
                onViolation({
                    type: 'whispering',
                    details: 'Suspicious low volume speech detected (Whispering?)',
                    severity: 'medium'
                });
                whisperStartTimeRef.current = null;
                lastViolatedRef.current = now;
            }
        } else {
            whisperStartTimeRef.current = null;
        }

        // 2. High Background Noise / Multiple Voices (Heuristic)
        // If volume is consistently high during "reading" or "thinking" time (not implemented here per phase, but general check)
        // For now, checks for loud noise spikes
        if (audioLevel > 0.8) {
            if (!noiseStartTimeRef.current) noiseStartTimeRef.current = now;
            else if (now - noiseStartTimeRef.current > 2000) { // 2 seconds of loud noise
                onViolation({
                    type: 'high_noise',
                    details: 'High background noise or multiple voices detected',
                    severity: 'high'
                });
                noiseStartTimeRef.current = null;
                lastViolatedRef.current = now;
            }
        } else {
            noiseStartTimeRef.current = null;
        }

    }, [audioLevel, isActive, onViolation]);

    return null;
};

export default AudioMonitor;
