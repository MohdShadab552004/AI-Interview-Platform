import React from 'react';
import { FiAlertTriangle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import './ViolationMetrics.css';

const ViolationMetrics = ({ violations = [], riskScore = 0 }) => {
    if (!violations || violations.length === 0) {
        return (
            <div className="violation-metrics clean">
                <div className="clean-badge">
                    <FiInfo size={24} />
                    <h3>No Violations Detected</h3>
                    <p>Clean interview session</p>
                </div>
            </div>
        );
    }

    // Group violations by type
    const violationsByType = violations.reduce((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
    }, {});

    // Count by severity
    const severityCounts = violations.reduce((acc, v) => {
        acc[v.severity] = (acc[v.severity] || 0) + 1;
        return acc;
    }, {});

    // Get violations with screenshots
    const evidenceViolations = violations.filter(v => v.screenshot);

    return (
        <div className="violation-metrics">
            <div className="metrics-header">
                <h2>Cheating Detection Report</h2>
                <div className={`risk-score ${riskScore > 50 ? 'high' : riskScore > 20 ? 'medium' : 'low'}`}>
                    Risk Score: {riskScore}
                </div>
            </div>

            <div className="severity-summary">
                {severityCounts.critical && (
                    <div className="severity-item critical">
                        <FiAlertTriangle size={20} />
                        <span>{severityCounts.critical} Critical</span>
                    </div>
                )}
                {severityCounts.high && (
                    <div className="severity-item high">
                        <FiAlertCircle size={20} />
                        <span>{severityCounts.high} High</span>
                    </div>
                )}
                {severityCounts.medium && (
                    <div className="severity-item medium">
                        <FiInfo size={20} />
                        <span>{severityCounts.medium} Medium</span>
                    </div>
                )}
            </div>

            <div className="violation-types">
                <h3>Violation Breakdown</h3>
                <div className="types-grid">
                    {Object.entries(violationsByType).map(([type, count]) => (
                        <div key={type} className="type-card">
                            <div className="type-name">{type.replace(/_/g, ' ')}</div>
                            <div className="type-count">{count}</div>
                        </div>
                    ))}
                </div>
            </div>

            {evidenceViolations.length > 0 && (
                <div className="evidence-section">
                    <h3>Evidence Screenshots ({evidenceViolations.length})</h3>
                    <div className="screenshots-grid">
                        {evidenceViolations.map((v, idx) => (
                            <div key={idx} className="screenshot-card">
                                <img src={v.screenshot} alt={`Evidence ${idx + 1}`} />
                                <div className="screenshot-info">
                                    <div className="screenshot-type">{v.type.replace(/_/g, ' ')}</div>
                                    <div className="screenshot-time">
                                        {new Date(v.detectedAt).toLocaleTimeString()}
                                    </div>
                                    <div className="screenshot-details">{v.details}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="violation-timeline">
                <h3>Violation Timeline</h3>
                <div className="timeline">
                    {violations.map((v, idx) => (
                        <div key={idx} className={`timeline-item ${v.severity}`}>
                            <div className="timeline-time">
                                {new Date(v.detectedAt).toLocaleTimeString()}
                            </div>
                            <div className="timeline-content">
                                <div className="timeline-type">{v.type.replace(/_/g, ' ')}</div>
                                <div className="timeline-details">{v.details}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ViolationMetrics;
