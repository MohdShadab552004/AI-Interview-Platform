import React, { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import toast from 'react-hot-toast';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';


const MediaAnalyzer = ({ webcamRef, onMetricsUpdate, onAudioLevel, onCalibrationComplete, skipCalibration }) => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const netRef = useRef(null);
  const gazeHistoryRef = useRef([]);
  const headMovementRef = useRef([]);
  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  // Pose Refs
  const lastShoulderYRef = useRef(null);
  const movementHistoryRef = useRef([]);

  // Advanced Proctoring Persistence
  const objectPersistenceRef = useRef({ objects: [], framesRemaining: 0 });
  const irisStretchRef = useRef({ left: 0.5, right: 0.5 });

  const [calibrationState, setCalibrationState] = React.useState({
    isCalibrating: !skipCalibration,
    progress: skipCalibration ? 100 : 0
  });

  // Use ref for FaceMesh callback access
  const calibrationStateRef = useRef(calibrationState);
  useEffect(() => {
    calibrationStateRef.current = calibrationState;
  }, [calibrationState]);

  // Initialize face mesh
  useEffect(() => {
    if (!webcamRef.current?.video) return;

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 2,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Initialize COCO-SSD model
    const loadModel = async () => {
      try {
        const model = await cocoSsd.load();
        netRef.current = model;
        console.log("Object detection model loaded");
      } catch (err) {
        console.error("Failed to load object detection model", err);
      }
    };
    loadModel();

    faceMesh.onResults((results) => {
      handleFaceResults(results);
    });

    // 2. Pose
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results) => {
      handlePoseResults(results);
    });

    const camera = new Camera(webcamRef.current.video, {
      onFrame: async () => {
        if (webcamRef.current?.video && canvasRef.current) {
          const video = webcamRef.current.video;

          if (video.readyState < 2) return;

          const canvas = canvasRef.current;

          // Sync canvas dimensions with video
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          // Network/Performance Check
          const now = performance.now();
          const delta = now - lastFrameTimeRef.current;
          lastFrameTimeRef.current = now;
          const fps = 1000 / delta;
          const networkQuality = Math.min(1, Math.max(0, fps / 30)); // 0 to 1 score

          // Object Detection (Throttled: every 30 frames ~ 1 sec)
          let detectedObjects = [];
          if (netRef.current && frameCountRef.current % 30 === 0) {
            try {
              const predictions = await netRef.current.detect(video);
              detectedObjects = predictions
                .filter(p => ['cell phone', 'laptop', 'book', 'paper'].includes(p.class))
                .map(p => p.class);
            } catch (e) {
              console.error("Detection error:", e);
            }
          }
          frameCountRef.current++;

          // Update object detection results (only on the throttled frame)
          if (frameCountRef.current % 30 === 0) {
            canvas.detectedObjects = detectedObjects;

            // Persistence Logic
            if (detectedObjects.length > 0) {
              objectPersistenceRef.current = {
                objects: detectedObjects,
                framesRemaining: 90 // Persistent for ~3 seconds at 30fps
              };
            }
          }

          // Decrement persistence
          if (objectPersistenceRef.current.framesRemaining > 0) {
            objectPersistenceRef.current.framesRemaining--;
          } else {
            objectPersistenceRef.current.objects = [];
          }

          canvas.networkQuality = networkQuality;
          canvas.persistedObjects = objectPersistenceRef.current.objects;

          await faceMesh.send({ image: video });
          await pose.send({ image: video });
        }
      },
      width: 1280,
      height: 720
    });

    const startCamera = () => {
      if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState >= 2) {
        camera.start();
      } else {
        requestAnimationFrame(startCamera);
      }
    };
    startCamera();

    return () => {
      camera.stop();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [webcamRef]);

  // Initialize audio analysis
  useEffect(() => {
    // We need to wait for the video element to have a srcObject (the stream)
    const checkStream = setInterval(() => {
      if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
        clearInterval(checkStream);
        setupAudioAnalysis(webcamRef.current.video.srcObject);
      }
    }, 1000);

    return () => clearInterval(checkStream);
  }, [webcamRef]);

  const setupAudioAnalysis = (stream) => {
    try {
      // Close existing context if any
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Ensure context is running (fixes 0% audio issue in some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('MediaStream has no audio tracks for analysis');
        return;
      }

      const source = audioContext.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;


      // Start loop
      updateAudioLevel();
    } catch (error) {
      console.error('Audio analysis setup failed:', error);
    }
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;

    // Normalize to 0-100
    const normalized = Math.min(100, Math.round((average / 128) * 100)); // boost sensitivity

    if (onAudioLevel) {
      onAudioLevel(normalized);
    }

    animationRef.current = requestAnimationFrame(updateAudioLevel);
  };


  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // handlePoseResults
  const handlePoseResults = (results) => {
    if (!results.poseLandmarks) return;

    const landmarks = results.poseLandmarks;

    // 1. Posture Check (Shoulder Alignment)
    // Landmarks: 11 (Left Shoulder), 12 (Right Shoulder)
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    let postureStatus = "Good";
    if (leftShoulder && rightShoulder) {
      const yDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      if (yDiff > 0.05) { // Threshold for tilt
        postureStatus = "Poor (Shoulders Tilted)";
      }
    }

    // 2. Excessive Movement logic
    // Calculate average movement of shoulders
    let movementScore = 0;
    if (lastShoulderYRef.current !== null && leftShoulder) {
      const delta = Math.abs(leftShoulder.y - lastShoulderYRef.current);
      movementHistoryRef.current.push(delta);
      if (movementHistoryRef.current.length > 20) movementHistoryRef.current.shift(); // Keep last 20 frames (~1 sec)

      const avgMove = movementHistoryRef.current.reduce((a, b) => a + b, 0) / movementHistoryRef.current.length;
      movementScore = avgMove * 100; // Scale up
    }
    if (leftShoulder) lastShoulderYRef.current = leftShoulder.y;


    // Update metrics
    onMetricsUpdate(prev => ({
      ...prev,
      posture: postureStatus,
      movementScore: movementScore,
      detectedObjects: canvasRef.current?.persistedObjects || [] // Use persistent objects
    }));
  };
  const handleFaceResults = (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentState = calibrationStateRef.current;

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (currentState.isCalibrating) {
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText("Scanning... Face not found", canvas.width / 2, canvas.height / 2);
        return;
      }

      onMetricsUpdate(prev => ({
        ...prev,
        attention: 0,
        eyeContact: 0,
        confidence: 0,
        faceDetected: false,
        faceCount: 0
      }));
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // CALIBRATION PHASE
    if (currentState.isCalibrating) {
      const newProgress = currentState.progress + 2; // Increment progress

      // Draw Calibration UI (Blue Mesh)
      ctx.fillStyle = '#00BFFF'; // Blue color for scanning
      ctx.globalAlpha = 0.8;
      landmarks.forEach((point) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Progress Bar
      const barWidth = 300;
      const barHeight = 20;
      const x = (canvas.width - barWidth) / 2;
      const y = canvas.height - 50;

      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(x, y, barWidth * (currentState.progress / 100), barHeight);

      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(`Calibrating Face ID... ${Math.round(currentState.progress)}%`, canvas.width / 2, y - 10);

      if (newProgress >= 100) {
        setCalibrationState({ isCalibrating: false, progress: 100 });
        if (onCalibrationComplete) onCalibrationComplete();
        toast.success("Face Calibration Complete");
      } else {
        setCalibrationState(prev => ({ ...prev, progress: newProgress }));
      }
      return; // STOP HERE during calibration
    }

    // NORMAL PROCTORING LOGIC STARTS HERE
    // Calculate eye aspect ratio (simplified)
    const leftEye = landmarks[33];  // Approx left eye center
    const rightEye = landmarks[263]; // Approx right eye center
    const noseTip = landmarks[1];   // Nose tip

    // Simple attention calculation based on head orientation
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const faceCenter = (leftEye.x + rightEye.x) / 2;
    const deviation = Math.abs(faceCenter - 0.5); // 0.5 is screen center

    // Restore missing metrics calculations
    const attentionScore = Math.max(0, 1 - deviation * 2);
    const eyeContactScore = attentionScore > 0.7 ? attentionScore : 0;
    const noseDeviation = Math.abs(noseTip.x - faceCenter);
    const confidenceScore = Math.max(0, 1 - noseDeviation * 3);

    // Advanced Gaze & Stress Analysis

    // 1. Calculate Face Orientation & Jitter (Stress)
    const nose = landmarks[1];
    const headMovement = { x: nose.x, y: nose.y, time: Date.now() };
    headMovementRef.current.push(headMovement);
    if (headMovementRef.current.length > 30) headMovementRef.current.shift();

    // Calculate variance in movement (Jitter)
    let jitter = 0;
    if (headMovementRef.current.length > 1) {
      const recent = headMovementRef.current;
      const distances = recent.slice(1).map((p, i) => Math.sqrt(Math.pow(p.x - recent[i].x, 2) + Math.pow(p.y - recent[i].y, 2)));
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      jitter = Math.min(1, avgDist * 100); // Normalize heuristic
    }
    const stressScore = jitter; // Simple proxy for "shakiness/nervousness"

    // 2. Smart Gaze Analysis
    // Iris landmarks: Left 468, Right 473
    const leftIris = landmarks[468];
    const rightIris = landmarks[473];

    // Horizontal Gate (X)
    const leftEyeInner = landmarks[33];
    const leftEyeOuter = landmarks[133];
    const rightEyeInner = landmarks[362];
    const rightEyeOuter = landmarks[263];

    // Vertical Gaze (Y) - Eyelids
    // Left: Top 159, Bottom 145
    // Right: Top 386, Bottom 374
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];

    const getGazeRatio = (iris, p1, p2, isX) => {
      const totalDist = isX ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y);
      const irisDist = isX ? Math.abs(iris.x - p1.x) : Math.abs(iris.y - p1.y);
      return irisDist / totalDist;
    };

    const leftGazeX = getGazeRatio(leftIris, leftEyeInner, leftEyeOuter, true);
    const rightGazeX = getGazeRatio(rightIris, rightEyeInner, rightEyeOuter, true);
    const gazeX = (leftGazeX + rightGazeX) / 2;

    const leftGazeY = getGazeRatio(leftIris, leftEyeTop, leftEyeBottom, false);
    const rightGazeY = getGazeRatio(rightIris, rightEyeTop, rightEyeBottom, false);
    const gazeY = (leftGazeY + rightGazeY) / 2;

    // Store gaze history
    gazeHistoryRef.current.push({ x: gazeX, y: gazeY, time: Date.now() });
    if (gazeHistoryRef.current.length > 50) gazeHistoryRef.current.shift();

    // Analyze Pattern
    let gazePattern = 'natural';
    const isHeadStraight = noseDeviation < 0.1;
    const isLookingSide = Math.abs(gazeX - 0.5) > 0.25;
    const isLookingUp = gazeY < 0.2; // Looking UP (Iris very close to top eyelid)

    if (gazeHistoryRef.current.length > 10) {
      const recentGaze = gazeHistoryRef.current.slice(-20);
      const xValues = recentGaze.map(g => g.x);
      const avgX = xValues.reduce((a, b) => a + b, 0) / xValues.length;

      // EXTREME STRETCH DETECTION (Retina tilt with straight head)
      const leftStretch = Math.abs(leftGazeX - 0.5);
      const rightStretch = Math.abs(rightGazeX - 0.5);
      const isStretched = leftStretch > 0.4 || rightStretch > 0.4; // 90% towards corner

      if (isHeadStraight && isStretched) {
        gazePattern = 'extreme_side_gaze';
      } else if (isHeadStraight && isLookingSide) {
        gazePattern = 'suspicious_side_eye';
      } else if (Math.abs(avgX - 0.5) > 0.35) {
        gazePattern = 'suspicious_side';
      } else if (isLookingUp) {
        gazePattern = 'thinking';
      }
    }

    const detectedObjects = canvasRef.current?.persistedObjects || [];
    const networkQuality = canvasRef.current?.networkQuality || 1;

    onMetricsUpdate({
      attention: attentionScore,
      eyeContact: eyeContactScore,
      confidence: confidenceScore,
      stress: stressScore,
      faceDetected: true,
      faceCount: results.multiFaceLandmarks.length,
      gazePattern: gazePattern,
      detectedObjects: detectedObjects,
      networkQuality: networkQuality
    });

    drawFaceUI(ctx, landmarks, attentionScore, { gazeX, gazeY });
  };

  /* Updated to draw full face mesh dots with highlighted Eyes/Irises and Gaze Vectors */
  const drawFaceUI = (ctx, landmarks, attentionScore, gazeData = { gazeX: 0.5, gazeY: 0.5 }) => {
    // Colors
    const isAttentive = attentionScore > 0.6;
    const color = isAttentive ? '#00FF00' : '#FF0000'; // Green if attentive, Red if not

    ctx.globalAlpha = 0.6;

    // Draw all 478 landmarks as small dots
    landmarks.forEach((point) => {
      const x = point.x * canvasRef.current.width;
      const y = point.y * canvasRef.current.height;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    });

    // --- HIGHLIGHT EYES & IRISES ---
    ctx.globalAlpha = 1.0;

    // Irises: Left 468, Right 473
    const leftIris = landmarks[468];
    const rightIris = landmarks[473];

    [leftIris, rightIris].forEach(iris => {
      const x = iris.x * canvasRef.current.width;
      const y = iris.y * canvasRef.current.height;

      // Draw Iris Circle
      ctx.fillStyle = '#FFFF00'; // Yellow
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI); // Larger dot for iris
      ctx.fill();

      // Draw white ring around iris
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw Gaze Vector Line
      // Calculate direction based on gaze ratios (0.5 is center)
      // Mirroring: As canvas is mirrored, we invert X direction
      const dx = (gazeData.gazeX - 0.5) * 150;
      const dy = (gazeData.gazeY - 0.5) * 100;

      ctx.strokeStyle = '#FF00FF'; // Magenta for high visibility
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    });

    // If not attentive, draw general alert text
    if (!isAttentive) {
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#FF0000';
      ctx.textAlign = 'center';
      ctx.fillText("⚠️ PLEASE LOOK AT THE SCREEN", ctx.canvas.width / 2, 50);
    }
  };



  return (
    <>
      <canvas
        ref={canvasRef}
        className="face-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1)', // Mirror to match webcam
          pointerEvents: 'none'
        }}
      />
      {/* Hidden detection status for debug if needed */}
    </>
  );
};

export default MediaAnalyzer;