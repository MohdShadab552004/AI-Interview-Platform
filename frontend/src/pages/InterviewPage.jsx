import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import InterviewController from '../components/InterviewController';
import MediaAnalyzer from '../components/MediaAnalyzer';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';
import { FiMonitor, FiVideo, FiMic, FiAlertCircle, FiSettings, FiCheck } from 'react-icons/fi';

const InterviewPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Refs
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const interviewRef = useRef(null);
  const audioRef = useRef(null);

  // State
  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [videoMetrics, setVideoMetrics] = useState({});
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    interviewRef.current = interview;
  }, [interview]);

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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [sessionId]);

  const loadInterview = async () => {
    try {
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
      if (response.data.success) {
        setInterview(response.data.interview);
        const currentQ = response.data.interview.questions[response.data.interview.currentQuestion];
        setCurrentQuestion(currentQ);
        if (currentQ) playQuestion(currentQ.text, currentQ.audio);
      }
    } catch (error) {
      toast.error("Failed to load interview session");
    }
  };

  const playQuestion = async (text, audioBase64 = null) => {
    try {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      setIsPlaying(true);
      let audioBlob;

      if (audioBase64) {
        const byteCharacters = atob(audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        audioBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/mp3' });
      } else {
        const response = await axios.post(`${API_BASE}/ai/text-to-speech`, { text }, { responseType: "blob" });
        audioBlob = response.data;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        audio.play().catch(() => {
          setIsPlaying(false);
          startRecording();
        });
      };

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setTimeout(startRecording, 500);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        startRecording();
      };
    } catch (error) {
      console.error(error);
      setIsPlaying(false);
      startRecording();
    }
  };

  const handleRecordingStop = async () => {
    const currentInterview = interviewRef.current;
    if (!currentInterview) return;

    if (webcamRef.current && webcamRef.current.srcObject) {
      webcamRef.current.srcObject.getTracks().forEach(track => track.stop());
    }

    if (audioChunksRef.current.length === 0) {
      toast.error("No audio recorded");
      return;
    }

    const audioBlob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm'
    });

    const formData = new FormData();
    formData.append("audio", audioBlob, "answer.webm");
    formData.append("interviewId", sessionId);
    formData.append("questionIndex", currentInterview.currentQuestion);
    formData.append("videoMetrics", JSON.stringify(videoMetrics));

    if (window.textAnswer) {
      formData.append("textAnswer", window.textAnswer);
      window.textAnswer = '';
    }
    if (window.codeAnswer) {
      formData.append("codeAnswer", window.codeAnswer);
      window.codeAnswer = '';
    }

    try {
      toast.loading("Processing your response...");
      const response = await axios.post(`${API_BASE}/interview/submit-answer`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      toast.dismiss();
      if (response.data.success) {
        if (response.data.isComplete) {
          navigate(`/results/${sessionId}`);
        } else {
          setInterview(prev => ({
            ...prev,
            currentQuestion: prev.currentQuestion + 1,
            metrics: { ...prev.metrics, completedQuestions: prev.metrics.completedQuestions + 1 }
          }));
          setCurrentQuestion(response.data.nextQuestion);
          setTimeout(() => playQuestion(response.data.nextQuestion.text, response.data.nextQuestion.audio), 1000);
        }
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to submit response");
    } finally {
      audioChunksRef.current = [];
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      if (webcamRef.current) webcamRef.current.srcObject = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(new MediaStream([stream.getAudioTracks()[0]]), {
        mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = handleRecordingStop;
      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setTimerKey(prev => prev + 1);
        toast.success("Recording started");
      };

      mediaRecorder.start(100);
    } catch (err) {
      toast.error("Recording error: Please check device permissions");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const skipQuestion = async () => {
    if (!window.confirm("Skip this question?")) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    try {
      const response = await axios.post(`${API_BASE}/interview/submit-answer`, {
        interviewId: sessionId,
        questionIndex: interview.currentQuestion,
        skipped: "true"
      });
      if (response.data.success) {
        if (response.data.isComplete) {
          navigate(`/results/${sessionId}`);
        } else {
          setCurrentQuestion(response.data.nextQuestion);
          setInterview(prev => ({
            ...prev,
            currentQuestion: prev.currentQuestion + 1,
            metrics: { ...prev.metrics, completedQuestions: prev.metrics.completedQuestions + 1 }
          }));
          setTimeout(() => playQuestion(response.data.nextQuestion.text, response.data.nextQuestion.audio), 1000);
        }
      }
    } catch (error) {
      toast.error("Failed to skip question");
    }
  };

  const endInterview = async () => {
    if (!window.confirm("End interview early?")) return;
    try {
      await axios.post(`${API_BASE}/interview/end/${sessionId}`);
      navigate(`/results/${sessionId}`);
    } catch (error) {
      toast.error("Failed to end interview");
    }
  };

  if (!interview) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner-large"></div>
        <p>Initializing Session...</p>
      </div>
    );
  }

  const isSetupMode = !isSetupComplete;

  return (
    <div className="interview-page">
      <header className="interview-header">
        <h1>AI Interview Session</h1>
        <p>{interview.position} | {interview.candidateName}</p>
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
                onClick={() => setIsSetupComplete(true)}
              >
                {isCalibrated ? <><FiCheck /> Begin Interview</> : "Calibrating AI..."}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="interview-container">
          <div className="video-column">
            <div className="video-container">
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
              {(videoMetrics.detectedObjects?.length > 0 || videoMetrics.gazePattern === 'suspicious_side' || videoMetrics.gazePattern === 'suspicious_side_eye') && (
                <div className="proctor-alert" style={{
                  background: (videoMetrics.gazePattern && videoMetrics.gazePattern.includes('suspicious')) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: (videoMetrics.gazePattern && videoMetrics.gazePattern.includes('suspicious')) ? '#fbbf24' : '#f87171',
                  borderColor: (videoMetrics.gazePattern && videoMetrics.gazePattern.includes('suspicious')) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                }}>
                  <FiAlertCircle />
                  {videoMetrics.detectedObjects?.length > 0
                    ? `Detected: ${videoMetrics.detectedObjects.join(', ')}`
                    : 'Suspicious Gaze Detected'}
                </div>
              )}
            </div>

            <div className="audio-level">
              <div className="audio-bar" style={{ width: `${Math.min(100, audioLevel * 100)}%` }} />
            </div>

            <div className="metrics-display">
              <h3>Live AI Proctoring</h3>
              <div className="metrics-grid">
                <div className="metric">
                  <span className="metric-label">Attention Source</span>
                  <span className="metric-value">{Math.round((videoMetrics.attention || 0) * 100)}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Eye Contact</span>
                  <span className="metric-value">{Math.round((videoMetrics.eyeContact || 0) * 100)}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Stress Indice</span>
                  <span className="metric-value" style={{ color: (videoMetrics.stress || 0) > 0.5 ? '#f87171' : '#34d399' }}>
                    {Math.round((videoMetrics.stress || 0) * 100)}%
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Connectivity</span>
                  <span className="metric-value">{Math.round((videoMetrics.networkQuality || 1) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="control-column">
            <div className="question-card">
              <div className="question-header">
                <span className="question-type">{currentQuestion?.type}</span>
                <span className="question-difficulty">{currentQuestion?.difficulty}</span>
              </div>
              <p className="question-text">{currentQuestion?.text}</p>

              {isRecording && (
                <div className="recording-indicator">
                  <CountdownCircleTimer
                    key={timerKey}
                    isPlaying={isRecording}
                    duration={currentQuestion?.expectedTime || 120}
                    colors={['#10B981', '#F59E0B', '#EF4444']}
                    colorsTime={[60, 30, 0]}
                    size={100}
                    strokeWidth={8}
                    onComplete={stopRecording}
                  >
                    {({ remainingTime }) => <div className="timer-val">{remainingTime}s</div>}
                  </CountdownCircleTimer>
                  <p className="rec-status">Recording Active</p>
                </div>
              )}

              {isPlaying && <div className="playing-pulse"><div className="pulse-dot"></div> Listening...</div>}

              {!isPlaying && !isRecording && currentQuestion?.type !== 'code' && (
                <textarea
                  placeholder="Optional: Type your thoughts or notes here..."
                  className="answer-textarea"
                  onChange={(e) => window.textAnswer = e.target.value}
                />
              )}

              {currentQuestion?.type === 'code' && !isRecording && !isPlaying && (
                <div className="code-editor-box">
                  <div className="editor-tab">Code Editor ({currentQuestion.language || 'JS'})</div>
                  <Editor
                    value={window.codeAnswer || ''}
                    onValueChange={code => window.codeAnswer = code}
                    highlight={code => highlight(code, languages.javascript)}
                    padding={20}
                    className="prism-editor"
                  />
                </div>
              )}
            </div>

            <InterviewController
              isRecording={isRecording}
              isPlaying={isPlaying}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onSkipQuestion={skipQuestion}
              onEndInterview={endInterview}
              onPlayQuestion={() => playQuestion(currentQuestion?.text, currentQuestion?.audio)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewPage;