import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Radar,
  Bar,
  Doughnut
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement
} from 'chart.js';
import toast from 'react-hot-toast';

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement
);

const ResultsPage = () => {
  const { sessionId } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchResults();

    // Set up polling if data is still processing
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    setRefreshInterval(interval);

    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);

      if (response.data.success) {
        setInterview(response.data.interview);
      }
    } catch (error) {
      toast.error('Failed to load results');
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
      if (response.data.success) {
        const data = response.data.interview;
        setInterview(data);

        // If final evaluation is ready, stop polling
        if (data.finalEvaluation) {
          if (refreshInterval) {
            clearInterval(refreshInterval);
            setRefreshInterval(null);
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your interview data...</p>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="no-results">
        <h2>Interview not found</h2>
        <p>Could not find the requested interview session.</p>
        <button onClick={() => window.location.href = '/'}>Go Home</button>
      </div>
    );
  }

  const report = interview.finalEvaluation;
  const isPending = !report;

  // Prepare chart data if report exists
  const radarData = report ? {
    labels: ['Technical', 'Problem Solving', 'Communication', 'Confidence', 'Overall'],
    datasets: [
      {
        label: 'Your Scores',
        data: [
          report.detailedBreakdown?.technicalSkills?.score || 0,
          report.detailedBreakdown?.problemSolving?.score || 0,
          report.detailedBreakdown?.communication?.score || 0,
          report.detailedBreakdown?.confidence?.score || 0,
          report.summary?.overallScore / 10 || 0
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }
    ]
  } : null;

  const recommendationColors = {
    'Strong Hire': '#10B981',
    'Hire': '#34D399',
    'No Hire': '#F59E0B',
    'Strong No Hire': '#EF4444'
  };

  return (
    <div className="results-page">
      <div className="results-header">
        <h1>Interview Report</h1>
        <p className="session-id">Candidate: {interview.candidateName} | Position: {interview.position}</p>
      </div>

      {isPending ? (
        <div className="pending-analysis-card">
          <div className="loading-spinner-small"></div>
          <h2>Analysis in Progress...</h2>
          <p>Our AI is analyzing your responses. This page will update automatically as results become available.</p>
          <div className="processing-progress">
            {interview.questions.map((q, i) => (
              <div key={i} className={`q-status-dot ${q.transcription ? 'completed' : 'pending'}`}>
                Q{i + 1}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="summary-card">
            <div className="summary-main">
              <div className="score-display">
                <h2>Overall Score</h2>
                <div className="score-circle">
                  <span className="score-number">{report.summary?.overallScore || 0}</span>
                  <span className="score-label">/100</span>
                </div>
                <div
                  className="recommendation-badge"
                  style={{
                    backgroundColor: recommendationColors[report.summary?.recommendation] || '#6B7280'
                  }}
                >
                  {report.summary?.recommendation || 'Evaluated'}
                </div>
              </div>

              <div className="decision-section">
                <h3>Executive Summary</h3>
                <p className="final-feedback">{report.finalFeedback}</p>
                <div className="recommendation-text">
                  <strong>Recommendation:</strong> {report.summary?.recommendation}
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          {radarData && (
            <div className="charts-section">
              <div className="chart-container">
                <h3>Performance Breakdown</h3>
                <Radar
                  data={radarData}
                  options={{
                    scales: {
                      r: {
                        beginAtZero: true,
                        max: 10,
                        ticks: { stepSize: 2 }
                      }
                    }
                  }}
                />
              </div>

              <div className="swot-section-mini">
                <div className="strengths-weaknesses">
                  <div className="sw-box strength">
                    <h4>Key Strengths</h4>
                    <ul>
                      {report.strengths?.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="sw-box improvement">
                    <h4>Top Improvements</h4>
                    <ul>
                      {report.weaknesses?.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Question by Question Analysis */}
      <div className="questions-analysis-section">
        <h2>Question-by-Question Analysis</h2>
        <div className="questions-list">
          {interview.questions.map((q, index) => (
            <div key={index} className="question-analysis-card">
              <div className="qa-header">
                <h3>Question {index + 1}</h3>
                <span className="qa-type">{q.type}</span>
              </div>
              <p className="qa-text">"{q.text}"</p>

              {!q.transcription ? (
                <div className="qa-pending">
                  <div className="loading-spinner-tiny"></div>
                  <span>Analyzing response...</span>
                </div>
              ) : (
                <div className="qa-details">
                  <div className="qa-transcription">
                    <h4>Your Answer:</h4>
                    <p>{q.transcription.text}</p>
                  </div>

                  <div className="qa-metrics-grid">
                    <div className="qa-metric">
                      <label>Confidence</label>
                      <div className="qa-value">{Math.round((q.aiEvaluation?.confidenceScore || 0) * 10)}%</div>
                    </div>
                    <div className="qa-metric">
                      <label>Communication</label>
                      <div className="qa-value">{Math.round((q.aiEvaluation?.communicationSkills || 0) * 10)}%</div>
                    </div>
                    <div className="qa-metric">
                      <label>Technical</label>
                      <div className="qa-value">{Math.round((q.aiEvaluation?.technicalAccuracy || 0) * 10)}%</div>
                    </div>
                  </div>

                  {q.aiEvaluation?.feedback && (
                    <div className="qa-feedback">
                      <h4>AI Feedback:</h4>
                      <p>{q.aiEvaluation.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions Section (only if report exists) */}
      {!isPending && report.suggestions && (
        <div className="suggestions-section">
          <h3>Career Growth Suggestions</h3>
          <div className="suggestions-grid">
            {report.suggestions.map((suggestion, index) => (
              <div key={index} className="suggestion-card">
                <div className="suggestion-number">{index + 1}</div>
                <p>{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="action-buttons">
        <button
          className="btn-primary"
          onClick={() => window.print()}
          disabled={isPending}
        >
          Download Report
        </button>
        <button
          className="btn-secondary"
          onClick={() => window.location.href = '/'}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ResultsPage;