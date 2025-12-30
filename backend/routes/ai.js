const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiService = require('../services/aiService');

const upload = multer({ storage: multer.memoryStorage() });

// Generate interview questions
router.post('/generate-questions', async (req, res) => {
  try {
    const { position, experienceLevel, count = 5 } = req.body;
    
    const questions = await aiService.generateQuestions(
      position, 
      experienceLevel, 
      count
    );
    
    res.json({ 
      success: true, 
      questions 
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate questions' 
    });
  }
});

// Transcribe audio
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { interviewId, questionId } = req.body;
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      });
    }
    
    const transcription = await aiService.transcribeAudio(
      audioFile.buffer,
      audioFile.mimetype,
      { interviewId, questionId }
    );
    
    res.json({ 
      success: true, 
      transcription 
    });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to transcribe audio' 
    });
  }
});

// Text to Speech
router.post('/text-to-speech', async (req, res) => {
  try {
    const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        error: 'No text provided' 
      });
    }
    
    const audioBuffer = await aiService.textToSpeech(text, voiceId);
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error converting text to speech:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to convert text to speech' 
    });
  }
});

// Analyze voice metrics (calls Python service)
router.post('/analyze-voice', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      });
    }
    
    const analysis = await aiService.analyzeVoice(audioFile.buffer);
    
    res.json({ 
      success: true, 
      analysis 
    });
  } catch (error) {
    console.error('Error analyzing voice:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze voice' 
    });
  }
});

module.exports = router;