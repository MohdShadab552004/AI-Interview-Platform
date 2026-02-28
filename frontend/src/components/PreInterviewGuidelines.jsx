import React from 'react';
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiEye, FiMonitor } from 'react-icons/fi';

const PreInterviewGuidelines = ({ onAccept }) => {
    return (
        <div className="guidelines-overlay">
            <div className="guidelines-card">
                <div className="guidelines-header">
                    <FiEye className="guidelines-icon" />
                    <h2>Interview Guidelines & AI Proctoring</h2>
                    <p>Please read carefully before starting your interview</p>
                </div>

                <div className="guidelines-content">
                    {/* DO's Section */}
                    <div className="guidelines-section do-section">
                        <h3><FiCheckCircle /> What TO DO</h3>
                        <ul>
                            <li>✅ Sit in a well-lit room with light in front of you</li>
                            <li>✅ Keep your face centered and visible at all times</li>
                            <li>✅ Look directly at the camera when speaking</li>
                            <li>✅ Maintain good posture with straight shoulders</li>
                            <li>✅ Stay in fullscreen mode throughout the interview</li>
                            <li>✅ Keep your hands visible on the desk</li>
                            <li>✅ Ensure stable internet connection</li>
                        </ul>
                    </div>

                    {/* DON'Ts Section */}
                    <div className="guidelines-section dont-section">
                        <h3><FiXCircle /> What NOT TO DO</h3>
                        <ul>
                            <li>❌ Do NOT switch tabs or minimize the browser</li>
                            <li>❌ Do NOT use external devices (phones, tablets, second monitors)</li>
                            <li>❌ Do NOT have books, papers, or notes visible</li>
                            <li>❌ Do NOT have ANY objects (phones, cups, bottles, remotes, etc.) visible on camera — all objects are flagged as violations</li>
                            <li>❌ Do NOT look away from the screen for extended periods</li>
                            <li>❌ Do NOT have multiple people in the room</li>
                            <li>❌ Do NOT use copy/paste or external AI tools</li>
                            <li>❌ Do NOT exit fullscreen mode</li>
                        </ul>
                    </div>

                    {/* AI Monitoring Section */}
                    <div className="guidelines-section ai-section">
                        <h3><FiMonitor /> AI Proctoring System</h3>
                        <div className="ai-features">
                            <div className="ai-feature">
                                <strong>👁️ Gaze Tracking</strong>
                                <p>Advanced eye movement analysis detects reading from hidden screens</p>
                            </div>
                            <div className="ai-feature">
                                <strong>📱 Object Detection</strong>
                                <p>AI detects ANY object near the candidate — no objects of any kind are permitted during the interview</p>
                            </div>
                            <div className="ai-feature">
                                <strong>🧍 Posture Monitoring</strong>
                                <p>Body position and movement tracking</p>
                            </div>
                            <div className="ai-feature">
                                <strong>💓 Stress Analysis</strong>
                                <p>Physiological indicators monitored for authenticity</p>
                            </div>
                            <div className="ai-feature">
                                <strong>🔒 Lockdown Mode</strong>
                                <p>Fullscreen enforcement and tab switching detection</p>
                            </div>
                        </div>
                    </div>

                    {/* Warning Section */}
                    <div className="guidelines-warning">
                        <FiAlertTriangle />
                        <div>
                            <strong>Important:</strong> All violations are logged and reviewed. Multiple violations may result in immediate interview termination and disqualification.
                        </div>
                    </div>
                </div>

                <div className="guidelines-footer">
                    <button className="btn-accept-guidelines" onClick={onAccept}>
                        I Understand & Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreInterviewGuidelines;
