import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import MediaAnalyzer from '../components/MediaAnalyzer';
import CheatingDetectionManager from '../components/CheatingDetector/CheatingDetectionManager';
import LockdownManager from '../components/CheatingDetector/LockdownManager';
import PreInterviewGuidelines from '../components/PreInterviewGuidelines';
import MediaPermissionGate from '../components/MediaPermissionGate';
import Editor from '@monaco-editor/react';
import { LANGUAGE_OPTIONS, getLanguageByValue } from '../utils/languageConstants';
import { FiMonitor, FiVideo, FiMic, FiAlertCircle, FiSettings, FiCheck, FiFileText, FiCode, FiVolume2, FiVolumeX } from 'react-icons/fi';

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
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
  const [mediaPermissionsGranted, setMediaPermissionsGranted] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorMode, setEditorMode] = useState('notepad'); // 'notepad' or 'code'
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGE_OPTIONS[0].value);
  const [codeContent, setCodeContent] = useState(LANGUAGE_OPTIONS[0].boilerplate);
  const [notepadContent, setNotepadContent] = useState('');
  const [remainingTime, setRemainingTime] = useState(3600); // 1 hour = 3600 seconds
  const [attemptedQuestions, setAttemptedQuestions] = useState(new Set());
  const [violationLogs, setViolationLogs] = useState([]);
  const [showHintConfirm, setShowHintConfirm] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0); // 0, 1, or 2
  const [hintConfirmLevel, setHintConfirmLevel] = useState(0); // 1 or 2
  const [hintsUsedCount, setHintsUsedCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [codeOutput, setCodeOutput] = useState(null);
  const [isRunningCode, setIsRunningCode] = useState(false);

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  const handleLockdownViolation = useCallback(async (violation) => {
    console.warn("Lockdown Violation:", violation);
    setViolationLogs(prev => [...prev, violation]);

    if (violation.type === 'fullscreen_exit' || violation.type === 'tab_switch' || violation.type === 'window_blur') {
      toast.error(`Security Warning: ${violation.type.replace('_', ' ')} detected!`, {
        duration: 5000,
        icon: '🛡️'
      });
    }

    if (interview?.id) {
      try {
        await axios.post(`${API_BASE}/interview/${interview.id}/cheat-log`, {
          type: 'lockdown',
          details: violation,
          severity: 'critical'
        });
      } catch (err) {
        console.error("Failed to log lockdown violation:", err);
      }
    }
  }, [interview, API_BASE]);

  // Request Mic Permission on Mount
  useEffect(() => {
    const inSetupMode = !isSetupComplete;
    if (inSetupMode) {
      try {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            setMicPermissionGranted(true);
          })
          .catch((err) => {
            console.error("Mic permission denied:", err);
            toast.error("Microphone access is required for the interview.");
            setMicPermissionGranted(false);
          });
      } catch (e) {
        console.error("Sync error in getUserMedia:", e);
      }
    }
  }, [isSetupComplete]);

  // Audio Playback Effect
  useEffect(() => {
    if (!interview || !isSetupComplete) return;

    let audio = null;

    const playQuestionAudio = async () => {
      setIsSpeaking(true);
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      window.speechSynthesis.cancel();

      try {
        const audioUrl = `${API_BASE}/interview/${sessionId}/question/${currentQuestionIndex}/audio`;
        audio = new Audio(audioUrl);
        activeAudioRef.current = audio;

        const safetyTimeout = setTimeout(() => {
          if (activeAudioRef.current === audio) {
            setIsSpeaking(false);
            toast.info("Audio timed out. Please provide your answer now.");
          }
        }, 40000);

        audio.onended = () => {
          clearTimeout(safetyTimeout);
          setIsSpeaking(false);
          activeAudioRef.current = null;
          toast.success("🎤 Now it's your turn to speak!");
        };

        audio.onerror = (err) => {
          clearTimeout(safetyTimeout);
          console.warn("Backend audio failed, falling back to Browser TTS:", err);
          const questionText = interview.questions[currentQuestionIndex]?.text;
          if (questionText) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(questionText);
            utterance.lang = 'en-US';
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
          } else {
            setIsSpeaking(false);
          }
        };

        try {
          await audio.play();
        } catch (playError) {
          if (audio.onerror) audio.onerror(playError);
        }
      } catch (error) {
        setIsSpeaking(false);
      }
    };

    playQuestionAudio();

    return () => {
      if (audio) {
        audio.pause();
        activeAudioRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, [currentQuestionIndex, interview, isSetupComplete, sessionId, API_BASE]);

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
        setInterview(response.data.interview);
        setCurrentQuestionIndex(response.data.interview.currentQuestion || 0);
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
    const q = interview.questions[index];
    if (q.type === 'code') {
      setEditorMode('code');
      setCodeContent(getLanguageByValue(selectedLanguage).boilerplate);
    } else {
      setEditorMode('notepad');
      setNotepadContent('');
    }
    setShowHintConfirm(false);
    setHintsRevealed(0);
    setHintsUsedCount(0);
    setHintConfirmLevel(0);
    setHintVisible(false);
    setHintUsed(false);
    setCodeOutput(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.start();
    } catch (error) {
      toast.error("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          resolve(audioBlob);
        };
        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }
    });
  };

  useEffect(() => {
    if (!isSetupComplete || !interview) return;
    if (!isSpeaking) {
      startRecording();
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
  }, [isSpeaking, isSetupComplete, interview, currentQuestionIndex]);

  const submitAnswer = async () => {
    if (isSubmitting || !interview) return;
    const audioBlob = await stopRecording();

    // Check if any answer is provided
    const hasText = notepadContent.trim().length > 0;
    const hasCode = codeContent.trim().length > 0;
    const hasAudio = audioBlob && audioBlob.size > 0;

    if (!hasAudio && !hasText && !hasCode) {
      toast.error("Please provide an answer (speak or write).");
      startRecording();
      return;
    }

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

      if (audioBlob) {
        formData.append("audio", audioBlob, "answer.webm");
      } else {
        const emptyBlob = new Blob([], { type: 'audio/webm' });
        formData.append("audio", emptyBlob, "answer.webm");
      }

      const response = await axios.post(`${API_BASE}/interview/submit-answer`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000
      });

      toast.dismiss('submit');
      if (response.data.success) {
        setAttemptedQuestions(prev => new Set([...prev, currentQuestionIndex]));
        toast.success("Answer submitted!");
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

  const handleEditorDidMount = (editor, monaco) => {
    setTimeout(() => {
      editor.layout();
    }, 100);
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

  const handleRunCode = async () => {
    if (!sessionId || !codeContent) return;

    setIsRunningCode(true);
    setCodeOutput({ status: { description: 'Executing...' }, stdout: '', stderr: '', compile_output: '' });

    try {
      const lang = getLanguageByValue(selectedLanguage);
      const response = await axios.post(`${API_BASE}/interview/execute`, {
        sourceCode: codeContent,
        languageId: lang?.id || 63,
        stdin: ""
      });

      if (response.data.success) {
        setCodeOutput(response.data.result);
        toast.success("Code executed successfully");
      } else {
        throw new Error(response.data.error || "Execution failed");
      }
    } catch (err) {
      console.error("Code execution error:", err);
      setCodeOutput({ error: err.message });
      toast.error("Code execution failed");
    } finally {
      setIsRunningCode(false);
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

      <MediaPermissionGate onPermissionsGranted={() => setMediaPermissionsGranted(true)}>
        {!guidelinesAccepted && (
          <PreInterviewGuidelines onAccept={() => setGuidelinesAccepted(true)} />
        )}

        {guidelinesAccepted && (
          isSetupMode ? (
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
                    {!micPermissionGranted && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px' }}>⚠️ Microphone permission required</div>}
                  </div>
                  <button
                    className={`btn-start-session ${isCalibrated && micPermissionGranted ? 'ready' : ''}`}
                    disabled={!isCalibrated || !micPermissionGranted}
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
                      background: (isCalibrated && micPermissionGranted) ? '#4CAF50' : '#444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (isCalibrated && micPermissionGranted) ? 'pointer' : 'not-allowed',
                      opacity: (isCalibrated && micPermissionGranted) ? 1 : 0.7,
                      transition: 'all 0.3s'
                    }}
                  >
                    {(isCalibrated && micPermissionGranted) ? <><FiCheck /> Begin Interview</> : "Waiting for Setup..."}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <LockdownManager isActive={!isSetupMode} onLockdownViolation={handleLockdownViolation}>
              <div className="interview-layout">
                <CheatingDetectionManager
                  interviewId={sessionId}
                  isActive={!isSetupMode}
                  videoMetrics={videoMetrics}
                  audioLevel={audioLevel}
                  webcamRef={webcamRef}
                />

                <div className="left-panel">
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
                    {(videoMetrics.detectedObjects?.length > 0 ||
                      videoMetrics.gazePattern?.includes('suspicious') ||
                      videoMetrics.gazePattern === 'extreme_side_gaze' ||
                      videoMetrics.movementScore > 20) && (
                        <div className={`proctor-alert-new ${videoMetrics.gazePattern === 'extreme_side_gaze' ? 'critical-shake' : ''}`}>
                          <FiAlertCircle />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {videoMetrics.detectedObjects?.length > 0 &&
                              <span style={{ fontWeight: 'bold', color: '#ff4444' }}>🚫 PROHIBITED: {videoMetrics.detectedObjects.join(', ')}</span>}
                            {videoMetrics.gazePattern === 'extreme_side_gaze' &&
                              <span style={{ fontWeight: 'bold', color: '#ffcc00' }}>⚠️ EXTREME RETINA TILT DETECTED!</span>}
                            {videoMetrics.movementScore > 20 &&
                              <span>Too much movement! Please stay still.</span>}
                            {(videoMetrics.gazePattern?.includes('suspicious') && videoMetrics.gazePattern !== 'extreme_side_gaze') &&
                              <span>Please look at the screen.</span>}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="metrics-panel">
                    <h3>Live AI Proctoring</h3>
                    <div className="metrics-grid-new">
                      <div className="metric-new">
                        <span className="metric-label">Stress Level</span>
                        <span className="metric-value" style={{
                          color: (videoMetrics.stress || 0) < 30 ? '#34d399' : (videoMetrics.stress || 0) < 70 ? '#facc15' : '#f87171'
                        }}>
                          {Math.round(videoMetrics.stress || 0)}/100
                        </span>
                      </div>
                      <div className="metric-new">
                        <span className="metric-label">Stability</span>
                        <span className="metric-value">
                          {Math.round(100 - (videoMetrics.movementScore || 0))}%
                        </span>
                      </div>
                      <div className="metric-new">
                        <span className="metric-label">Attention</span>
                        <span className="metric-value">{Math.round((videoMetrics.attention || 0) * 100)}%</span>
                      </div>
                      <div className="metric-new">
                        <span className="metric-label">Network</span>
                        <span className="metric-value">{Math.round((videoMetrics.networkQuality || 1) * 100)}%</span>
                      </div>
                    </div>
                  </div>

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

                <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
                  <div className="question-display" style={{ flex: '0 0 auto', maxHeight: '40vh', overflowY: 'auto', marginBottom: '10px' }}>
                    <div className="question-header-new">
                      <span className="question-number">Question {currentQuestionIndex + 1}/{interview.questions.length}</span>
                      <div className="question-badges">
                        <span className="question-type">{currentQuestion?.type || 'general'}</span>
                        <span className="question-difficulty">{currentQuestion?.difficulty || 'medium'}</span>
                        <div className={`speaking-indicator ${isSpeaking ? 'speaking' : 'listening'}`} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
                          borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                          background: isSpeaking ? '#3b82f6' : '#10b981', color: 'white',
                          marginLeft: '8px', transition: 'all 0.3s ease', opacity: 0.9
                        }}>
                          {isSpeaking ? <><FiVolume2 className="pulse-icon" /> AI Speaking...</> : <><FiMic className="pulse-icon" /> Speak Now</>}
                        </div>
                      </div>
                    </div>
                    <p className="question-text-new">{currentQuestion?.text || currentQuestion?.question}</p>

                    {currentQuestion?.type === 'code' && (
                      <div className="hint-section" style={{ marginTop: '15px' }}>
                        {(currentQuestion.hint1 || currentQuestion.hint2) ? (
                          <>
                            {hintsRevealed < 1 && currentQuestion.hint1 && (
                              <button onClick={() => { setHintConfirmLevel(1); setShowHintConfirm(true); }}
                                className="btn-get-hint" style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <FiAlertCircle /> Get Hint 1 (Small Penalty)
                              </button>
                            )}
                            {hintsRevealed >= 1 && currentQuestion.hint1 && (
                              <div className="hint-display" style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '12px', borderRadius: '8px', color: '#92400e', marginBottom: '8px' }}>
                                <strong>💡 Hint 1:</strong> {currentQuestion.hint1}
                              </div>
                            )}
                            {hintsRevealed === 1 && currentQuestion.hint2 && (
                              <button onClick={() => { setHintConfirmLevel(2); setShowHintConfirm(true); }}
                                className="btn-get-hint" style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <FiAlertCircle /> Get Hint 2 (Large Penalty)
                              </button>
                            )}
                            {hintsRevealed >= 2 && currentQuestion.hint2 && (
                              <div className="hint-display" style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px', borderRadius: '8px', color: '#991b1b' }}>
                                <strong>💡 Hint 2:</strong> {currentQuestion.hint2}
                              </div>
                            )}
                          </>
                        ) : (
                          currentQuestion.hint && (
                            <>
                              {!hintVisible ? (
                                <button onClick={() => { setHintConfirmLevel(0); setShowHintConfirm(true); }}
                                  className="btn-get-hint" style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FiAlertCircle /> Get Hint (Penalty Applies)
                                </button>
                              ) : (
                                <div className="hint-display" style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '12px', borderRadius: '8px', color: '#92400e' }}>
                                  <strong>💡 Hint:</strong> {currentQuestion.hint}
                                </div>
                              )}
                            </>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="editor-mode-toggle" style={{ marginBottom: '10px' }}>
                    <button className={`mode-btn ${editorMode === 'notepad' ? 'active' : ''}`} onClick={() => setEditorMode('notepad')}>
                      <FiFileText /> Notepad
                    </button>
                    <button className={`mode-btn ${editorMode === 'code' ? 'active' : ''}`} onClick={() => setEditorMode('code')}>
                      <FiCode /> Code Editor
                    </button>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {editorMode === 'notepad' ? (
                      <textarea
                        value={notepadContent}
                        onChange={(e) => setNotepadContent(e.target.value)}
                        placeholder="Write your answer here..."
                        className="notepad-textarea"
                        style={{ flex: 1, resize: 'none' }}
                      />
                    ) : (
                      <div className="code-editor-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#1e1e1e', borderBottom: '1px solid #333' }}>
                          <select
                            value={selectedLanguage}
                            onChange={(e) => {
                              setSelectedLanguage(e.target.value);
                              const lang = getLanguageByValue(e.target.value);
                              if (lang) setCodeContent(lang.boilerplate);
                            }}
                            className="language-selector" style={{ background: '#2d2d2d', color: '#fff', border: '1px solid #444', padding: '4px 8px', borderRadius: '4px' }}>
                            {LANGUAGE_OPTIONS.map(lang => <option key={lang.id} value={lang.value}>{lang.name}</option>)}
                          </select>
                          <button
                            onClick={handleRunCode}
                            disabled={isRunningCode}
                            className="btn-run-code"
                            style={{
                              background: isRunningCode ? '#444' : '#10b981',
                              color: 'white', border: 'none', padding: '4px 12px',
                              borderRadius: '4px', cursor: isRunningCode ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold'
                            }}
                          >
                            {isRunningCode ? "Running..." : <><FiCode /> Run Code</>}
                          </button>
                        </div>
                        <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
                          <Editor
                            height="100%"
                            language={selectedLanguage}
                            value={codeContent}
                            theme="vs-dark"
                            onMount={handleEditorDidMount}
                            onChange={value => setCodeContent(value)}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 14,
                              automaticLayout: true,
                              wordWrap: 'on',
                              scrollBeyondLastLine: false
                            }}
                          />
                        </div>
                        {codeOutput && (
                          <div className="code-output" style={{
                            height: '150px', background: '#000', color: '#fff',
                            padding: '10px', fontFamily: 'monospace', fontSize: '13px',
                            overflowY: 'auto', borderTop: '2px solid #333'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <span style={{ color: '#10b981', fontWeight: 'bold' }}>Output:</span>
                              <button onClick={() => setCodeOutput(null)} style={{ background: 'transparent', color: '#666', border: 'none', cursor: 'pointer' }}>Clear</button>
                            </div>
                            {codeOutput.error ? (
                              <pre style={{ color: '#ef4444' }}>{codeOutput.error}</pre>
                            ) : (
                              <>
                                {codeOutput.stdout && <pre>{codeOutput.stdout}</pre>}
                                {codeOutput.stderr && <pre style={{ color: '#ef4444' }}>{codeOutput.stderr}</pre>}
                                {codeOutput.compile_output && <pre style={{ color: '#f59e0b' }}>{codeOutput.compile_output}</pre>}
                                {codeOutput.status?.description && (
                                  <div style={{ marginTop: '5px', color: '#888', fontSize: '11px' }}>
                                    Status: {codeOutput.status.description} | Time: {codeOutput.time}s | Memory: {codeOutput.memory}KB
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="action-buttons" style={{ marginTop: '10px' }}>
                    <button className="btn-skip" onClick={skipQuestion} disabled={isSubmitting}>Skip Question</button>
                    <button className="btn-submit" onClick={submitAnswer} disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Answer'}</button>
                    <button className="btn-end" onClick={endInterview}>End Interview</button>
                  </div>
                </div>

                {showHintConfirm && (
                  <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ background: '#1e1e1e', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid #333' }}>
                      <div style={{ color: '#f59e0b', fontSize: '48px', marginBottom: '16px' }}><FiAlertCircle /></div>
                      <h3 style={{ color: 'white', marginBottom: '12px' }}>{hintConfirmLevel > 0 ? `Use Hint ${hintConfirmLevel}?` : 'Use Hint?'}</h3>
                      <p style={{ color: '#ccc', marginBottom: '24px' }}>
                        {hintConfirmLevel === 1 && "Using Hint 1 will apply a small score penalty (-10%)."}
                        {hintConfirmLevel === 2 && "Using Hint 2 will apply a larger score penalty (-25%)."}
                        {hintConfirmLevel === 0 && "Using a hint will result in a score deduction for this question."}
                        <br />Are you sure you want to proceed?
                      </p>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={() => { setShowHintConfirm(false); setHintConfirmLevel(0); }}
                          style={{ padding: '10px 20px', borderRadius: '6px', background: '#333', color: 'white', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => {
                          if (hintConfirmLevel > 0) { setHintsRevealed(hintConfirmLevel); setHintsUsedCount(hintConfirmLevel); }
                          else { setHintVisible(true); setHintUsed(true); setHintsUsedCount(prev => prev + 1); }
                          setShowHintConfirm(false); setHintConfirmLevel(0);
                        }} style={{ padding: '10px 20px', borderRadius: '6px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Yes, Show Hint</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </LockdownManager>
          )
        )}
      </MediaPermissionGate>
    </div>
  );
};

export default InterviewPage;