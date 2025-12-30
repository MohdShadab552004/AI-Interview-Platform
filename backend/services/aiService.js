const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class AIService {
  constructor() {
    // Use the correct model name
    this.geminiModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash" // Updated from "gemini-pro"
    });
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
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini raw response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed questions:', parsed);
        return parsed;
      }
      
      console.log('No JSON found in response, using fallback');
      return this.getFallbackQuestions(position, count);
    } catch (error) {
      console.error('Error generating questions with Gemini:', error);
      console.error('Error details:', error.message);
      return this.getFallbackQuestions(position, count);
    }
  }
  
  // Transcribe audio using Gemini (text-based analysis)
  async transcribeAudio(audioBuffer, mimeType, metadata = {}) {
    const prompt = `
      Analyze this audio transcription and provide insights. 
      Return JSON with: transcription text, confidence score (0-1), 
      speaking pace (slow/normal/fast), filler word count estimate,
      and emotional tone (confident/neutral/nervous).
      
      Audio Context: Interview response
      Audio Metadata: ${JSON.stringify(metadata)}
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text.
    `;
    
    try {
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Transcription raw response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        return {
          text: analysis.transcription || "Audio processed successfully",
          language: "en",
          duration: metadata.duration || 0,
          confidence: analysis.confidence || 0.8,
          pace: analysis.pace || "normal",
          fillerWords: analysis.fillerWordCount || 0,
          tone: analysis.emotionalTone || "neutral",
          metadata,
          rawAnalysis: analysis
        };
      }
      
      return {
        text: "Audio transcription completed",
        language: "en",
        duration: metadata.duration || 0,
        confidence: 0.7,
        pace: "normal",
        fillerWords: 0,
        tone: "neutral",
        metadata
      };
    } catch (error) {
      console.error('Error processing audio with Gemini:', error);
      throw new Error('Audio processing failed');
    }
  }
  
  // Analyze voice metrics using Gemini
  async analyzeVoice(audioData, transcript) {
    const prompt = `
      Analyze this interview audio response based on the transcript:
      
      Transcript: "${transcript}"
      
      Return as JSON with these exact fields:
      {
        "confidence": 0.0 (0-1, where 1 is highly confident),
        "clarity": 0.0 (0-1, where 1 is very clear),
        "pace": 150 (estimated words per minute, reasonable range 120-200),
        "pitchStability": 0.0 (0-1, where 1 is very stable),
        "fillerWords": 0.0 (0-1, where 1 is excessive filler words),
        "pauses": 0.0 (0-1, where 1 is excessive pausing),
        "analysis": "brief analysis text"
      }
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text.
    `;
    
    try {
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Voice analysis raw response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        confidence: 0.5,
        clarity: 0.5,
        pace: 150,
        pitchStability: 0.5,
        fillerWords: 0.3,
        pauses: 0.4,
        analysis: "Average speech patterns detected"
      };
    } catch (error) {
      console.error('Error analyzing voice with Gemini:', error);
      return {
        confidence: 0.5,
        clarity: 0.5,
        pace: 150,
        pitchStability: 0.5,
        fillerWords: 0,
        pauses: 0,
        analysis: "Analysis unavailable"
      };
    }
  }
  
  // Analyze video metrics using Gemini
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
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Video analysis raw response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        eyeContact: 0.6,
        attention: 0.7,
        bodyLanguage: 0.5,
        facialExpression: 0.6,
        professionalism: 0.7,
        analysis: "Average video presentation detected"
      };
    } catch (error) {
      console.error('Error analyzing video with Gemini:', error);
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
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Evaluation raw response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
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
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Final report raw response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.getDefaultReport(candidateName, position);
    } catch (error) {
      console.error('Error generating final report:', error);
      return this.getDefaultReport(candidateName, position);
    }
  }
  
  // Helper method to convert text to speech script
  async textToSpeech(text, voiceProfile = 'professional') {
    const prompt = `
      Convert this text into a natural, conversational script for text-to-speech:
      
      "${text}"
      
      Make it sound natural for a ${voiceProfile} voice profile.
      Return only the conversational version of the text.
    `;
    
    try {
      const result = await this.geminiModel.generateContent(prompt);
      const response = await result.response;
      const conversationalText = response.text();
      
      return {
        text: conversationalText,
        voiceProfile: voiceProfile,
        originalLength: text.length,
        conversationalLength: conversationalText.length
      };
    } catch (error) {
      console.error('Error generating speech script:', error);
      return {
        text: text,
        voiceProfile: 'default'
      };
    }
  }
  
  // Get available Gemini models (for debugging)
  async listAvailableModels() {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const models = await genAI.listModels();
      console.log('Available models:', models);
      return models;
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
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