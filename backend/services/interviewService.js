const { v4: uuidv4 } = require('uuid');
const redis = require('redis');
const aiService = require('./aiService');
const judge0Service = require('./judge0Service');

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

  async createInterview({ candidateName, email, position, experienceLevel, company, userId, cvBuffer, interviewId: providedId }) {
    const interviewId = providedId || uuidv4();
    const timestamp = Date.now();

    let questions = [];
    let initialTokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    if (cvBuffer) {
      // CV-based flow - NEW Full 25-Question Structure
      const cvText = await aiService.extractTextFromPDF(cvBuffer);

      // Generate all 25 questions in one go logic
      const result = await aiService.generateFullInterview(cvText, position, experienceLevel, 25);
      questions = result.questions;
      // Initialize usage with generation cost
      initialTokenUsage = result.usage || { total_tokens: 0 };
    } else {
      // Fallback old flow (without CV)
      const result = await aiService.generateQuestions(position, experienceLevel, 5);
      questions = result.questions;
      initialTokenUsage = result.usage || { total_tokens: 0 };
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
      videoMetrics: null,
      aiEvaluation: null,
      language: q.language || null, // for coding questions
      language: q.language || null, // for coding questions
      hint1: q.hint1 || null, // for coding hints
      hint2: q.hint2 || null, // for coding hints
    }));

    // Attach audio to the first question
    if (formattedQuestions.length > 0) {
      formattedQuestions[0].audio = await aiService.getAudioForText(formattedQuestions[0].text);
    }

    const interview = {
      id: interviewId,
      candidateName,
      email,
      position,
      experienceLevel,
      company,
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
      finalEvaluation: null,
      cheatLogs: [],
      riskScore: 0,
      tokenUsage: initialTokenUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
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

  async processAnswer({ interviewId, questionIndex, audioBuffer, audioMimeType, videoMetrics, textAnswer, codeAnswer, language, skipped, hintsUsed }) {
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

    // Mark as skipped if requested
    if (skipped === 'true') {
      question.answer = 'skipped';
      question.transcription = { text: 'Question skipped by user' };
      question.aiEvaluation = {
        technicalAccuracy: 0,
        communicationSkills: 0,
        confidenceScore: 0,
        overallScore: 0,
        feedback: "Question was skipped."
      };
      question.answeredAt = Date.now();
    } else {
      // Store hint usage
      question.hintsUsed = hintsUsed;

      let executionResult = null;

      // Store non-audio answers immediately
      if (textAnswer) {
        question.answer = textAnswer;
        question.type = 'text';
      } else if (codeAnswer) {
        question.answer = codeAnswer;
        question.type = 'code';
        question.language = language;

        // Execute Code via Judge0
        const languageMap = {
          'javascript': 63,
          'python': 71,
          'java': 62,
          'cpp': 54,
          'c': 50
        };
        const langId = languageMap[language] || 63; // Default to JS

        try {
          // If we have test cases, run them all
          if (question.testCases && question.testCases.length > 0) {
            const results = [];
            let passedCount = 0;

            console.log(`[Interview Service] Running ${question.testCases.length} test cases for Q${questionIndex}...`);

            for (const testCase of question.testCases) {
              // Execute code with the specific input
              const result = await judge0Service.executeCode(codeAnswer, langId, testCase.input);

              // Normalize outputs for comparison (trim whitespace)
              const actualOutput = (result.stdout || "").trim();
              const expectedOutput = (testCase.output || "").trim();
              const passed = actualOutput === expectedOutput;

              if (passed) passedCount++;

              results.push({
                input: testCase.input,
                expectedOutput: expectedOutput,
                actualOutput: actualOutput,
                error: result.stderr || result.compile_output || null,
                passed: passed
              });
            }

            executionResult = {
              results: results,
              passedCount: passedCount,
              totalTests: question.testCases.length,
              score: Math.round((passedCount / question.testCases.length) * 100),
              summary: `${passedCount}/${question.testCases.length} Test Cases Passed`
            };

          } else {
            // Fallback: Just run the code without input validation (for legacy/older questions)
            executionResult = await judge0Service.executeCode(codeAnswer, langId);
            executionResult.summary = "Execution Successful (No Test Cases Provided)";
          }

          question.executionResult = executionResult;
        } catch (execErr) {
          console.error("Code execution failed:", execErr);
          question.executionResult = { error: "Execution failed locally", details: execErr.message };
        }
      } else if (!audioBuffer) {
        console.warn("No answer content provided");
      }

      // 2. Enqueue analysis job
      const { analysisQueue, processJob } = require('../queues/analysisQueue');

      // 3. Mark as answering (placeholder until worker updates)
      if (audioBuffer) {
        question.answer = 'processing audio';
      } else if (textAnswer || codeAnswer) {
        question.answer = textAnswer || codeAnswer;
      }




      // Payload for processing
      const jobData = {
        interviewId,
        questionIndex,
        audioPath,
        audioMimeType,
        videoMetrics,
        textAnswer,
        codeAnswer,
        executionResult, // Pass execution result to worker
        hintsUsed: hintsUsed // Aligning with HEAD variable name
      };

      // Add to queue or process directly
      // Check if analysisQueue is ready
      if (analysisQueue && isRedisConnected) {
        analysisQueue.add(jobData, {
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true
        });
        console.log(`[Queue] Added analysis job for ${interviewId} Q${questionIndex}`);
      } else {
        // Fallback: Process immediately (background async)
        console.log(`[Queue] Redis not connected. Processing ${interviewId} Q${questionIndex} directly.`);
        // Import dynamically to avoid circular dependency issues if any, though we are in service
        const { processJob } = require('../queues/analysisQueue');
        processJob(jobData).catch(err => console.error('Direct processing error:', err));
      }

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
        if (nextQuestion) {
          nextQuestion.audio = await aiService.getAudioForText(nextQuestion.text);
        }
      }

      // Save updated interview status
      await this.saveInterview(interview);

      return {
        nextQuestion,
        isComplete,
        message: 'Answer submitted and processing in background'
      };
    }
  }

  async generateFinalEvaluation(interview) {
    const answersSummary = interview.questions.map(q => ({
      question: q.text,
      answer: q.transcription?.text || 'No answer',
      confidence: q.voiceAnalysis?.confidence || 0,
      clarity: q.voiceAnalysis?.clarity || 0,
      evaluation: q.aiEvaluation
    }));

    const result = await aiService.generateFinalReport({
      candidateName: interview.candidateName,
      position: interview.position,
      answers: answersSummary,
      metrics: interview.metrics
    });

    return { report: result.report, usage: result.usage };
  }

  async endInterview(interviewId) {
    let interview = await this.getInterview(interviewId);

    if (!interview) {
      throw new Error('Interview not found');
    }

    if (interview.status !== 'completed') {
      // Only mark as "not attempted" if it has no answer AND is not currently processing
      interview.questions.forEach((q, idx) => {
        if (!q.answer && q.answer !== 'processing' && q.answer !== 'processing audio') {
          q.answer = 'not attempted';
          q.transcription = { text: 'Question not attempted (interview ended early)' };
          q.aiEvaluation = {
            technicalAccuracy: 0,
            communicationSkills: 0,
            confidenceScore: 0,
            overallScore: 0,
            feedback: "Question was not attempted."
          };
          q.answeredAt = Date.now();
          interview.metrics.completedQuestions++; // Count it as done (failed)
        }
      });

      interview.status = 'completed';
      interview.endTime = Date.now();

      // Generate final evaluation
      const finalResult = await this.generateFinalEvaluation(interview);
      interview.finalEvaluation = finalResult.report;

      // Update token usage
      if (finalResult.usage) {
        if (!interview.tokenUsage) interview.tokenUsage = { total_tokens: 0 };
        interview.tokenUsage.total_tokens = (interview.tokenUsage.total_tokens || 0) + (finalResult.usage.total_tokens || 0);
        interview.tokenUsage.prompt_tokens = (interview.tokenUsage.prompt_tokens || 0) + (finalResult.usage.prompt_tokens || 0);
        interview.tokenUsage.completion_tokens = (interview.tokenUsage.completion_tokens || 0) + (finalResult.usage.completion_tokens || 0);
      }

      await this.saveInterview(interview);
    }
    return interview.finalEvaluation;
  }
  async logCheatAttempt(interviewId, violation) {
    const interview = await this.getInterview(interviewId);
    if (!interview) return null;

    if (!interview.cheatLogs) interview.cheatLogs = [];
    if (!interview.riskScore) interview.riskScore = 0;

    interview.cheatLogs.push(violation);

    // Update Risk Score
    const severityScores = { 'critical': 20, 'high': 10, 'medium': 5, 'low': 2 };
    const score = severityScores[violation.severity] || 2;
    interview.riskScore += score;

    await this.saveInterview(interview);
    return { success: true, riskScore: interview.riskScore };
  }

  async getQuestionAudio(interviewId, questionIndex) {
    const interview = await this.getInterview(interviewId);
    if (!interview || !interview.questions[questionIndex]) return null;

    const question = interview.questions[questionIndex];

    // Check if audio buffer is already stored (from initially generated questions)
    if (question.audio) {
      if (typeof question.audio === 'string') {
        return Buffer.from(question.audio, 'base64');
      }
      if (Buffer.isBuffer(question.audio)) return question.audio;
      if (question.audio.type === 'Buffer') return Buffer.from(question.audio.data);
    }

    // Generate on demand if missing
    const audioBase64 = await aiService.getAudioForText(question.text);
    if (audioBase64) {
      // Store it for future use (optional, but good for caching)
      question.audio = audioBase64;
      await this.saveInterview(interview);
      return Buffer.from(audioBase64, 'base64');
    }

    return null;
  }

  getTokenUsage() {
    return aiService.getTokenStats();
  }
}

module.exports = new InterviewService();