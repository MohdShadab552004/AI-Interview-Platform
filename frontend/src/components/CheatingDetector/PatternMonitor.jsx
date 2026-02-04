import React, { useEffect, useRef } from 'react';

const PatternMonitor = ({ isActive, onViolation }) => {
    const lastKeyTimeRef = useRef(0);
    const keyTimesRef = useRef([]);
    const violationsRef = useRef(0);

    useEffect(() => {
        if (!isActive) return;

        const handleInput = (e) => {
            // Only monitor text inputs and textareas
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') return;
            if (e.target.type !== 'text' && e.target.tagName === 'INPUT') return;

            // We need to detect "Burst" which is large text change in small time
            // However, 'input' event doesn't give key info easily, 'beforeinput' is better for type
            // But simple heuristic: check length change?
            // Actually, 'keydown' gives us timing, 'input' gives us content change.
        };

        const handleKeyDown = (e) => {
            if (!isActive) return;
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') return;

            const now = Date.now();
            if (lastKeyTimeRef.current > 0) {
                const diff = now - lastKeyTimeRef.current;
                keyTimesRef.current.push(diff);
                if (keyTimesRef.current.length > 50) keyTimesRef.current.shift();
            }
            lastKeyTimeRef.current = now;

            // Check WPM / typing speed
            // Average char time < 50ms = > 1200 CPM ~ 240 WPM (Super human)
            if (keyTimesRef.current.length >= 10) {
                const avg = keyTimesRef.current.reduce((a, b) => a + b, 0) / keyTimesRef.current.length;
                if (avg < 50) { // Very fast typing
                    // Could be a macro or crazy fast typer
                    // throttle
                    if (now - violationsRef.current > 5000) {
                        onViolation({
                            type: 'typing_speed',
                            details: 'Superhuman typing speed detected (Macro/Paste?)',
                            severity: 'medium'
                        });
                        violationsRef.current = now;
                    }
                }
            }
        };

        const handlePaste = (e) => {
            if (!isActive) return;
            // We block paste in BrowserMonitor, but if it slips through (e.g. right click -> paste allowed by browser)
            // We catch it here
            const text = e.clipboardData.getData('text');
            if (text.length > 50) {
                onViolation({
                    type: 'large_paste',
                    details: `Large text paste detected (${text.length} chars)`,
                    severity: 'high'
                });
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('paste', handlePaste); // Global paste listener

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('paste', handlePaste);
        };
    }, [isActive, onViolation]);

    return null;
};

export default PatternMonitor;
