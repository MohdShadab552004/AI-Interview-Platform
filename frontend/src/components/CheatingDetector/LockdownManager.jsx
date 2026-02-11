import React, { useState, useEffect, useCallback } from 'react';
import { FiMaximize, FiAlertTriangle } from 'react-icons/fi';

const LockdownManager = ({ children, isActive, onLockdownViolation }) => {
    const [isViolation, setIsViolation] = useState(false);
    const [violationType, setViolationType] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    const handleViolation = useCallback((type) => {
        if (!isActive) return;
        setIsViolation(true);
        setViolationType(type);
        if (onLockdownViolation) {
            onLockdownViolation({
                type,
                timestamp: new Date().toISOString(),
                severity: 'critical'
            });
        }
    }, [isActive, onLockdownViolation]);

    const requestFullscreen = async () => {
        try {
            const element = document.documentElement;
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }
            setIsViolation(false);
            setViolationType(null);
        } catch (error) {
            console.error('Fullscreen request failed:', error);
        }
    };

    useEffect(() => {
        if (!isActive) return;

        // 1. Fullscreen Monitoring
        const handleFullscreenChange = () => {
            const currentFullscreen = !!document.fullscreenElement;
            setIsFullscreen(currentFullscreen);
            if (!currentFullscreen && isActive) {
                handleViolation('fullscreen_exit');
            }
        };

        // 2. Tab/Window Focus Monitoring
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                handleViolation('tab_switch');
            }
        };

        const handleBlur = () => {
            handleViolation('window_blur');
        };

        // 3. Input Restrictions
        const handleContextMenu = (e) => {
            e.preventDefault();
            handleViolation('right_click');
        };

        const handleCopyPaste = (e) => {
            e.preventDefault();
            handleViolation('clipboard_action');
        };

        const handleKeyDown = (e) => {
            // Block DevTools: Ctrl+Shift+I, F12
            if (
                (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
                (e.keyCode === 123) ||
                (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88)) // Ctrl+C/V/X
            ) {
                e.preventDefault();
                handleViolation('prohibited_shortcut');
            }
        };

        // Attach Listeners
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('copy', handleCopyPaste);
        document.addEventListener('paste', handleCopyPaste);
        document.addEventListener('cut', handleCopyPaste);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('copy', handleCopyPaste);
            document.removeEventListener('paste', handleCopyPaste);
            document.removeEventListener('cut', handleCopyPaste);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isActive, handleViolation]);

    if (isViolation && isActive) {
        return (
            <div className="lockdown-overlay">
                <div className="lockdown-card">
                    <FiAlertTriangle className="lockdown-icon" />
                    <h2>SECURITY VIOLATION</h2>
                    <p className="violation-badge">{violationType?.replace('_', ' ').toUpperCase()}</p>
                    <p className="violation-warning">
                        You have exited the secure interview environment. This incident has been logged.
                        All external AI tools and tab switching are prohibited.
                    </p>
                    <button className="btn-resume-lockdown" onClick={requestFullscreen}>
                        <FiMaximize /> Re-enter Secure Fullscreen
                    </button>
                    <p className="lockdown-footer">Multiple violations may lead to immediate termination of the interview.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default LockdownManager;
