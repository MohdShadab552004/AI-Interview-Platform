import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const BrowserMonitor = ({ onViolation, isActive = true }) => {
    const [isFullscreen, setIsFullscreen] = useState(true);

    // 1. Tab Switching Detection
    const handleVisibilityChange = useCallback(() => {
        if (document.hidden && isActive) {
            onViolation({
                type: 'tab_switch',
                timestamp: new Date().toISOString(),
                details: 'User switched tabs'
            });
            toast.error('Warning: Tab switching is monitored!');
            console.log('Tab switch detected');
        }
    }, [isActive, onViolation]);

    // 2. Window Focus/Blur Detection
    const handleWindowBlur = useCallback(() => {
        if (isActive) {
            onViolation({
                type: 'window_blur',
                timestamp: new Date().toISOString(),
                details: 'User switched windows or minimized browser'
            });
            console.log('Window blur detected');
        }
    }, [isActive, onViolation]);

    // 3. Fullscreen Detection
    const handleFullscreenChange = useCallback(() => {
        const isFs = !!document.fullscreenElement;
        setIsFullscreen(isFs);
        if (!isFs && isActive) {
            onViolation({
                type: 'fullscreen_exit',
                timestamp: new Date().toISOString(),
                details: 'User exited fullscreen mode'
            });
            toast.error('Warning: Please stay in fullscreen mode!');
            console.log('Fullscreen exit detected');
        }
    }, [isActive, onViolation]);

    // 4. Keydown Detection (Copy-Paste & DevTools)
    const handleKeyDown = useCallback((e) => {
        if (!isActive) return;

        // Block Copy/Paste
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'C' || e.key === 'V')) {
            e.preventDefault();
            onViolation({
                type: 'copy_paste',
                timestamp: new Date().toISOString(),
                details: `Clipboard shortcut blocked: ${e.ctrlKey ? 'Ctrl' : 'Cmd'}+${e.key.toUpperCase()}`
            });
            toast.error('Copy-Paste is disabled during the interview');
            console.log('Copy-Paste blocked');
        }

        // Block DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J)
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j'))
        ) {
            e.preventDefault();
            onViolation({
                type: 'devtools_open',
                timestamp: new Date().toISOString(),
                details: 'DevTools shortcut attempted'
            });
            toast.error('Developer tools are not allowed');
            console.log('DevTools shortcut blocked');
        }

        // Block Alt+Tab (Alt key press) - Hard to fully block, but we can log
        if (e.key === 'Alt') {
            // Potential window switch preparation
            // We don't block Alt generally as it might be used for other things, but combined with blur it's strong evidence
        }

    }, [isActive, onViolation]);

    // 5. Right Click Disable
    const handleContextMenu = useCallback((e) => {
        if (isActive) {
            e.preventDefault();
            onViolation({
                type: 'right_click',
                timestamp: new Date().toISOString(),
                details: 'Right-click blocked'
            });
        }
    }, [isActive, onViolation]);

    useEffect(() => {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleWindowBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [handleVisibilityChange, handleWindowBlur, handleFullscreenChange, handleKeyDown, handleContextMenu]);

    return null; // This component handles side effects only
};

export default BrowserMonitor;
