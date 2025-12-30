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
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';
  
  useEffect(() => {
    fetchResults();
  }, [sessionId]);
  
  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
      
      if (response.data.success) {
        setReport(response.data.interview.finalEvaluation);
      }
    } catch (error) {
      toast.error('Failed to load results');
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Generating your interview report...</p>
      </div>
    );
  }
  
  if (!report) {
    return (
      <div className="no-results">
        <h2>No results found</h2>
        <p>Try refreshing the page or contact support.</p>
      </div>
    );
  }
  
  // Prepare chart data
  const radarData = {
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
  };
  
  const barData = {
    labels: ['Technical', 'Communication', 'Confidence'],
    datasets: [
      {
        label: 'Score (out of 10)',
        data: [
          report.detailedBreakdown?.technicalSkills?.score || 0,
          report.detailedBreakdown?.communication?.score || 0,
          report.detailedBreakdown?.confidence?.score || 0
        ],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1
      }
    ]
  };
  
  const recommendationColors = {
    'Strong Hire': '#10B981',
    'Hire': '#34D399',
    'No Hire': '#F59E0B',
    'Strong No Hire': '#EF4444'
  };
  
  return (
    <div className="results-page">
      <div className="results-header">
        <h1>Interview Results</h1>
        <p className="session-id">Session: {sessionId}</p>
      </div>
      
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
              {report.summary?.recommendation || 'Pending'}
            </div>
          </div>
          
          <div className="decision-section">
            <h3>Decision: <span className={`decision-${report.summary?.decision?.toLowerCase()}`}>
              {report.summary?.decision || 'Pending'}
            </span></h3>
            <p className="final-feedback">{report.finalFeedback}</p>
          </div>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Skills Radar</h3>
          <Radar data={radraData} />
        </div>
        
        <div className="chart-container">
          <h3>Category Scores</h3>
          <Bar data={barData} />
        </div>
      </div>
      
      {/* Detailed Breakdown */}
      <div className="detailed-breakdown">
        <h2>Detailed Analysis</h2>
        
        <div className="breakdown-grid">
          {Object.entries(report.detailedBreakdown || {}).map(([key, value]) => (
            <div key={key} className="breakdown-item">
              <h4>{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
              <div className="score-bar">
                <div 
                  className="score-fill"
                  style={{ width: `${(value.score / 10) * 100}%` }}
                />
                <span className="score-text">{value.score.toFixed(1)}/10</span>
              </div>
              <p className="breakdown-feedback">{value.feedback}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Strengths & Weaknesses */}
      <div className="swot-section">
        <div className="strengths">
          <h3>Strengths</h3>
          <ul>
            {(report.strengths || []).map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
        </div>
        
        <div className="weaknesses">
          <h3>Areas for Improvement</h3>
          <ul>
            {(report.weaknesses || []).map((weakness, index) => (
              <li key={index}>{weakness}</li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Suggestions */}
      <div className="suggestions-section">
        <h3>Recommendations</h3>
        <div className="suggestions-grid">
          {(report.suggestions || []).map((suggestion, index) => (
            <div key={index} className="suggestion-card">
              <div className="suggestion-number">{index + 1}</div>
              <p>{suggestion}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Actions */}
      <div className="action-buttons">
        <button 
          className="btn-primary"
          onClick={() => window.print()}
        >
          Download Report
        </button>
        <button 
          className="btn-secondary"
          onClick={() => window.location.href = '/'}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default ResultsPage;