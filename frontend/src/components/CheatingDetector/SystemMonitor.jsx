import React, { useEffect, useState } from 'react';

const SystemMonitor = ({ isActive, onViolation }) => {
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (!isActive || checked) return;

        const checkSystem = async () => {
            // 1. Multiple Monitors Detection (Experimental)
            if (window.screen.isExtended === true) {
                onViolation({
                    type: 'multiple_monitors',
                    details: 'Multiple monitors detected',
                    severity: 'critical'
                });
            } else if (window.screen.availWidth > window.screen.width) {
                // Classic heuristic for extended display
                onViolation({
                    type: 'multiple_monitors',
                    details: 'Screen width suggests extended display',
                    severity: 'high'
                });
            }

            // 2. VM / Screen Sharing Detection
            // Heuristic: specific resolutions or low hardware concurrency
            const { width, height } = window.screen;
            // Common default VM resolutions
            const isSuspiciousRes = (width === 800 && height === 600) || (width === 1024 && height === 768);

            // Check for WebGL Renderer (often reveals VM driver)
            const getWebGLRenderer = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const gl = canvas.getContext('webgl');
                    if (!gl) return null;
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                } catch (e) {
                    return null;
                }
            };

            const renderer = getWebGLRenderer();
            const isVM = renderer && (renderer.includes('VMware') || renderer.includes('VirtualBox') || renderer.includes('SwiftShader'));

            if (isVM) {
                onViolation({
                    type: 'virtual_machine',
                    details: `Virtual Machine Usage Detected: ${renderer}`,
                    severity: 'high'
                });
            }

            if (isSuspiciousRes && navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
                // Low core count + old resolution = likely VM
                onViolation({
                    type: 'suspicious_environment',
                    details: 'System environment looks suspicious (VM?)',
                    severity: 'medium'
                });
            }

            setChecked(true); // Don't check constantly, maybe once per session or on resize
        };

        checkSystem();

        // Optional: Listen for screen changes
        const handleResize = () => {
            // Re-check logic if needed
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);

    }, [isActive, checked, onViolation]);

    return null;
};

export default SystemMonitor;
