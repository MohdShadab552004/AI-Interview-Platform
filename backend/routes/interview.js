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
    const { candidateName, email, position, experienceLevel, company, jobId, jobDescription } = req.body;

    console.log("start interview for", candidateName);

    const interview = await interviewService.createInterview({
      candidateName,
      email,
      position: position || 'React Developer',
      experienceLevel: experienceLevel || 'Mid-level',
      company,
      interviewId: jobId, // Optional
      userId: req.session.userId || 'anonymous',
      cvBuffer: req.file ? req.file.buffer : null,
      jobDescription
    });

    req.session.interviewId = interview.id;
    console.log("Interview session created:", interview.id);
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
    const { interviewId, questionIndex, videoMetrics, textAnswer, codeAnswer, language, skipped, hintsUsed } = req.body;
    console.log('Interview ID:', interviewId);
    console.log('Question Index:', questionIndex);
    console.log('Skipped:', skipped);
    console.log('Hints Used:', hintsUsed);

    const audioFile = req.file;

    if (!audioFile && !textAnswer && !codeAnswer && skipped !== 'true') {
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
      codeAnswer,
      language,
      hintsUsed: parseInt(hintsUsed || 0)
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

// Log cheat attempt
router.post('/:id/cheat-log', async (req, res) => {
  try {
    const { type, details, severity, detectedAt } = req.body;
    const result = await interviewService.logCheatAttempt(req.params.id, {
      type,
      details,
      severity,
      detectedAt: detectedAt || new Date().toISOString()
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Interview not found' });
    }

    res.json({ success: true, riskScore: result.riskScore });
  } catch (error) {
    console.error('Error logging cheat attempt:', error);
    res.status(500).json({ success: false, error: 'Failed to log cheat attempt' });
  }
});

// Get token usage stats
router.get('/token-stats', (req, res) => {
  try {
    const stats = interviewService.getTokenUsage();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting token stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get token stats' });
  }
});

router.get('/:interviewId/question/:questionIndex/audio', async (req, res) => {
  try {
    const { interviewId, questionIndex } = req.params;
    const audioBuffer = await interviewService.getQuestionAudio(interviewId, parseInt(questionIndex));

    if (!audioBuffer) {
      return res.status(404).json({ success: false, error: 'Audio not found' });
    }

    // Determine content type (could be MP3 or WAV depending on source)
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error serving audio:', error);
    res.status(500).json({ success: false, error: 'Failed to serve audio' });
  }
});

// Execute code using Judge0
router.post('/execute', async (req, res) => {
  try {
    const { sourceCode, languageId, stdin } = req.body;

    if (!sourceCode || !languageId) {
      return res.status(400).json({
        success: false,
        error: 'Missing sourceCode or languageId'
      });
    }

    const judge0Service = require('../services/judge0Service');
    const result = await judge0Service.executeCode(sourceCode, languageId, stdin);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute code'
    });
  }
});

module.exports = router;