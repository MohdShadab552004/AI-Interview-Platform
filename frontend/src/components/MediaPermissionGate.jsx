import React, { useState, useEffect } from 'react';
import { FiVideo, FiMic, FiAlertCircle, FiCheck } from 'react-icons/fi';

const MediaPermissionGate = ({ onPermissionsGranted, children }) => {
    const [permissionStatus, setPermissionStatus] = useState({
        camera: 'pending', // 'pending', 'granted', 'denied'
        microphone: 'pending'
    });
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState(null);

    const requestPermissions = async () => {
        setIsRequesting(true);
        setError(null);

        try {
            // Request both camera and microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true
            });

            // Permissions granted
            setPermissionStatus({
                camera: 'granted',
                microphone: 'granted'
            });

            // Stop the stream immediately (we just needed permissions)
            stream.getTracks().forEach(track => track.stop());

            // Notify parent component
            if (onPermissionsGranted) {
                onPermissionsGranted();
            }
        } catch (err) {
            console.error('Media permission error:', err);

            // Determine which permission was denied
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Camera and microphone access denied. Please allow permissions to continue.');
                setPermissionStatus({
                    camera: 'denied',
                    microphone: 'denied'
                });
            } else if (err.name === 'NotFoundError') {
                setError('Camera or microphone not found. Please connect a device.');
            } else {
                setError(`Error: ${err.message}`);
            }
        } finally {
            setIsRequesting(false);
        }
    };

    // Auto-request on mount
    useEffect(() => {
        requestPermissions();
    }, []);

    // If permissions granted, show children
    if (permissionStatus.camera === 'granted' && permissionStatus.microphone === 'granted') {
        return <>{children}</>;
    }

    // Otherwise show permission request UI
    return (
        <div className="permission-gate-overlay">
            <div className="permission-gate-card">
                <div className="permission-gate-header">
                    <div className="permission-icon">
                        {permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied' ? (
                            <FiAlertCircle style={{ color: '#ef4444' }} />
                        ) : (
                            <FiVideo style={{ color: '#6366f1' }} />
                        )}
                    </div>
                    <h2>Camera & Microphone Access Required</h2>
                    <p>This interview requires access to your camera and microphone for proctoring.</p>
                </div>

                <div className="permission-items">
                    <div className={`permission-item ${permissionStatus.camera === 'granted' ? 'granted' : permissionStatus.camera === 'denied' ? 'denied' : ''}`}>
                        <FiVideo />
                        <span>Camera Access</span>
                        {permissionStatus.camera === 'granted' && <FiCheck className="check-icon" />}
                        {permissionStatus.camera === 'denied' && <FiAlertCircle className="error-icon" />}
                    </div>

                    <div className={`permission-item ${permissionStatus.microphone === 'granted' ? 'granted' : permissionStatus.microphone === 'denied' ? 'denied' : ''}`}>
                        <FiMic />
                        <span>Microphone Access</span>
                        {permissionStatus.microphone === 'granted' && <FiCheck className="check-icon" />}
                        {permissionStatus.microphone === 'denied' && <FiAlertCircle className="error-icon" />}
                    </div>
                </div>

                {error && (
                    <div className="permission-error">
                        <FiAlertCircle />
                        <span>{error}</span>
                    </div>
                )}

                <div className="permission-instructions">
                    <h3>How to enable permissions:</h3>
                    <ol>
                        <li>Click the <strong>"Allow"</strong> button when your browser asks for permissions</li>
                        <li>If you accidentally denied, click the <strong>camera icon</strong> in your browser's address bar</li>
                        <li>Select <strong>"Allow"</strong> for both camera and microphone</li>
                        <li>Refresh this page</li>
                    </ol>
                </div>

                <div className="permission-actions">
                    {(permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied') && (
                        <button className="btn-retry-permissions" onClick={requestPermissions} disabled={isRequesting}>
                            {isRequesting ? 'Requesting...' : 'Retry Permissions'}
                        </button>
                    )}
                    {isRequesting && (
                        <div className="permission-loading">
                            <div className="spinner"></div>
                            <span>Requesting permissions...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaPermissionGate;
