import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import MediaAnalyzer from '../components/MediaAnalyzer';
import CheatingDetectionManager from '../components/CheatingDetector/CheatingDetectionManager';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/themes/prism-tomorrow.css';
import { FiMonitor, FiVideo, FiMic, FiAlertCircle, FiSettings, FiCheck, FiFileText, FiCode } from 'react-icons/fi';

const InterviewPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Refs
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const interviewRef = useRef(null);
  const activeAudioRef = useRef(null);
  const interviewStartTimeRef = useRef(null);

  // State
  const [interview, setInterview] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [videoMetrics, setVideoMetrics] = useState({});
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorMode, setEditorMode] = useState('notepad'); // 'notepad' or 'code'
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [codeContent, setCodeContent] = useState('// Write your code here...');
  const [notepadContent, setNotepadContent] = useState('');
  const [remainingTime, setRemainingTime] = useState(3600); // 1 hour = 3600 seconds
  const [attemptedQuestions, setAttemptedQuestions] = useState(new Set());
  const [showHintConfirm, setShowHintConfirm] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0); // 0, 1, or 2
  const [hintConfirmLevel, setHintConfirmLevel] = useState(0); // 1 or 2
  const [hintsUsedCount, setHintsUsedCount] = useState(0);

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    interviewRef.current = interview;
  }, [interview]);

  // Timer countdown
  useEffect(() => {
    if (!isSetupComplete) return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          endInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSetupComplete]);

  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/webm'];
    return types.find(type => MediaRecorder.isTypeSupported(type));
  };

  useEffect(() => {
    loadInterview();
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (webcamRef.current && webcamRef.current.srcObject) {
        webcamRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, [sessionId]);

  const loadInterview = async () => {
    try {
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
      if (response.data.success) {
        console.log('📋 Interview loaded:', response.data.interview);
        console.log('📝 Total questions:', response.data.interview.questions.length);
        console.log('🎯 First question:', response.data.interview.questions[0]);

        setInterview(response.data.interview);
        setCurrentQuestionIndex(response.data.interview.currentQuestion || 0);

        // Initialize attempted questions
        const answered = new Set();
        response.data.interview.questions.forEach((q, idx) => {
          if (q.answer && q.answer !== 'not attempted') {
            answered.add(idx);
          }
        });
        setAttemptedQuestions(answered);
      }
    } catch (error) {
      console.error('❌ Failed to load interview:', error);
      toast.error("Failed to load interview session");
    }
  };

  const navigateToQuestion = (index) => {
    if (!interview || index < 0 || index >= interview.questions.length) return;
    setCurrentQuestionIndex(index);
    // Reset editor content
    setCodeContent('// Write your code here...');
    setNotepadContent('');
    setShowHintConfirm(false);
    setHintsRevealed(0);
    setHintsUsedCount(0);
    setHintConfirmLevel(0);
  };

  const submitAnswer = async () => {
    if (isSubmitting || !interview) return;

    const currentQ = interview.questions[currentQuestionIndex];

    setIsSubmitting(true);
    toast.loading("Submitting answer...", { id: 'submit' });

    try {
      const formData = new FormData();
      formData.append("interviewId", sessionId);
      formData.append("questionIndex", currentQuestionIndex);
      formData.append("videoMetrics", JSON.stringify(videoMetrics));

      if (editorMode === 'code') {
        formData.append("codeAnswer", codeContent);
        formData.append("language", selectedLanguage);
      } else {
        formData.append("textAnswer", notepadContent);
      }

      formData.append("hintsUsed", hintsUsedCount);

      // Add empty audio blob to satisfy backend
      const emptyBlob = new Blob([], { type: 'audio/webm' });
      formData.append("audio", emptyBlob, "answer.webm");

      const response = await axios.post(
        `${API_BASE}/interview/submit-answer`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      toast.dismiss('submit');

      if (response.data.success) {
        // Mark question as attempted
        setAttemptedQuestions(prev => new Set([...prev, currentQuestionIndex]));

        toast.success("Answer submitted!");

        // Move to next question if available
        if (currentQuestionIndex < interview.questions.length - 1) {
          navigateToQuestion(currentQuestionIndex + 1);
        } else {
          toast.success("All questions completed!");
        }
      }
    } catch (error) {
      toast.dismiss('submit');
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipQuestion = () => {
    if (currentQuestionIndex < interview.questions.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
      toast.info("Question skipped");
    } else {
      toast.info("This is the last question");
    }
  };

  const endInterview = async () => {
    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
        webcamRef.current.video.srcObject.getTracks().forEach(track => track.stop());
      }

      toast.loading("Ending interview...", { id: 'end-interview' });
      await axios.post(`${API_BASE}/interview/end/${sessionId}`);
      toast.success("Interview ended", { id: 'end-interview' });

      navigate(`/results/${sessionId}`);
    } catch (error) {
      console.error("Error ending interview:", error);
      toast.error("Failed to end interview", { id: 'end-interview' });
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!interview) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner-large"></div>
        <p>Initializing Session...</p>
      </div>
    );
  }

  const currentQuestion = interview.questions[currentQuestionIndex];
  const isSetupMode = !isSetupComplete;

  return (
    <div className="interview-page-new">
      <header className="interview-header-new">
        <div>
          <h1>AI Interview Session</h1>
          <p>{interview.position} | {interview.candidateName}</p>
        </div>
        <div className="timer-display">
          <span className="timer-label">Time Remaining:</span>
          <span className="timer-value">{formatTime(remainingTime)}</span>
        </div>
      </header>

      {isSetupMode ? (
        <div className="setup-overlay">
          <div className="setup-card">
            <div className="setup-header">
              <div className="setup-icon"><FiSettings /></div>
              <h2>System Check</h2>
              <p>Ensure your face is centered and microphone levels are active.</p>
            </div>

            <div className="setup-video-wrapper">
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                className="webcam-feed"
                videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
              />
              <MediaAnalyzer
                webcamRef={webcamRef}
                onMetricsUpdate={setVideoMetrics}
                onAudioLevel={setAudioLevel}
                onCalibrationComplete={() => setIsCalibrated(true)}
              />
            </div>

            <div className="setup-controls">
              <div className="audio-test">
                <div className="audio-label">Microphone Sensitivity</div>
                <div className="audio-meter">
                  <div className="audio-fill" style={{ width: `${audioLevel * 100}%` }} />
                </div>
              </div>
              <button
                className={`btn-start-session ${isCalibrated ? 'ready' : ''}`}
                disabled={!isCalibrated}
                onClick={() => {
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(err => {
                      console.warn("Fullscreen request failed:", err);
                    });
                  }
                  setIsSetupComplete(true);
                  interviewStartTimeRef.current = Date.now();
                }}
                style={{
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: isCalibrated ? '#4CAF50' : '#444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isCalibrated ? 'pointer' : 'not-allowed',
                  opacity: isCalibrated ? 1 : 0.7,
                  transition: 'all 0.3s'
                }}
              >
                {isCalibrated ? <><FiCheck /> Begin Interview</> : "Calibrating AI..."}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="interview-layout">
          <CheatingDetectionManager
            interviewId={sessionId}
            isActive={!isSetupMode}
            videoMetrics={videoMetrics}
            audioLevel={audioLevel}
            webcamRef={webcamRef}
          />

          {/* Left Panel */}
          <div className="left-panel">
            {/* Camera */}
            <div className="camera-section">
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                className="webcam-feed"
                videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
              />
              <MediaAnalyzer
                webcamRef={webcamRef}
                onMetricsUpdate={setVideoMetrics}
                onAudioLevel={setAudioLevel}
                skipCalibration={true}
              />
              {(videoMetrics.detectedObjects?.length > 0 || videoMetrics.gazePattern?.includes('suspicious')) && (
                <div className="proctor-alert-new">
                  <FiAlertCircle />
                  {videoMetrics.detectedObjects?.length > 0
                    ? `Detected: ${videoMetrics.detectedObjects.join(', ')}`
                    : 'Suspicious Gaze Detected'}
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="metrics-panel">
              <h3>Live AI Proctoring</h3>
              <div className="metrics-grid-new">
                <div className="metric-new">
                  <span className="metric-label">Attention</span>
                  <span className="metric-value">{Math.round((videoMetrics.attention || 0) * 100)}%</span>
                </div>
                <div className="metric-new">
                  <span className="metric-label">Eye Contact</span>
                  <span className="metric-value">{Math.round((videoMetrics.eyeContact || 0) * 100)}%</span>
                </div>
                <div className="metric-new">
                  <span className="metric-label">Stress</span>
                  <span className="metric-value" style={{ color: (videoMetrics.stress || 0) > 0.5 ? '#f87171' : '#34d399' }}>
                    {Math.round((videoMetrics.stress || 0) * 100)}%
                  </span>
                </div>
                <div className="metric-new">
                  <span className="metric-label">Network</span>
                  <span className="metric-value">{Math.round((videoMetrics.networkQuality || 1) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Question Navigator */}
            <div className="question-navigator">
              <h3>Questions ({currentQuestionIndex + 1}/{interview.questions.length})</h3>
              <div className="question-grid">
                {interview.questions.map((q, idx) => (
                  <button
                    key={idx}
                    className={`question-block ${idx === currentQuestionIndex ? 'active' : ''} ${attemptedQuestions.has(idx) ? 'attempted' : ''}`}
                    onClick={() => navigateToQuestion(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="right-panel">
            <div className="question-display">
              <div className="question-header-new">
                <span className="question-number">Question {currentQuestionIndex + 1}/25</span>
                <div className="question-badges">
                  <span className="question-type">{currentQuestion?.type || 'general'}</span>
                  <span className="question-difficulty">{currentQuestion?.difficulty || 'medium'}</span>
                </div>
              </div>
              <p className="question-text-new">{currentQuestion?.text}</p>

              {/* Hint Section */}
              {currentQuestion?.type === 'code' && (currentQuestion?.hint1 || currentQuestion?.hint2) && (
                <div className="hint-section" style={{ marginTop: '15px' }}>

                  {/* Hint 1 Button */}
                  {hintsRevealed < 1 && currentQuestion.hint1 && (
                    <button
                      onClick={() => {
                        setHintConfirmLevel(1);
                        setShowHintConfirm(true);
                      }}
                      className="btn-get-hint"
                      style={{
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}
                    >
                      <FiAlertCircle /> Get Hint 1 (Small Penalty)
                    </button>
                  )}

                  {/* Hint 1 Display */}
                  {hintsRevealed >= 1 && currentQuestion.hint1 && (
                    <div className="hint-display" style={{
                      background: '#fffbeb',
                      border: '1px solid #fcd34d',
                      padding: '12px',
                      borderRadius: '8px',
                      color: '#92400e',
                      marginBottom: '8px'
                    }}>
                      <strong>💡 Hint 1:</strong> {currentQuestion.hint1}
                    </div>
                  )}

                  {/* Hint 2 Button */}
                  {hintsRevealed === 1 && currentQuestion.hint2 && (
                    <button
                      onClick={() => {
                        setHintConfirmLevel(2);
                        setShowHintConfirm(true);
                      }}
                      className="btn-get-hint"
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}
                    >
                      <FiAlertCircle /> Get Hint 2 (Large Penalty)
                    </button>
                  )}

                  {/* Hint 2 Display */}
                  {hintsRevealed >= 2 && currentQuestion.hint2 && (
                    <div className="hint-display" style={{
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      padding: '12px',
                      borderRadius: '8px',
                      color: '#991b1b'
                    }}>
                      <strong>💡 Hint 2:</strong> {currentQuestion.hint2}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Editor Mode Toggle */}
            <div className="editor-mode-toggle">
              <button
                className={`mode-btn ${editorMode === 'notepad' ? 'active' : ''}`}
                onClick={() => setEditorMode('notepad')}
              >
                <FiFileText /> Notepad
              </button>
              <button
                className={`mode-btn ${editorMode === 'code' ? 'active' : ''}`}
                onClick={() => setEditorMode('code')}
              >
                <FiCode /> Code Editor
              </button>
            </div>

            {/* Editor Area */}
            {editorMode === 'notepad' ? (
              <div className="notepad-editor">
                <textarea
                  value={notepadContent}
                  onChange={(e) => setNotepadContent(e.target.value)}
                  placeholder="Write your answer here... (for email writing, paragraph, explanation, etc.)"
                  className="notepad-textarea"
                />
              </div>
            ) : (
              <div className="code-editor-area">
                <div className="code-editor-header">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="language-selector"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                  </select>
                </div>
                <Editor
                  value={codeContent}
                  onValueChange={code => setCodeContent(code)}
                  highlight={code => {
                    const lang = languages[selectedLanguage] || languages.javascript;
                    return highlight(code, lang);
                  }}
                  padding={20}
                  className="code-editor-main"
                  style={{
                    minHeight: '400px',
                    fontSize: '14px',
                    fontFamily: '"Fira Code", "Courier New", monospace',
                    background: '#1e1e1e',
                    color: '#d4d4d4'
                  }}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="btn-skip" onClick={skipQuestion} disabled={isSubmitting}>
                Skip Question
              </button>
              <button className="btn-submit" onClick={submitAnswer} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
              <button className="btn-end" onClick={endInterview}>
                End Interview
              </button>
            </div>
          </div>
          {/* Hint Confirmation Modal */}
          {showHintConfirm && (
            <div className="modal-overlay" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.7)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
              <div className="modal-content" style={{
                background: '#1e1e1e', padding: '24px', borderRadius: '12px',
                maxWidth: '400px', width: '90%', textAlign: 'center',
                border: '1px solid #333'
              }}>
                <div style={{ color: '#f59e0b', fontSize: '48px', marginBottom: '16px' }}>
                  <FiAlertCircle />
                </div>
                <h3 style={{ color: 'white', marginBottom: '12px' }}>
                  Use Hint {hintConfirmLevel}?
                </h3>
                <p style={{ color: '#ccc', marginBottom: '24px' }}>
                  {hintConfirmLevel === 1
                    ? "Using Hint 1 will verify a small score penalty (e.g. -10%)."
                    : "Using Hint 2 will verify a larger score penalty (e.g. -25%) on top of previous penalties."}
                  <br />
                  Are you sure you want to proceed?
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      setShowHintConfirm(false);
                      setHintConfirmLevel(0);
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: '6px',
                      background: '#333', color: 'white', border: 'none', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setHintsRevealed(hintConfirmLevel);
                      setHintsUsedCount(hintConfirmLevel);
                      setShowHintConfirm(false);
                      setHintConfirmLevel(0);
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: '6px',
                      background: hintConfirmLevel === 1 ? '#f59e0b' : '#ef4444',
                      color: 'white', border: 'none', cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Yes, Show Hint {hintConfirmLevel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div >
  );
};

export default InterviewPage;