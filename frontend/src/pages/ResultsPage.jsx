import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Radar } from 'react-chartjs-2';
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
import ViolationMetrics from '../components/ViolationMetrics';
import { FiDownload, FiHome, FiAward, FiCheckCircle, FiXCircle, FiTrendingUp } from 'react-icons/fi';

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
    const interval = setInterval(checkStatus, 5000);
    setRefreshInterval(interval);
    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
      if (response.data.success) setInterview(response.data.interview);
    } catch (error) {
      toast.error('Failed to load results');
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
        if (data.finalEvaluation && refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner-large"></div>
        <p>Analyzing Results...</p>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="results-page">
        <div className="setup-card">
          <h2>Interview Not Found</h2>
          <button className="btn-primary" onClick={() => window.location.href = '/'}>Go Home</button>
        </div>
      </div>
    );
  }

  const report = interview.finalEvaluation;
  const isPending = !report;

  const radarData = report ? {
    labels: ['Technical', 'Logic', 'Comm.', 'Confidence', 'Overall'],
    datasets: [{
      label: 'Performance',
      data: [
        report.detailedBreakdown?.technicalSkills?.score || 0,
        report.detailedBreakdown?.problemSolving?.score || 0,
        report.detailedBreakdown?.communication?.score || 0,
        report.detailedBreakdown?.confidence?.score || 0,
        report.summary?.overallScore / 10 || 0
      ],
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: '#6366f1',
      borderWidth: 3,
      pointBackgroundColor: '#6366f1'
    }]
  } : null;

  return (
    <div className="results-page">
      <header className="interview-header" style={{ marginBottom: '4rem' }}>
        <div className="badge">AI Performance Report</div>
        <h1>Interview Comprehensive Analysis</h1>
        <p>{interview.candidateName} | {interview.position}</p>
      </header>

      {isPending ? (
        <div className="setup-card" style={{ margin: '0 auto' }}>
          <div className="loading-spinner-large" style={{ margin: '0 auto 2rem' }}></div>
          <h2>AI Evaluation in Progress</h2>
          <p>Our deep learning models are analyzing your speech, code, and behavioral patterns. This usually takes 30-60 seconds.</p>
          <div className="q-progress" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '2rem' }}>
            {interview.questions.map((q, i) => (
              <div key={i} className={`q-dot ${q.transcription ? 'done' : 'wait'}`} style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: q.transcription ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 'bold'
              }}>Q{i + 1}</div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="summary-card">
            <div className="summary-main" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4rem', alignItems: 'center' }}>
              <div className="score-display">
                <div className="score-circle">
                  <span className="score-number">{report.summary?.overallScore}</span>
                  <span className="score-label">INDEX</span>
                </div>
                <div className="recommendation-badge" style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.1)' }}>
                  {report.summary?.recommendation}
                </div>
              </div>
              <div className="feedback-text">
                <h3 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>Executive Summary</h3>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.7', opacity: 0.9 }}>{report.finalFeedback}</p>
              </div>
            </div>
          </div>

          <div className="charts-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '4rem' }}>
            <div className="chart-container">
              <h3>Performance Spectrum</h3>
              <Radar data={radarData} options={{
                scales: { r: { beginAtZero: true, max: 10, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#94a3b8', font: { size: 12 } } } },
                plugins: { legend: { display: false } }
              }} />
            </div>
            <div className="insights-box" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="qa-metric" style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <FiAward size={24} color="var(--color-primary)" style={{ marginBottom: '1rem' }} />
                <label>Key Competitive Advantage</label>
                <p style={{ fontSize: '1rem', color: 'white' }}>{report.strengths?.[0]}</p>
              </div>
              <div className="qa-metric" style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <FiTrendingUp size={24} color="var(--color-accent)" style={{ marginBottom: '1rem' }} />
                <label>Primary Growth Area</label>
                <p style={{ fontSize: '1rem', color: 'white' }}>{report.weaknesses?.[0]}</p>
              </div>
            </div>
          </div>

          {/* Cheating Detection Report */}
          <ViolationMetrics
            violations={interview.cheatLogs || []}
            riskScore={interview.riskScore || 0}
          />

          <div className="detailed-analysis">
            <h2 style={{ marginBottom: '2rem' }}>Section Breakdown</h2>
            {interview.questions.map((q, i) => (
              <div key={i} className="question-analysis-card">
                <div className="qa-header">
                  <h3>Question {i + 1} <span style={{ opacity: 0.3, fontSize: '0.9rem', marginLeft: '1rem' }}>{q.type.toUpperCase()}</span></h3>
                  <div className="qa-score-pill" style={{ background: 'var(--color-primary)', padding: '0.25rem 1rem', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {Math.round(q.aiEvaluation?.confidenceScore * 10 || 0)}% MATCH
                  </div>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: '2rem' }}>"{q.text}"</p>
                <div className="qa-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div className="transcription-box">
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-primary)', display: 'block', marginBottom: '0.5rem' }}>Your Response</label>
                    <p style={{ fontSize: '0.95rem' }}>{q.transcription?.text || "Answer skipped or audio not processed."}</p>
                  </div>
                  <div className="feedback-box">
                    <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-accent)', display: 'block', marginBottom: '0.5rem' }}>AI Insights</label>
                    <p style={{ fontSize: '0.95rem' }}>{q.aiEvaluation?.feedback}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="action-buttons" style={{ marginTop: '4rem', display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
            <button className="btn-start" style={{ padding: '1rem 3rem' }} onClick={() => window.print()}>
              <FiDownload /> Download Full Report
            </button>
            <button className="btn-test" style={{ padding: '1rem 3rem' }} onClick={() => window.location.href = '/'}>
              <FiHome /> Back to Dashboard
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsPage;