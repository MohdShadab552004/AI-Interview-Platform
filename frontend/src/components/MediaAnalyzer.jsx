import React, { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import toast from 'react-hot-toast';

const MediaAnalyzer = ({ webcamRef, onMetricsUpdate, onAudioLevel }) => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  // Initialize face mesh
  useEffect(() => {
    if (!webcamRef.current?.video) return;

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      handleFaceResults(results);
    });

    const camera = new Camera(webcamRef.current.video, {
      onFrame: async () => {
        if (webcamRef.current?.video && canvasRef.current) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;

          // Sync canvas dimensions with video
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          await faceMesh.send({ image: video });
        }
      },
      width: 1280, // Default higher resolution
      height: 720
    });

    camera.start();

    return () => {
      camera.stop();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [webcamRef]);

  // Initialize audio analysis
  useEffect(() => {
    if (!webcamRef.current?.stream) return;

    const setupAudioAnalysis = async () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(webcamRef.current.stream);

        source.connect(analyser);
        analyser.fftSize = 256;

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        updateAudioLevel();
      } catch (error) {
        console.error('Audio analysis setup failed:', error);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [webcamRef]);

  const handleFaceResults = (results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      onMetricsUpdate(prev => ({
        ...prev,
        attention: 0,
        eyeContact: 0,
        confidence: 0,
        faceDetected: false
      }));
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Calculate eye aspect ratio (simplified)
    const leftEye = landmarks[33];  // Approx left eye center
    const rightEye = landmarks[263]; // Approx right eye center
    const noseTip = landmarks[1];   // Nose tip

    // Simple attention calculation based on head orientation
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const faceCenter = (leftEye.x + rightEye.x) / 2;
    const deviation = Math.abs(faceCenter - 0.5); // 0.5 is screen center

    const attentionScore = Math.max(0, 1 - deviation * 2);
    const eyeContactScore = attentionScore > 0.7 ? attentionScore : 0;

    // Confidence based on head tilt and expression
    const noseDeviation = Math.abs(noseTip.x - faceCenter);
    const confidenceScore = Math.max(0, 1 - noseDeviation * 3);

    onMetricsUpdate({
      attention: attentionScore,
      eyeContact: eyeContactScore,
      confidence: confidenceScore,
      faceDetected: true
    });

    // Draw landmarks on canvas (optional)
    drawLandmarks(landmarks);
  };

  const drawLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw face mesh (simplified)
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 1;

    // Draw key points
    landmarks.forEach((point, i) => {
      if (i % 10 === 0) { // Draw every 10th point for performance
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
      }
    });
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);

    onAudioLevel(normalizedLevel);

    animationRef.current = requestAnimationFrame(updateAudioLevel);
  };

  return (
    <canvas
      ref={canvasRef}
      className="face-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    />
  );
};

export default MediaAnalyzer;