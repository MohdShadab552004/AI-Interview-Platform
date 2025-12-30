const { v4: uuidv4 } = require('uuid');
const redis = require('redis');
const aiService = require('./aiService');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch(console.error);

class InterviewService {
  constructor() {
    this.interviews = new Map();
  }
  
  async createInterview({ candidateName, position, experienceLevel, userId }) {
    const interviewId = uuidv4();
    const timestamp = Date.now();
    
    // Generate questions for this interview
    const questions = await aiService.generateQuestions(position, experienceLevel);
    
    const interview = {
      id: interviewId,
      candidateName,
      position,
      experienceLevel,
      userId,
      status: 'active',
      startTime: timestamp,
      currentQuestion: 0,
      questions: questions.map((q, i) => ({
        id: i,
        text: q.question,
        type: q.type,
        expectedTime: q.expectedTime || 120, // seconds
        answer: null,
        transcription: null,
        voiceAnalysis: null,
        videoMetrics: null,
        aiEvaluation: null
      })),
      metrics: {
        totalQuestions: questions.length,
        completedQuestions: 0,
        averageConfidence: 0,
        attentionScore: 0,
        speechClarity: 0
      },
      finalEvaluation: null
    };
    
    // Store in Redis with 24h expiry
    await redisClient.setEx(
      `interview:${interviewId}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify(interview)
    );
    
    return interview;
  }
  
  async getInterview(interviewId) {
    const interview = await redisClient.get(`interview:${interviewId}`);
    return interview ? JSON.parse(interview) : null;
  }
  
  async processAnswer({ interviewId, questionIndex, audioBuffer, audioMimeType, videoMetrics }) {
    let interview = await this.getInterview(interviewId);
    
    if (!interview) {
      throw new Error('Interview not found');
    }
    
    if (questionIndex >= interview.questions.length) {
      throw new Error('Invalid question index');
    }
    
    const question = interview.questions[questionIndex];
    
    // Process in parallel
    const [transcription, voiceAnalysis] = await Promise.all([
      aiService.transcribeAudio(audioBuffer, audioMimeType, { interviewId, questionId: question.id }),
      aiService.analyzeVoice(audioBuffer)
    ]);
    
    // Evaluate answer using AI
    const aiEvaluation = await aiService.evaluateAnswer({
      question: question.text,
      answer: transcription.text,
      voiceMetrics: voiceAnalysis,
      videoMetrics
    });
    
    // Update question data
    question.answer = audioBuffer;
    question.transcription = transcription;
    question.voiceAnalysis = voiceAnalysis;
    question.videoMetrics = videoMetrics;
    question.aiEvaluation = aiEvaluation;
    question.answeredAt = Date.now();
    
    // Update interview metrics
    interview.metrics.completedQuestions++;
    interview.currentQuestion = questionIndex + 1;
    
    // Check if interview is complete
    let isComplete = false;
    let nextQuestion = null;
    
    if (interview.currentQuestion >= interview.questions.length) {
      interview.status = 'completed';
      interview.endTime = Date.now();
      
      // Generate final evaluation
      interview.finalEvaluation = await this.generateFinalEvaluation(interview);
      isComplete = true;
    } else {
      // Get next question
      nextQuestion = interview.questions[interview.currentQuestion];
    }
    
    // Save updated interview
    await redisClient.setEx(
      `interview:${interviewId}`,
      24 * 60 * 60,
      JSON.stringify(interview)
    );
    
    return {
      nextQuestion,
      evaluation: aiEvaluation,
      isComplete,
      finalEvaluation: interview.finalEvaluation
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
      
      // Generate final evaluation if not already done
      if (!interview.finalEvaluation) {
        interview.finalEvaluation = await this.generateFinalEvaluation(interview);
      }
      
      await redisClient.setEx(
        `interview:${interviewId}`,
        24 * 60 * 60,
        JSON.stringify(interview)
      );
    }
    
    return interview.finalEvaluation;
  }
}

module.exports = new InterviewService();