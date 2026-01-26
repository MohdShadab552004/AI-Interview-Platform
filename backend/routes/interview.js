const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const interviewService = require('../services/interviewService');

// Configure multer for audio upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Start new interview
router.post('/start', upload.single('cv'), async (req, res) => {
  try {
    const { candidateName, position, experienceLevel } = req.body;

    const interview = await interviewService.createInterview({
      candidateName,
      position: position || 'React Developer',
      experienceLevel: experienceLevel || 'Mid-level',
      userId: req.session.userId || 'anonymous',
      cvBuffer: req.file ? req.file.buffer : null
    });

    req.session.interviewId = interview.id;
    res.json({
      success: true,
      interview,
      sessionId: interview.id
    });
  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start interview'
    });
  }
});

// Submit answer (audio + metrics)
router.post('/submit-answer', upload.single('audio'), async (req, res) => {
  try {
    const { interviewId, questionIndex, videoMetrics, textAnswer, codeAnswer } = req.body;
    console.log('Interview ID:', interviewId);
    console.log('Question Index:', questionIndex);

    const audioFile = req.file;

    if (!audioFile && !textAnswer && !codeAnswer) {
      return res.status(400).json({
        success: false,
        error: 'No answer provided (audio, text, or code)'
      });
    }

    const result = await interviewService.processAnswer({
      interviewId,
      questionIndex: parseInt(questionIndex),
      audioBuffer: audioFile ? audioFile.buffer : null,
      audioMimeType: audioFile ? audioFile.mimetype : null,
      videoMetrics: JSON.parse(videoMetrics || '{}'),
      textAnswer,
      codeAnswer
    });

    res.json({
      success: true,
      nextQuestion: result.nextQuestion,
      evaluation: result.evaluation,
      isComplete: result.isComplete
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process answer'
    });
  }
});

// Get interview status
router.get('/status/:interviewId', async (req, res) => {
  try {
    const interview = await interviewService.getInterview(req.params.interviewId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Interview not found'
      });
    }

    res.json({
      success: true,
      interview
    });
  } catch (error) {
    console.error('Error getting interview status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get interview status'
    });
  }
});

// End interview and get final report
router.post('/end/:interviewId', async (req, res) => {
  try {
    const finalReport = await interviewService.endInterview(req.params.interviewId);

    res.json({
      success: true,
      report: finalReport
    });
  } catch (error) {
    console.error('Error ending interview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end interview'
    });
  }
});

module.exports = router;