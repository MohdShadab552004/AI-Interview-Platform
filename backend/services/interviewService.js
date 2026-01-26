const { v4: uuidv4 } = require('uuid');
const redis = require('redis');
const aiService = require('./aiService');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
  if (isRedisConnected) {
    console.error('❌ Redis Client Error:', err);
    isRedisConnected = false;
  }
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
  isRedisConnected = true;
});

redisClient.connect().catch(err => {
  console.log('⚠️ Failed to connect to Redis. Falling back to in-memory storage.');
  isRedisConnected = false;
});

class InterviewService {
  constructor() {
    this.interviews = new Map();
  }

  async createInterview({ candidateName, position, experienceLevel, userId, cvBuffer }) {
    const interviewId = uuidv4();
    const timestamp = Date.now();

    let questions = [];

    if (cvBuffer) {
      // CV-based flow - NEW Full 25-Question Structure
      const cvText = await aiService.extractTextFromPDF(cvBuffer);

      // Generate all 25 questions in one go logic
      questions = await aiService.generateFullInterview(cvText, 25);
    } else {
      // Fallback old flow (without CV)
      questions = await aiService.generateQuestions(position, experienceLevel, 5);
    }

    const formattedQuestions = questions.map((q, i) => ({
      id: i,
      text: q.question,
      type: q.type || 'general', // 'theory', 'code', 'technical-explanation'
      expectedTime: q.expectedTime || 120, // seconds
      answer: null,
      transcription: null,
      voiceAnalysis: null,
      videoMetrics: null,
      aiEvaluation: null,
      language: q.language || null // for coding questions
    }));

    // Attach audio to the first question
    if (formattedQuestions.length > 0) {
      formattedQuestions[0].audio = await aiService.getAudioForText(formattedQuestions[0].text);
    }

    const interview = {
      id: interviewId,
      candidateName,
      position,
      experienceLevel,
      userId,
      status: 'active',
      startTime: timestamp,
      currentQuestion: 0,
      questions: formattedQuestions,
      metrics: {
        totalQuestions: questions.length,
        completedQuestions: 0,
        averageConfidence: 0,
        attentionScore: 0,
        speechClarity: 0
      },
      finalEvaluation: null
    };

    // Store in Redis with 24h expiry if connected, otherwise in memory
    if (isRedisConnected) {
      try {
        await redisClient.setEx(
          `interview:${interviewId}`,
          24 * 60 * 60, // 24 hours
          JSON.stringify(interview)
        );
      } catch (err) {
        console.error('Redis set error, falling back to memory:', err);
        this.interviews.set(interviewId, interview);
      }
    } else {
      this.interviews.set(interviewId, interview);
    }

    return interview;
  }

  async getInterview(interviewId) {
    if (isRedisConnected) {
      try {
        const interview = await redisClient.get(`interview:${interviewId}`);
        return interview ? JSON.parse(interview) : this.interviews.get(interviewId);
      } catch (err) {
        return this.interviews.get(interviewId);
      }
    }
    return this.interviews.get(interviewId);
  }

  async saveInterview(interview) {
    if (isRedisConnected) {
      try {
        await redisClient.setEx(
          `interview:${interview.id}`,
          24 * 60 * 60,
          JSON.stringify(interview)
        );
      } catch (err) {
        this.interviews.set(interview.id, interview);
      }
    } else {
      this.interviews.set(interview.id, interview);
    }
  }

  async processAnswer({ interviewId, questionIndex, audioBuffer, audioMimeType, videoMetrics, textAnswer, codeAnswer }) {
    const interview = await this.getInterview(interviewId);

    if (!interview) {
      throw new Error('Interview not found');
    }

    if (questionIndex >= interview.questions.length) {
      throw new Error('Invalid question index');
    }

    const question = interview.questions[questionIndex];

    // Handle Audio (if present)
    let audioPath = null;
    if (audioBuffer) {
      // 1. Save audio to temporary file for background processing
      const fs = require('fs').promises;
      const path = require('path');
      const tempFileName = `audio_${interviewId}_${questionIndex}_${Date.now()}.webm`;
      const tempPath = path.join(__dirname, '../uploads', tempFileName);

      await fs.writeFile(tempPath, audioBuffer);
      audioPath = tempPath;
    }

    // Store non-audio answers immediately
    if (textAnswer) {
      question.answer = textAnswer;
      question.type = 'text';
    } else if (codeAnswer) {
      question.answer = codeAnswer;
      question.type = 'code';
    } else if (!audioBuffer) {
      console.warn("No answer content provided");
    }

    // 2. Enqueue analysis job
    const { analysisQueue, processJob } = require('../queues/analysisQueue');

    if (isRedisConnected) {
      await analysisQueue.add({
        interviewId,
        questionIndex,
        audioPath,
        audioMimeType,
        videoMetrics,
        textAnswer,
        codeAnswer
      }, {
        attempts: 3,
        backoff: 5000
      });
      console.log(`[Queue] Added analysis job for ${interviewId} Q${questionIndex}`);
    } else {
      // Fallback: Process immediately (background async)
      console.log(`[Queue] Redis not connected. Processing ${interviewId} Q${questionIndex} directly.`);
      processJob({
        interviewId,
        questionIndex,
        audioPath,
        audioMimeType,
        videoMetrics,
        textAnswer,
        codeAnswer
      }).catch(err => console.error('Direct processing error:', err));
    }

    // 3. Mark as answering (placeholder until worker updates)
    question.answer = 'processing'; // We don't store the full buffer in interview object anymore to save space

    // Update interview progress
    interview.currentQuestion = questionIndex + 1;
    interview.metrics.completedQuestions++;

    // Check if interview is complete
    let isComplete = false;
    let nextQuestion = null;

    if (interview.currentQuestion >= interview.questions.length) {
      interview.status = 'completed';
      interview.endTime = Date.now();
      isComplete = true;
      // Final evaluation will be generated by the worker
    } else {
      nextQuestion = interview.questions[interview.currentQuestion];
      // Attach audio for the next question
      nextQuestion.audio = await aiService.getAudioForText(nextQuestion.text);
    }

    // Save updated interview status
    await this.saveInterview(interview);

    return {
      nextQuestion,
      isComplete,
      message: 'Answer submitted and processing in background'
    };
  }

  async generateFinalEvaluation(interview) {
    const answersSummary = interview.questions.map(q => ({
      question: q.text,
      answer: q.transcription?.text || 'No answer',
      confidence: q.voiceAnalysis?.confidence || 0,
      clarity: q.voiceAnalysis?.clarity || 0,
      evaluation: q.aiEvaluation
    }));

    return await aiService.generateFinalReport({
      candidateName: interview.candidateName,
      position: interview.position,
      answers: answersSummary,
      metrics: interview.metrics
    });
  }

  async endInterview(interviewId) {
    let interview = await this.getInterview(interviewId);

    if (!interview) {
      throw new Error('Interview not found');
    }

    if (interview.status !== 'completed') {
      interview.status = 'completed';
      interview.endTime = Date.now();

      // Only generate if all questions are answered (background worker might be doing this too)
      const allAnswered = interview.questions.every(q => q.transcription);
      if (allAnswered && !interview.finalEvaluation) {
        interview.finalEvaluation = await this.generateFinalEvaluation(interview);
      }

      await this.saveInterview(interview);
    }

    return interview.finalEvaluation;
  }
}

module.exports = new InterviewService();