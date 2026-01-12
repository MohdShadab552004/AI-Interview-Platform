const Queue = require('bull');
const fs = require('fs').promises;
const path = require('path');
const aiService = require('../services/aiService');

const analysisQueue = new Queue('analysis', process.env.REDIS_URL || 'redis://localhost:6379');

// We'll import InterviewService dynamically to avoid circular dependencies if any
let interviewService;

// Extract the processing logic so it can be called directly
const processJob = async (data) => {
    const { interviewId, questionIndex, audioPath, audioMimeType, videoMetrics } = data;

    if (!interviewService) {
        interviewService = require('../services/interviewService');
    }

    console.log(`[Worker] Processing analysis for interview ${interviewId}, question ${questionIndex} (Direct/Queue)`);

    try {
        // 1. Read audio from file
        const audioBuffer = await fs.readFile(audioPath);

        // 2. Load interview
        const interview = await interviewService.getInterview(interviewId);
        if (!interview) throw new Error('Interview not found');

        const question = interview.questions[questionIndex];

        // 3. Process in parallel (Heavy lifting)
        // Ensure aiService is used correctly
        const [transcription, voiceAnalysis] = await Promise.all([
            aiService.transcribeAudio(audioBuffer, audioMimeType, { interviewId, questionId: question.id }),
            aiService.analyzeVoice(audioBuffer)
        ]);

        console.log(`[Worker] Analysis complete for ${interviewId} Q${questionIndex}`);

        // 4. Evaluate answer using AI
        const aiEvaluation = await aiService.evaluateAnswer({
            question: question.text,
            answer: transcription.text,
            voiceMetrics: voiceAnalysis,
            videoMetrics
        });

        // 5. Update interview data directly in Redis/Memory
        question.transcription = transcription;
        question.voiceAnalysis = voiceAnalysis;
        question.videoMetrics = videoMetrics;
        question.aiEvaluation = aiEvaluation;
        question.answeredAt = Date.now();

        // If it was the last question OR all questions are analyzed, generate final report
        const allAnswered = interview.questions.every(q => q.transcription);
        if (allAnswered && interview.status === 'completed' && !interview.finalEvaluation) {
            console.log(`[Worker] All questions analyzed. Generating final report for ${interviewId}`);
            interview.finalEvaluation = await interviewService.generateFinalEvaluation(interview);
        }

        // Save back to storage
        await interviewService.saveInterview(interview);

        // 6. Cleanup temp audio file
        await fs.unlink(audioPath).catch(err => console.error('Error deleting temp audio:', err));

        return { success: true };
    } catch (error) {
        console.error(`[Worker] Error processing job for interview ${interviewId}:`, error);
        throw error;
    }
};

// Register the worker for Redis queue
analysisQueue.process(async (job) => {
    return await processJob(job.data);
});

module.exports = {
    analysisQueue,
    processJob
};
