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
        console.log(`[Worker] Starting analysis for ${interviewId} Q${questionIndex}...`);

        // 1. Read audio from file
        let audioBuffer = null;
        if (audioPath) {
            try {
                audioBuffer = await fs.readFile(audioPath);
                console.log(`[Worker] Audio file read successfully: ${audioBuffer.length} bytes`);
            } catch (readError) {
                console.error(`[Worker] Failed to read audio file at ${audioPath}:`, readError);
                // Proceed without audio if read fails (will trigger fallback)
            }
        }

        // 2. Load interview
        const interview = await interviewService.getInterview(interviewId);
        if (!interview) {
            console.error(`[Worker] Interview ${interviewId} not found!`);
            throw new Error('Interview not found');
        }

        const question = interview.questions[questionIndex];
        console.log(`[Worker] Loaded Question: "${question.text.substring(0, 30)}..."`);

        // 3. Process in parallel (Heavy lifting)
        // Ensure aiService is used correctly
        let transcription = { text: "No audio provided", confidence: 0 };
        let voiceAnalysis = aiService.getDefaultVoiceMetrics ? aiService.getDefaultVoiceMetrics() : {};

        if (audioBuffer) {
            console.log(`[Worker] Calling AI Service for transcription and voice analysis...`);
            try {
                const [transcriptionResult, voiceAnalysisResult] = await Promise.all([
                    aiService.transcribeAudio(audioBuffer, audioMimeType, { interviewId, questionId: question.id }).catch(e => {
                        console.error('[Worker] Transcription failed:', e);
                        return { text: "Transcription failed", confidence: 0 };
                    }),
                    aiService.analyzeVoice(audioBuffer).catch(e => {
                        console.error('[Worker] Voice analysis failed:', e);
                        return {};
                    })
                ]);
                transcription = transcriptionResult;
                voiceAnalysis = voiceAnalysisResult;
                console.log(`[Worker] Transcription result: "${transcription.text.substring(0, 50)}..."`);
            } catch (aiError) {
                console.error('[Worker] AI Processing error:', aiError);
            }
        } else {
            console.log(`[Worker] No audio buffer, skipping voice/transcription.`);
        }

        // 4. Evaluate answer using AI
        console.log(`[Worker] Evaluating answer...`);
        const aiEvaluation = await aiService.evaluateAnswer({
            question: question.text,
            answer: transcription.text || textAnswer || "No answer provided",
            voiceMetrics: voiceAnalysis,
            videoMetrics,
            hintUsed: question.hintUsed
        });
        console.log(`[Worker] Evaluation score: ${aiEvaluation.overallScore}`);

        // 5. Update interview data directly in Redis/Memory
        question.transcription = transcription;
        question.voiceAnalysis = voiceAnalysis;
        question.videoMetrics = videoMetrics;
        question.aiEvaluation = aiEvaluation;
        question.answeredAt = Date.now();

        // If it was the last question OR all questions are analyzed, generate final report
        const allAnswered = interview.questions.every(q => q.transcription || q.answer);
        if (allAnswered && interview.status === 'completed' && !interview.finalEvaluation) {
            console.log(`[Worker] All questions analyzed. Generating final report for ${interviewId}`);
            interview.finalEvaluation = await interviewService.generateFinalEvaluation(interview);
        }

        // Save back to storage
        await interviewService.saveInterview(interview);

        // 6. Cleanup temp audio file
        if (audioPath) {
            await fs.unlink(audioPath).catch(err => console.error('Error deleting temp audio:', err));
        }

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
