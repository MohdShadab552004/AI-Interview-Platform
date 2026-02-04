// OpenRouter SDK caused installation issues on Windows, switching to direct Axios
// Triggger restart for pdf-parse update
// const { OpenRouter } = require("@openrouter/sdk");
const { default: axios } = require("axios");
const FormData = require('form-data');
const env = require('../config/env');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.siteUrl = process.env.SITE_URL || 'http://localhost:5173';
    this.siteTitle = 'Interview Platform';

    // Default models
    this.defaultModel = 'google/gemini-2.0-flash-001'; // Fast and capable
    this.complexModel = 'google/gemini-2.0-flash-001';
  }

  async callOpenRouter(prompt, model = this.defaultModel) {
    try {
      if (!this.apiKey) {
        throw new Error('OPENROUTER_API_KEY is not defined in environment variables');
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': this.siteUrl,
            'X-Title': this.siteTitle,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      }
      throw new Error('No valid response from OpenRouter API');
    } catch (error) {
      console.error('OpenRouter API Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async parseJSONResponse(text) {
    if (!text) return null;
    try {
      // Try parsing directly
      return JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from markdown code blocks or raw text
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error('JSON parse error from extracted text:', e2);
          return null;
        }
      }
      return null;
    }
  }

  // Generate interview questions
  async generateQuestions(position, experienceLevel, count = 5) {
    const prompt = `
      You are an expert technical interviewer for ${position} position (${experienceLevel} level).
      Generate ${count} interview questions that cover:
      1. Technical knowledge specific to ${position}
      2. Problem-solving skills
      3. Practical experience scenarios
      4. Behavioral questions
      
      Format: Return as JSON array with fields: question, type (technical/behavioral/scenario), expectedTime (in seconds), difficulty (easy/medium/hard)
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text, explanations, or markdown formatting.
    `;

    try {
      const text = await this.callOpenRouter(prompt);
      console.log('OpenRouter raw response (Questions):', text);

      const parsed = await this.parseJSONResponse(text);
      if (parsed) {
        console.log('Successfully parsed questions:', parsed);
        return parsed;
      }

      console.log('No JSON found in response, using fallback');
      return this.getFallbackQuestions(position, count);
    } catch (error) {
      console.error('Error generating questions with OpenRouter:', error);
      return this.getFallbackQuestions(position, count);
    }
  }

  // Transcribe audio using Python Whisper service (with OpenRouter fallback)
  async transcribeAudio(audioBuffer, mimeType, metadata = {}) {
    try {
      console.log('Sending audio to Whisper service for transcription...');

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.webm',
        contentType: mimeType
      });

      const whisperResponse = await axios.post(`${env.PYTHON_SERVICE_URL}/transcribe`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      if (whisperResponse.data && whisperResponse.data.success) {
        console.log('Whisper transcription successful');
        const text = whisperResponse.data.text;

        // Use OpenRouter for additional insights based on the text
        const analysisPrompt = `
          Analyze this interview response text: "${text}"
          Return JSON with: confidence score (0-1), 
          speaking pace (slow/normal/fast), filler word count estimate,
          and emotional tone (confident/neutral/nervous).
          
          IMPORTANT: Return ONLY valid JSON.
        `;

        try {
          const analysisText = await this.callOpenRouter(analysisPrompt);
          const analysis = (await this.parseJSONResponse(analysisText)) || {};

          return {
            text: text,
            language: whisperResponse.data.language || "en",
            duration: metadata.duration || 0,
            confidence: analysis.confidence || 0.9,
            pace: analysis.pace || "normal",
            fillerWords: analysis.fillerWordCount || 0,
            tone: analysis.emotionalTone || "neutral",
            metadata,
            provider: 'whisper'
          };
        } catch (aiError) {
          console.warn('AI analysis failed, returning raw Whisper transcription:', aiError.message);
          return {
            text: text,
            language: whisperResponse.data.language || "en",
            duration: metadata.duration || 0,
            confidence: 0.8,
            pace: "normal",
            fillerWords: 0,
            tone: "neutral",
            metadata,
            provider: 'whisper'
          };
        }
      }
    } catch (whisperError) {
      console.error('Whisper transcription failed, falling back to OpenRouter:', whisperError.message);
    }

    // Fallback to OpenRouter transcription (text-based analysis is impossible without audio file upload support in text chat, 
    // unless OpenRouter model supports multimodal. 'google/gemini-flash-1.5' does, but sending buffer via SDK might be tricky. 
    // For now we will return a mock or error if Whisper fails, as text-only LLMs can't transcribe audio directly from buffer without specific support)
    // IMPORTANT: OpenRouter SDK standard chat usually expects text. 
    // We will assume for now that if Whisper fails, we can't easily transcribe without a proper audio-capable model endpoint setup.

    console.log('Whisper failed and fallback to LLM for audio bytes is not fully supported in this configuration. Returning fallback.');

    return {
      text: "Audio transcription unavailable (Service Error)",
      language: "en",
      duration: metadata.duration || 0,
      confidence: 0.0,
      pace: "unknown",
      fillerWords: 0,
      tone: "neutral",
      metadata,
      provider: 'fallback-error'
    };
  }

  // Parse PDF content
  async extractTextFromPDF(pdfBuffer) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(pdfBuffer);
      return data.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      return "";
    }
  }

  // Generate Questions based on CV
  async generateCVQuestions(cvText, count = 10) {
    const prompt = `
      You are an expert interviewer. Analyze the following CV content:
      "${cvText.substring(0, 3000)}"
      
      Generate ${count} "Theory" interview questions based strictly on the skills, projects, and experiences mentioned in the CV.
      These should be conversational but verify the candidate's claims.
      
      Format: Return as JSON array with fields: question, type ("theory"), expectedTime (in seconds), difficulty (easy/medium).
      
      IMPORTANT: Return ONLY valid JSON.
    `;

    return await this.safeGenerateQuestions(prompt, count, "theory");
  }

  // Generate Technical Questions based on CV and Job Description
  async generateTechnicalQuestions(cvText, position, count = 10) {
    const prompt = `
      You are an expert technical interviewer for a ${position} role.
      Analyze the following CV content:
      "${cvText.substring(0, 3000)}"
      
      Generate ${count} "Technical" coding or problem-solving questions that combine the position requirements (${position}) with the candidate's background.
      - 5 questions should be "coding" type (require writing code).
      - 5 questions should be "technical-explanation" type (deep technical concepts).
      
      For "coding" questions, mention the language preferred or "Any Language".
      
      Format: Return as JSON array with fields: 
      - question
      - type ("code" or "technical-explanation")
      - expectedTime (in seconds)
      - difficulty (medium/hard)
      - language (if type is code, suggest python/java/cpp/js or "any")
      
      IMPORTANT: Return ONLY valid JSON.
    `;

    return await this.safeGenerateQuestions(prompt, count, "technical");
  }

  // Generate full 25-question interview based on CV (Round 1, 2, 3)
  async generateFullInterview(cvText, count = 25) {
    const prompt = `
      You are an expert technical interviewer. Analyze the following CV content:
      "${cvText.substring(0, 4000)}"

      Generate a comprehensive 25-question interview categorized into 3 Rounds:

      Round 1: 10 Questions - CV Analysis & Theory
      - Focus heavily on the projects, skills, and claims in the CV.
      - Ask "How did you...", "Why did you use...", "Explain..." questions.
      - Type: "cv-analysis"

      Round 2: 10 Questions - Technical Coding & Problem Solving
      - 5 Coding Challenges: Require writing actual code (Type: "code").
      - 5 Technical Scenarios: Architecture/System Design/Debugging (Type: "technical-problem").
      - Difficulty: Medium to Hard.

      Round 3: 5 Questions - Behavioral & General Knowledge
      - Hard/Tricky Logic questions or General Knowledge.
      - Behavioral: "Tell me about a time...", "Conflict resolution...".
      - Type: "behavioral" or "general".

      Format: Return as a JSON array EXACTLY with this structure:
      [
        { "round": 1, "question": "...", "type": "cv-analysis", "expectedTime": 90, "difficulty": "medium" },
        ...
        { "round": 2, "question": "Write a function...", "type": "code", "language": "python/java/js", "expectedTime": 300, "difficulty": "hard" },
        ...
      ]

      IMPORTANT: Return ONLY valid JSON.
    `;

    try {
      // Use higher token limit model if possible for large response
      const text = await this.callOpenRouter(prompt, this.complexModel);
      const parsed = await this.parseJSONResponse(text);

      if (parsed && Array.isArray(parsed)) {
        // Validation ensure we have roughly right count, otherwise pad/slice
        if (parsed.length < 5) throw new Error("Too few questions generated");
        return parsed;
      }
      throw new Error('Invalid JSON structure');
    } catch (error) {
      console.error('Error generating full interview:', error);
      // Fallback: Generate generic structure manually
      return this.generateFallbackFullInterview(count);
    }
  }

  generateFallbackFullInterview(count) {
    const questions = [];
    // Round 1
    for (let i = 1; i <= 10; i++) {
      questions.push({
        round: 1,
        question: `Tell me more about the project listed in your CV (Question ${i})`,
        type: "cv-analysis",
        expectedTime: 120,
        difficulty: "medium"
      });
    }
    // Round 2
    for (let i = 1; i <= 10; i++) {
      const isCode = i <= 5;
      questions.push({
        round: 2,
        question: isCode ? `Write a function to reverse a linked list.` : `How would you design a scalable notification system?`,
        type: isCode ? "code" : "technical-problem",
        expectedTime: 300,
        difficulty: "hard",
        language: isCode ? "javascript" : null
      });
    }
    // Round 3
    for (let i = 1; i <= 5; i++) {
      questions.push({
        round: 3,
        question: `Describe a challenging situation you faced at work.`,
        type: "behavioral",
        expectedTime: 120,
        difficulty: "hard"
      });
    }
    return questions.slice(0, count);
  }

  async safeGenerateQuestions(prompt, count, fallbackType) {
    try {
      const text = await this.callOpenRouter(prompt);
      const parsed = await this.parseJSONResponse(text);
      if (parsed && Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error('Invalid JSON format');
    } catch (error) {
      console.error('Error generating questions:', error);
      return Array(count).fill(0).map((_, i) => ({
        question: `Fallback ${fallbackType} question ${i + 1}`,
        type: fallbackType,
        expectedTime: 120,
        difficulty: "medium"
      }));
    }
  }

  // Generate interview questions (Legacy/Fallback)
  async generateQuestions(position, experienceLevel, count = 5) {
    const prompt = `
      You are an expert technical interviewer for ${position} position (${experienceLevel} level).
      Generate ${count} interview questions that cover:
      1. Technical knowledge specific to ${position}
      2. Problem-solving skills
      3. Practical experience scenarios
      4. Behavioral questions
      
      Format: Return as JSON array with fields: question, type (technical/behavioral/scenario), expectedTime (in seconds), difficulty (easy/medium/hard)
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text, explanations, or markdown formatting.
    `;

    try {
      const text = await this.callOpenRouter(prompt);
      console.log('OpenRouter raw response (Questions):', text);

      const parsed = await this.parseJSONResponse(text);
      if (parsed) {
        console.log('Successfully parsed questions:', parsed);
        return parsed;
      }

      console.log('No JSON found in response, using fallback');
      return this.getFallbackQuestions(position, count);
    } catch (error) {
      console.error('Error generating questions with OpenRouter:', error);
      return this.getFallbackQuestions(position, count);
    }
  }

  // Analyze voice metrics using Python voice analysis service
  async analyzeVoice(audioBuffer) {
    try {
      console.log('Sending audio to voice analysis service...');

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });

      const response = await axios.post(`${env.PYTHON_SERVICE_URL}/analyze`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      if (response.data && response.data.success) {
        console.log('Voice analysis successful:', response.data.analysis);
        return response.data.analysis;
      }

      throw new Error(response.data.error || 'Voice analysis failed');
    } catch (error) {
      console.error('Error analyzing voice with Python service:', error.message);
      // Fallback default metrics
      return {
        confidence: 0.5,
        clarity: 0.5,
        speechRate: 150,
        pitchStability: 0.5,
        volumeConsistency: 0.5,
        pauseCount: 0,
        pauseRatio: 0.1,
        energy: 0.5,
        tempo: 120,
        analysis: "Voice analysis fallback used"
      };
    }
  }

  // Analyze video metrics using OpenRouter
  async analyzeVideo(videoData, transcript) {
    const prompt = `
      Analyze this interview video response based on typical behavioral cues:
      
      Transcript: "${transcript}"
      
      Return as JSON with these exact fields:
      {
        "eyeContact": 0.0 (0-1, where 1 is excellent),
        "attention": 0.0 (0-1, where 1 is fully attentive),
        "bodyLanguage": 0.0 (0-1, where 1 is confident),
        "facialExpression": 0.0 (0-1, where 1 is appropriate),
        "professionalism": 0.0 (0-1, where 1 is very professional),
        "analysis": "brief analysis text"
      }
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text.
    `;

    try {
      const text = await this.callOpenRouter(prompt);
      console.log('Video analysis raw response:', text);

      const parsed = await this.parseJSONResponse(text);
      if (parsed) return parsed;

      return {
        eyeContact: 0.6,
        attention: 0.7,
        bodyLanguage: 0.5,
        facialExpression: 0.6,
        professionalism: 0.7,
        analysis: "Average video presentation detected"
      };
    } catch (error) {
      console.error('Error analyzing video with OpenRouter:', error);
      return {
        eyeContact: 0.5,
        attention: 0.5,
        bodyLanguage: 0.5,
        facialExpression: 0.5,
        professionalism: 0.5,
        analysis: "Analysis unavailable"
      };
    }
  }

  // Evaluate single answer
  async evaluateAnswer({ question, answer, voiceMetrics, videoMetrics }) {
    const prompt = `
      Evaluate this interview answer:
      
      Question: ${question}
      Candidate's Answer: ${answer}
      
      Voice Analysis Metrics:
      - Confidence: ${voiceMetrics.confidence}
      - Clarity: ${voiceMetrics.clarity}
      - Speaking Pace: ${voiceMetrics.pace} words per minute
      - Filler Words: ${voiceMetrics.fillerWords}
      
      Video Metrics:
      - Eye Contact: ${videoMetrics.eyeContact}
      - Attention Level: ${videoMetrics.attention}
      - Professionalism: ${videoMetrics.professionalism}
      
      Provide evaluation in this JSON format:
      {
        "technicalAccuracy": 0-10,
        "communicationSkills": 0-10,
        "confidenceScore": 0-10,
        "overallScore": 0-10,
        "strengths": ["array", "of", "strengths"],
        "improvements": ["areas", "to", "improve"],
        "feedback": "detailed feedback text"
      }
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text.
    `;

    try {
      const text = await this.callOpenRouter(prompt);
      console.log('Evaluation raw response:', text);

      const parsed = await this.parseJSONResponse(text);
      if (parsed) return parsed;

      return this.getDefaultEvaluation();
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return this.getDefaultEvaluation();
    }
  }

  // Generate final report
  async generateFinalReport({ candidateName, position, answers, metrics }) {
    // Format answers for prompt
    const answersSummary = answers.map((a, i) => `
      Q${i + 1}: ${a.question}
      Answer: ${a.answer.substring(0, 200)}${a.answer.length > 200 ? '...' : ''}
      Score: ${a.evaluation?.overallScore || 'N/A'}
      Feedback: ${a.evaluation?.feedback || 'No feedback available'}
    `).join('\n');

    const prompt = `
      Generate final interview evaluation report for:
      
      Candidate: ${candidateName}
      Position: ${position}
      
      Interview Performance Summary:
      - Total Questions: ${metrics.totalQuestions}
      - Completed: ${metrics.completedQuestions}
      
      Detailed Answers:
      ${answersSummary}
      
      Provide comprehensive evaluation in this JSON format:
      {
        "summary": {
          "overallScore": 0-100,
          "technicalScore": 0-100,
          "communicationScore": 0-100,
          "confidenceScore": 0-100,
          "recommendation": "Strong Hire/Hire/No Hire/Strong No Hire",
          "decision": "Selected/Rejected"
        },
        "detailedBreakdown": {
          "technicalSkills": { "score": 0-10, "feedback": "" },
          "problemSolving": { "score": 0-10, "feedback": "" },
          "communication": { "score": 0-10, "feedback": "" },
          "confidence": { "score": 0-10, "feedback": "" }
        },
        "strengths": ["array", "of", "key", "strengths"],
        "weaknesses": ["areas", "needing", "improvement"],
        "finalFeedback": "comprehensive feedback paragraph",
        "suggestions": ["suggestions", "for", "improvement"]
      }
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text.
    `;

    try {
      const text = await this.callOpenRouter(prompt, this.complexModel);
      console.log('Final report raw response:', text);

      const parsed = await this.parseJSONResponse(text);
      if (parsed) return parsed;

      return this.getDefaultReport(candidateName, position);
    } catch (error) {
      console.error('Error generating final report:', error);
      return this.getDefaultReport(candidateName, position);
    }
  }

  // Convert text to speech using Python gTTS service
  async textToSpeech(text) {
    try {
      console.log('Generating TTS via Python service...');
      const response = await axios.post(`${env.PYTHON_SERVICE_URL}/tts`, {
        text: text,
        lang: 'en'
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Python TTS error:', error.message);

      // Fallback to minimal translation TTS if Python service fails
      try {
        console.log('Attempting secondary fallback TTS...');
        const url = 'https://translate.google.com/translate_tts';
        const fallbackResponse = await axios.get(url, {
          params: {
            ie: 'UTF-8',
            tl: 'en',
            q: text.substring(0, 200),
            client: 'tw-ob'
          },
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        return Buffer.from(fallbackResponse.data);
      } catch (fallbackError) {
        console.error('All TTS methods failed:', fallbackError.message);
        return null;
      }
    }
  }

  async getAudioForText(text) {
    const audioBuffer = await this.textToSpeech(text);
    if (audioBuffer) {
      return audioBuffer.toString('base64');
    }
    return null;
  }

  getFallbackQuestions(position, count) {
    const baseQuestions = [
      {
        question: `Tell me about your experience with ${position} and why you're interested in this role.`,
        type: "behavioral",
        expectedTime: 120,
        difficulty: "easy"
      },
      {
        question: `Explain a key technical concept relevant to ${position}.`,
        type: "technical",
        expectedTime: 90,
        difficulty: "medium"
      },
      {
        question: "How do you approach solving complex problems in your work?",
        type: "technical",
        expectedTime: 120,
        difficulty: "medium"
      },
      {
        question: "Describe a challenging project you worked on and how you overcame obstacles.",
        type: "scenario",
        expectedTime: 150,
        difficulty: "hard"
      },
      {
        question: "What are your strengths and areas for improvement in technical work?",
        type: "behavioral",
        expectedTime: 90,
        difficulty: "medium"
      }
    ];

    return baseQuestions.slice(0, count);
  }

  getDefaultEvaluation() {
    return {
      technicalAccuracy: 5,
      communicationSkills: 5,
      confidenceScore: 5,
      overallScore: 5,
      strengths: ["Clear communication", "Relevant experience"],
      improvements: ["Could provide more specific examples", "Improve delivery confidence"],
      feedback: "Average performance. Shows understanding but could benefit from more detailed explanations and confident delivery."
    };
  }

  getDefaultReport(candidateName, position) {
    return {
      summary: {
        overallScore: 65,
        technicalScore: 70,
        communicationScore: 60,
        confidenceScore: 65,
        recommendation: "Hire",
        decision: "Selected"
      },
      detailedBreakdown: {
        technicalSkills: { score: 7, feedback: "Good understanding of core concepts" },
        problemSolving: { score: 6, feedback: "Adequate problem-solving approach" },
        communication: { score: 6, feedback: "Clear but could be more concise" },
        confidence: { score: 6.5, feedback: "Moderately confident in responses" }
      },
      strengths: ["Technical knowledge", "Communication clarity", "Relevant experience"],
      weaknesses: ["Limited specific examples", "Could improve delivery confidence", "Needs more depth in explanations"],
      finalFeedback: `${candidateName} demonstrates solid foundational knowledge for the ${position} role. Shows good understanding of relevant concepts but would benefit from more specific examples and confident delivery.`,
      suggestions: ["Practice with specific project examples", "Improve presentation confidence", "Work on concise communication"]
    };
  }
}

module.exports = new AIService();
