import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import InterviewController from '../components/InterviewController';
import MediaAnalyzer from '../components/MediaAnalyzer';

const InterviewPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Refs
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const interviewRef = useRef(null); // Add ref to track interview

  // State
  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [videoMetrics, setVideoMetrics] = useState({});
  const [audioLevel, setAudioLevel] = useState(0);

  // API base URL
  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  // Update ref whenever interview changes
  useEffect(() => {
    interviewRef.current = interview;
    console.log("Interview ref updated:", interview);
  }, [interview]);

  // Helper function to determine supported MIME type
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/wav',
      'audio/mp3'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`Supported MIME type found: ${type}`);
        return type;
      }
    }

    console.log('No specific MIME type supported, using browser default');
    return undefined;
  };

  // Load interview data
  useEffect(() => {
    console.log("useEffect triggered | sessionId:", sessionId);
    loadInterview();

    // Cleanup function
    return () => {
      console.log("Cleanup: Stopping media tracks");

      // Stop MediaRecorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Stop all media tracks
      if (webcamRef.current && webcamRef.current.srcObject) {
        webcamRef.current.srcObject.getTracks().forEach(track => {
          track.stop();
        });
      }

      // Clear refs
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    };
  }, [sessionId]);

  const loadInterview = async () => {
    console.log("loadInterview called");

    try {
      console.log("Calling API:", `${API_BASE}/interview/status/${sessionId}`);

      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);

      console.log("Interview status response:", response.data);

      if (response.data.success) {
        console.log("Interview data:", response.data.interview);
        console.log("bhai interview store ho raha hai ", response.data.interview);

        // Set interview state only ONCE
        const interviewData = response.data.interview;
        setInterview(interviewData);

        const currentQ = interviewData.questions[interviewData.currentQuestion];
        console.log("Current Question:", currentQ);

        setCurrentQuestion(currentQ);

        if (currentQ) {
          console.log("Playing question text:", currentQ.text);
          playQuestion(currentQ.text, currentQ.audio);
        }
      }
    } catch (error) {
      console.error("loadInterview error:", error);
      toast.error("Failed to load interview");
    }
  };

  // Play question audio
  const playQuestion = async (text, audioBase64 = null) => {
    console.log("playQuestion called with text:", text);

    try {
      // Stop any existing recording first
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }

      setIsPlaying(true);
      let audioBlob;

      if (audioBase64) {
        console.log("Using pre-fetched audio from backend");
        const byteCharacters = atob(audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        audioBlob = new Blob([byteArray], { type: 'audio/mp3' });
      } else {
        console.log("Calling TTS API fallback:", `${API_BASE}/ai/text-to-speech`);
        const response = await axios.post(
          `${API_BASE}/ai/text-to-speech`,
          { text },
          { responseType: "blob" }
        );
        audioBlob = response.data;
      }

      console.log("Audio blob ready", audioBlob.size, "bytes");

      if (audioBlob.size < 100) {
        console.error("Audio blob too small, likely an error");
        throw new Error("Invalid audio response");
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.oncanplaythrough = () => {
        console.log("Audio loaded, starting playback");
        audio.play().catch(e => {
          console.error("Playback failed start:", e);
          setIsPlaying(false);
          startRecording();
        });
      };

      audio.onended = () => {
        console.log("Audio playback ended");
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);

        // Small delay before starting recording
        setTimeout(() => {
          startRecording();
        }, 500);
      };

      audio.onerror = (err) => {
        console.error("Audio playback error event:", audio.error);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        startRecording();
      };

    } catch (error) {
      console.error("playQuestion error:", error);
      setIsPlaying(false);
      startRecording();
    }
  };

  // Handle recording stop - NOW A SEPARATE FUNCTION THAT CAN ACCESS LATEST STATE
  const handleRecordingStop = async () => {
    console.log("========== handleRecordingStop STARTED ==========");

    // Get current interview from ref
    const currentInterview = interviewRef.current;
    console.log("Current interview from ref:", currentInterview);

    if (!currentInterview) {
      console.error("Interview is still null in handleRecordingStop!");
      console.log("Session ID:", sessionId);
      console.log("Attempting to load interview again...");

      try {
        // Try to reload interview
        const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
        if (response.data.success) {
          const interviewData = response.data.interview;
          console.log("Reloaded interview:", interviewData);
          setInterview(interviewData);

          // Retry with new data
          await processRecordingStop(interviewData);
          return;
        }
      } catch (err) {
        console.error("Failed to reload interview:", err);
      }

      toast.error("Interview data lost. Please refresh the page.");
      return;
    }

    // Process with the interview data
    await processRecordingStop(currentInterview);
  };

  // Separate function to process recording stop
  const processRecordingStop = async (interviewData) => {
    console.log("Processing recording stop with interview:", interviewData);

    // Stop all media tracks
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

    console.log("Audio blob size:", audioBlob.size, "type:", audioBlob.type);
    console.log("Question index:", interviewData.currentQuestion);

    const formData = new FormData();
    formData.append("audio", audioBlob, "answer.webm");
    formData.append("interviewId", sessionId);
    formData.append("questionIndex", interviewData.currentQuestion);
    formData.append("videoMetrics", JSON.stringify(videoMetrics));

    try {
      toast.loading("Processing answer...");
      console.log("Submitting answer API call to:", `${API_BASE}/interview/submit-answer`);

      const response = await axios.post(
        `${API_BASE}/interview/submit-answer`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000
        }
      );

      toast.dismiss();
      console.log("Submit answer response:", response.data);

      if (response.data.success) {
        if (response.data.isComplete) {
          console.log("Interview completed");
          navigate(`/results/${sessionId}`);
        } else {
          console.log("Moving to next question:", response.data.nextQuestion);

          // Update state
          setInterview((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              currentQuestion: prev.currentQuestion + 1,
              metrics: {
                ...prev.metrics,
                completedQuestions: prev.metrics.completedQuestions + 1,
              },
            };
          });

          setCurrentQuestion(response.data.nextQuestion);

          setTimeout(() => {
            playQuestion(response.data.nextQuestion.text, response.data.nextQuestion.audio);
          }, 1000);
        }
      } else {
        console.error("Server returned error:", response.data.message);
        toast.error(`Error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error in processRecordingStop:", error);
      toast.error("Failed to submit answer");

      if (error.response) {
        console.error("Response error:", error.response.data);
      }
    } finally {
      // Clear audio chunks for next recording
      audioChunksRef.current = [];
    }
  };

  // Start recording answer
  const startRecording = async () => {
    console.log("startRecording called");
    console.log("Current interview state:", interview);
    console.log("Current interview ref:", interviewRef.current);

    try {
      // Stop any existing media tracks first
      if (webcamRef.current && webcamRef.current.srcObject) {
        webcamRef.current.srcObject.getTracks().forEach(track => track.stop());
      }

      // Get user media with appropriate constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: "user",
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      console.log("Media stream obtained:", stream);

      // Check available tracks
      console.log("Audio tracks:", stream.getAudioTracks());
      console.log("Video tracks:", stream.getVideoTracks());

      if (stream.getAudioTracks().length === 0) {
        toast.error("No microphone access. Please check permissions.");
        return;
      }

      // Attach stream to webcam
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }

      // Determine supported MIME type
      const mimeType = getSupportedMimeType();
      console.log("Using MIME type:", mimeType);

      // Create audio-only stream for recording
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        toast.error("No audio track available");
        return;
      }

      const audioStream = new MediaStream([audioTrack]);

      // Initialize MediaRecorder with options
      const options = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }
      options.audioBitsPerSecond = 128000;

      const mediaRecorder = new MediaRecorder(audioStream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log("Audio chunk received:", event.data.size, "bytes");
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // IMPORTANT: Bind the handler properly
      mediaRecorder.onstop = () => {
        console.log("MediaRecorder onstop event fired");
        handleRecordingStop();
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast.error("Recording error occurred");
        setIsRecording(false);
      };

      mediaRecorder.onstart = () => {
        console.log("MediaRecorder successfully started");
        setIsRecording(true);
        setTimerKey(prev => prev + 1); // Reset timer
        toast.success("Recording started");
      };

      // Start with timeslice for better performance
      mediaRecorder.start(100); // Collect data every 100ms
      console.log("MediaRecorder.start() called");

    } catch (err) {
      console.error("Error in startRecording:", err);

      // Specific error handling
      if (err.name === 'NotSupportedError') {
        toast.error("Media recording not supported in this browser");
      } else if (err.name === 'NotFoundError') {
        toast.error("No media devices found");
      } else if (err.name === 'NotReadableError') {
        toast.error("Media device is busy");
      } else if (err.name === 'PermissionDeniedError' || err.name === 'SecurityError') {
        toast.error("Permission denied. Please allow camera/microphone access.");
      } else if (err.name === 'TypeError') {
        toast.error("Invalid constraints or parameters");
      } else {
        toast.error(`Recording error: ${err.message}`);
      }

      setIsRecording(false);
    }
  };

  // Stop recording and submit
  const stopRecording = () => {
    console.log("stopRecording called");

    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        console.log("MediaRecorder.stop() called");
      } catch (err) {
        console.error("Error stopping MediaRecorder:", err);
        setIsRecording(false);
        // Still try to process if stop fails
        handleRecordingStop();
      }
    } else {
      console.log("No active recording to stop");
    }
  };

  // Skip question (with penalty)
  const skipQuestion = async () => {
    console.log("skipQuestion called");

    if (!window.confirm("Skip this question?")) return;

    // Check if interview exists
    if (!interview) {
      toast.error("Interview data not loaded");
      await loadInterview();
      return;
    }

    console.log("Skipping question index:", interview.currentQuestion);

    try {
      const formData = new FormData();
      formData.append("interviewId", sessionId);
      formData.append("questionIndex", interview.currentQuestion);
      formData.append("skipped", "true");

      const response = await axios.post(
        `${API_BASE}/interview/submit-answer`,
        formData
      );

      console.log("Skip response:", response.data);

      if (response.data.success && response.data.nextQuestion) {
        setCurrentQuestion(response.data.nextQuestion);
        setInterview((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            currentQuestion: prev.currentQuestion + 1,
            metrics: {
              ...prev.metrics,
              completedQuestions: prev.metrics.completedQuestions + 1,
            },
          };
        });

        setTimeout(() => {
          playQuestion(response.data.nextQuestion.text);
        }, 1000);
      }
    } catch (error) {
      console.error("skipQuestion error:", error);
      toast.error("Failed to skip question");
    }
  };

  // End interview early
  const endInterview = async () => {
    console.log("endInterview called");

    if (!window.confirm("End interview early? Your progress will be saved.")) return;

    try {
      await axios.post(`${API_BASE}/interview/end/${sessionId}`);
      console.log("Interview ended");
      navigate(`/results/${sessionId}`);
    } catch (error) {
      console.error("endInterview error:", error);
      toast.error("Failed to end interview");
    }
  };

  return (
    <div className="interview-page">
      {/* Loading overlay */}
      {!interview ? (
        <div className="loading-overlay">
          <div className="loading-spinner-large"></div>
          <p>Loading interview session...</p>
          <button
            onClick={loadInterview}
            style={{ marginTop: '20px', padding: '10px 20px' }}
          >
            Retry Loading
          </button>
        </div>
      ) : null}

      <div className="interview-header">
        <h1>AI Interview Session</h1>
        <p>Position: {interview?.position || 'Loading...'} | Candidate: {interview?.candidateName || 'Loading...'}</p>
      </div>

      <div className="interview-container">
        {/* Left Column - Video & Metrics */}
        <div className="video-column">
          <div className="video-container">
            <Webcam
              ref={webcamRef}
              audio={false} // Let getUserMedia handle audio separately
              screenshotFormat="image/jpeg"
              className="webcam-feed"
              videoConstraints={{
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                facingMode: "user",
                frameRate: { ideal: 30 }
              }}
              onUserMedia={(stream) => {
                console.log("Webcam stream ready:", stream);
              }}
              onUserMediaError={(err) => {
                console.error("Webcam error:", err);
                toast.error(`Camera error: ${err.message}`);
              }}
            />

            <MediaAnalyzer
              webcamRef={webcamRef}
              onMetricsUpdate={setVideoMetrics}
              onAudioLevel={setAudioLevel}
            />

            {/* Audio Level Indicator */}
            <div className="audio-level">
              <div
                className="audio-bar"
                style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
              />
              <span>Audio Level: {Math.round(audioLevel * 100)}%</span>
            </div>
          </div>

          {/* Metrics Display */}
          <div className="metrics-display">
            <h3>Live Metrics</h3>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Attention</span>
                <span className="metric-value">
                  {videoMetrics.attention ? Math.round(videoMetrics.attention * 100) : '0'}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Eye Contact</span>
                <span className="metric-value">
                  {videoMetrics.eyeContact ? Math.round(videoMetrics.eyeContact * 100) : '0'}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Confidence</span>
                <span className="metric-value">
                  {videoMetrics.confidence ? Math.round(videoMetrics.confidence * 100) : '0'}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Questions</span>
                <span className="metric-value">
                  {interview?.metrics?.completedQuestions || 0}/{interview?.metrics?.totalQuestions || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Questions & Controls */}
        <div className="control-column">
          {/* Current Question */}
          <div className="question-container">
            <h2>Current Question</h2>
            {currentQuestion ? (
              <div className="question-card">
                <div className="question-header">
                  <span className="question-type">{currentQuestion.type}</span>
                  <span className="question-difficulty">{currentQuestion.difficulty}</span>
                </div>
                <p className="question-text">{currentQuestion.text}</p>

                {/* Timer */}
                {isRecording && (
                  <div className="recording-timer">
                    <CountdownCircleTimer
                      key={timerKey}
                      isPlaying={isRecording}
                      duration={currentQuestion.expectedTime || 120}
                      colors={['#00FF00', '#F7B801', '#FF0000']}
                      colorsTime={[currentQuestion.expectedTime || 120, (currentQuestion.expectedTime || 120) / 2, 0]}
                      size={80}
                      strokeWidth={6}
                      onComplete={stopRecording}
                    >
                      {({ remainingTime }) => (
                        <div className="timer-display">
                          <span>{remainingTime}</span>
                          <small>seconds</small>
                        </div>
                      )}
                    </CountdownCircleTimer>
                    <p className="recording-status">Recording...</p>
                  </div>
                )}

                {isPlaying && (
                  <div className="playing-status">
                    <div className="loading-spinner" />
                    <p>Playing question...</p>
                  </div>
                )}

                {!isPlaying && !isRecording && (
                  <div className="ready-status">
                    <p>Ready to record answer</p>
                    <button
                      onClick={startRecording}
                      className="start-button"
                    >
                      Start Recording
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p>Loading question...</p>
            )}
          </div>

          {/* Controls */}
          <InterviewController
            isRecording={isRecording}
            isPlaying={isPlaying}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onSkipQuestion={skipQuestion}
            onEndInterview={endInterview}
            disabled={!currentQuestion}
          />

          {/* Progress */}
          <div className="progress-section">
            <h3>Interview Progress</h3>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${interview && interview.metrics && interview.metrics.totalQuestions ?
                    (interview.metrics.completedQuestions / interview.metrics.totalQuestions) * 100 : 0}%`
                }}
              />
            </div>
            <div className="progress-stats">
              <span>Question {interview ? interview.currentQuestion + 1 : 0} of {interview?.metrics?.totalQuestions || 0}</span>
              <span>
                Estimated time remaining: {Math.max(0, ((interview?.metrics?.totalQuestions || 0) - (interview?.currentQuestion || 0) - 1) * 2)} minutes
              </span>
            </div>

            {/* Debug info */}
            <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
              <p>Debug: Interview loaded: {interview ? 'Yes' : 'No'}</p>
              <p>Debug: Current question: {currentQuestion ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;