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
  
  // Load interview data
  useEffect(() => {
    loadInterview();
  }, [sessionId]);
  
  const loadInterview = async () => {
    try {
      const response = await axios.get(`${API_BASE}/interview/status/${sessionId}`);
      if (response.data.success) {
        setInterview(response.data.interview);
        const currentQ = response.data.interview.questions[response.data.interview.currentQuestion];
        setCurrentQuestion(currentQ);
        
        if (currentQ) {
          playQuestion(currentQ.text);
        }
      }
    } catch (error) {
      toast.error('Failed to load interview');
      console.error('Error loading interview:', error);
    }
  };
  
  // Play question audio
  const playQuestion = async (text) => {
    try {
      setIsPlaying(true);
      
      const response = await axios.post(
        `${API_BASE}/ai/text-to-speech`,
        { text },
        { responseType: 'blob' }
      );
      
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlaying(false);
        startRecording();
      };
      
      audio.play();
    } catch (error) {
      console.error('Error playing question:', error);
      setIsPlaying(false);
      startRecording();
    }
  };
  
  // Start recording answer
  const startRecording = () => {
    if (!webcamRef.current?.stream) {
      toast.error('Camera/mic not available');
      return;
    }
    
    const stream = webcamRef.current.stream;
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = handleRecordingStop;
    
    mediaRecorder.start(1000); // Collect data every second
    setIsRecording(true);
    setTimerKey(prev => prev + 1);
    
    toast.success('Recording started. Speak your answer.');
  };
  
  // Stop recording and submit
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  // Handle recording stop
  const handleRecordingStop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    
    // Prepare form data
    const formData = new FormData();
    formData.append('audio', audioBlob, 'answer.webm');
    formData.append('interviewId', sessionId);
    formData.append('questionIndex', interview.currentQuestion);
    formData.append('videoMetrics', JSON.stringify(videoMetrics));
    
    try {
      toast.loading('Processing your answer...');
      
      const response = await axios.post(
        `${API_BASE}/interview/submit-answer`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      toast.dismiss();
      
      if (response.data.success) {
        if (response.data.isComplete) {
          // Interview complete
          toast.success('Interview completed!');
          navigate(`/results/${sessionId}`);
        } else {
          // Next question
          setCurrentQuestion(response.data.nextQuestion);
          setInterview(prev => ({
            ...prev,
            currentQuestion: prev.currentQuestion + 1,
            metrics: {
              ...prev.metrics,
              completedQuestions: prev.metrics.completedQuestions + 1
            }
          }));
          
          // Play next question
          setTimeout(() => {
            playQuestion(response.data.nextQuestion.text);
          }, 1000);
        }
      }
    } catch (error) {
      toast.error('Failed to submit answer');
      console.error('Error submitting answer:', error);
    }
  };
  
  // Skip question (with penalty)
  const skipQuestion = async () => {
    if (window.confirm('Skip this question? This may affect your score.')) {
      const emptyMetrics = {
        eyeContact: 0,
        attention: 0,
        confidence: 0
      };
      
      // Submit empty answer
      const formData = new FormData();
      formData.append('interviewId', sessionId);
      formData.append('questionIndex', interview.currentQuestion);
      formData.append('videoMetrics', JSON.stringify(emptyMetrics));
      
      try {
        const response = await axios.post(
          `${API_BASE}/interview/submit-answer`,
          formData
        );
        
        if (response.data.success) {
          if (response.data.isComplete) {
            navigate(`/results/${sessionId}`);
          } else {
            setCurrentQuestion(response.data.nextQuestion);
            setInterview(prev => ({
              ...prev,
              currentQuestion: prev.currentQuestion + 1
            }));
            
            setTimeout(() => {
              playQuestion(response.data.nextQuestion.text);
            }, 1000);
          }
        }
      } catch (error) {
        toast.error('Failed to skip question');
      }
    }
  };
  
  // End interview early
  const endInterview = async () => {
    if (window.confirm('End interview early? You will receive partial evaluation.')) {
      try {
        await axios.post(`${API_BASE}/interview/end/${sessionId}`);
        navigate(`/results/${sessionId}`);
      } catch (error) {
        toast.error('Failed to end interview');
      }
    }
  };
  
  return (
    <div className="interview-page">
      <div className="interview-header">
        <h1>AI Interview Session</h1>
        <p>Position: {interview?.position} | Candidate: {interview?.candidateName}</p>
      </div>
      
      <div className="interview-container">
        {/* Left Column - Video & Metrics */}
        <div className="video-column">
          <div className="video-container">
            <Webcam
              ref={webcamRef}
              audio={true}
              screenshotFormat="image/jpeg"
              className="webcam-feed"
              videoConstraints={{
                width: 640,
                height: 480,
                facingMode: "user"
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
                style={{ width: `${audioLevel * 100}%` }}
              />
              <span>Audio Level</span>
            </div>
          </div>
          
          {/* Metrics Display */}
          <div className="metrics-display">
            <h3>Live Metrics</h3>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Attention</span>
                <span className="metric-value">
                  {Math.round(videoMetrics.attention * 100)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Eye Contact</span>
                <span className="metric-value">
                  {Math.round(videoMetrics.eyeContact * 100)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Confidence</span>
                <span className="metric-value">
                  {Math.round(videoMetrics.confidence * 100)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Questions</span>
                <span className="metric-value">
                  {interview?.metrics.completedQuestions}/{interview?.metrics.totalQuestions}
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
                      duration={currentQuestion.expectedTime}
                      colors={['#00FF00', '#F7B801', '#FF0000']}
                      colorsTime={[currentQuestion.expectedTime, currentQuestion.expectedTime / 2, 0]}
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
          />
          
          {/* Progress */}
          <div className="progress-section">
            <h3>Interview Progress</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${(interview?.metrics.completedQuestions / interview?.metrics.totalQuestions) * 100}%` 
                }}
              />
            </div>
            <div className="progress-stats">
              <span>Question {interview?.currentQuestion + 1} of {interview?.metrics.totalQuestions}</span>
              <span>
                Estimated time remaining: {Math.max(0, (interview?.metrics.totalQuestions - interview?.currentQuestion - 1) * 2)} minutes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;