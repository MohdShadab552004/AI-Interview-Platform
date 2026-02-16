// Google Gemini focused AI Service
const { default: axios } = require("axios");
const FormData = require('form-data');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require('../config/env');
const fs = require('fs');
const path = require('path');


class AIService {
  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.aiProvider = env.AI_PROVIDER || 'gemini';
    this.persona = env.INTERVIEWER_PERSONA;

    // Default models - Use Gemini
    this.defaultModel = 'gemini-2.5-flash';
    this.complexModel = 'gemini-2.5-flash';

    // Gemini Client
    if (this.geminiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiKey);
    }

    // Token Usage Tracking (Detailed)
    this.tokenUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_estimate: 0 // approximate
    };

    console.log(`[AI Service] Initialized. Provider: ${this.aiProvider}`);

    // Token Limit Configuration
    this.tokenLimit = parseInt(process.env.TOKEN_LIMIT_PER_INTERVIEW) || 50000;
    this.enableTokenFallback = process.env.ENABLE_TOKEN_FALLBACK !== 'false';

    // Load Question Bank and Job Profiles
    try {
      const questionBankPath = path.join(__dirname, '../config/question_bank.json');
      const jobProfilesPath = path.join(__dirname, '../config/job_profiles.json');

      this.questionBank = JSON.parse(fs.readFileSync(questionBankPath, 'utf8'));
      this.jobProfiles = JSON.parse(fs.readFileSync(jobProfilesPath, 'utf8'));

      console.log('[AI Service] Question bank and job profiles loaded successfully');
    } catch (error) {
      console.error('[AI Service] Failed to load question bank or job profiles:', error.message);
      this.questionBank = null;
      this.jobProfiles = null;
    }

    this.logFile = path.join(__dirname, '../ai_debug.log');
    fs.writeFileSync(this.logFile, `[AI Service Started at ${new Date().toISOString()}]\n`);
  }

  logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);
    console.log(message); // Still log to console
  }

  // Main entry point for LLM calls (Simplified to Gemini only)
  async callAI(prompt, modelOverride = null) {
    try {
      return await this.callGemini(prompt, modelOverride || this.defaultModel);
    } catch (err) {
      this.logToFile(`[AI Service] Gemini failed: ${err.message}`);
      throw err;
    }
  }

  async callGemini(prompt, model = 'gemini-1.5-flash') {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add artificial delay before request to avoid rapid sequences (Throttling)
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.logToFile(`[AI Service] Calling Gemini with model: ${model} (Attempt ${attempt + 1})`);
        const geminiModel = this.genAI.getGenerativeModel({
          model: model,
          systemInstruction: this.persona || "You are an expert technical interviewer."
        });

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Rough token estimation
        this.tokenUsage.total_tokens += Math.ceil((prompt.length + text.length) / 4);

        return text;
      } catch (error) {
        const isRateLimit = error.message?.includes('429') || error.status === 429;

        if (isRateLimit && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
          this.logToFile(`[AI Service] Quota Exceeded (429). Retrying in ${Math.round(delay / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        this.logToFile(`[AI Service] Gemini Error: ${error.message}`);
        throw error;
      }
    }
  }

  getTokenStats() {
    return this.tokenUsage;
  }

  async parseJSONResponse(text) {
    if (!text) return null;

    // Sanitize control characters that break JSON parsing
    const sanitizeJSON = (str) => {
      return str
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \n, \r, \t
        .trim();
    };

    try {
      // 1. Try parsing directly
      return JSON.parse(sanitizeJSON(text));
    } catch (e) {
      // 2. Try extracting from markdown code blocks ```json ... ```
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        const extracted = codeBlockMatch[1];
        try {
          const sanitized = sanitizeJSON(extracted);
          const res = JSON.parse(sanitized);
          return res;
        } catch (e2) {
          console.warn('[AI Service] Failed to parse JSON from code block');
        }
      }

      // 2.5 Clean basic markdown if present without code blocks
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleaned);
      } catch (e2_5) { }

      // 3. Brute force: Find first '{' or '[' and last '}' or ']'
      try {
        const firstOpenBrace = text.indexOf('{');
        const firstOpenBracket = text.indexOf('[');

        let startIdx = -1;
        let endIdx = -1;

        if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
          startIdx = firstOpenBrace;
          endIdx = text.lastIndexOf('}');
        } else if (firstOpenBracket !== -1) {
          startIdx = firstOpenBracket;
          endIdx = text.lastIndexOf(']');
        }

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const jsonStr = text.substring(startIdx, endIdx + 1);
          return JSON.parse(sanitizeJSON(jsonStr));
        }
      } catch (e3) {
        console.error('JSON parse error from extracted text:', e3);
      }

      console.error('Failed to parse JSON from AI response. Raw text length:', text.length);
      return null;
    }
  }

  // Check if tokens are available
  hasTokensRemaining() {
    return this.tokenUsage.total_tokens < this.tokenLimit;
  }

  // Check if token limit is exceeded
  isTokenExpired() {
    return this.tokenUsage.total_tokens >= this.tokenLimit;
  }

  // Get job profile configuration
  getJobProfile(role) {
    if (!this.jobProfiles || !this.jobProfiles.job_profiles) {
      return null;
    }
    return this.jobProfiles.job_profiles.find(
      profile => profile.role.toLowerCase() === role.toLowerCase()
    );
  }

  // Get fixed HR questions
  getFixedHRQuestions(count = 4) {
    if (!this.questionBank || !this.questionBank.fixed_hr_questions) {
      console.warn('[AI Service] Fixed HR questions not found');
      return [];
    }
    return this.questionBank.fixed_hr_questions.slice(0, count);
  }

  // Extract skills and experience from CV
  async extractCVSkills(cvText) {
    if (!cvText || cvText.trim() === '') {
      return { skills: [], experience: [], projects: [], education: {} };
    }

    const prompt = `Analyze this CV and extract the following information in JSON format:
{
  "skills": ["list of technical and soft skills mentioned"],
  "experience": [
    {
      "role": "job title",
      "company": "company name",
      "duration": "time period",
      "responsibilities": ["key responsibilities"]
    }
  ],
  "projects": [
    {
      "name": "project name",
      "technologies": ["technologies used"],
      "description": "brief description"
    }
  ],
  "education": {
    "degree": "highest degree",
    "specialization": "field of study"
  }
}

CV Text:
${cvText.substring(0, 4000)}

Return ONLY valid JSON, no explanations.`;

    try {
      console.log('[AI Service] Calling AI for CV skill extraction...');
      const text = await this.callAI(prompt);
      const parsed = await this.parseJSONResponse(text);
      console.log('[AI Service] CV skills parsed:', !!parsed);
      return parsed || { skills: [], experience: [], projects: [], education: {} };
    } catch (error) {
      console.error('[AI Service] Error extracting CV skills:', error);
      return { skills: [], experience: [], projects: [], education: {} };
    }
  }

  // Extract requirements from Job Description
  async extractJDRequirements(jobDescription) {
    if (!jobDescription || jobDescription.trim() === '') {
      return { requirements: [], responsibilities: [], preferred: [] };
    }

    const prompt = `Analyze this Job Description and extract the following in JSON format:
{
  "requirements": ["list of required skills and qualifications"],
  "responsibilities": ["key job responsibilities"],
  "preferred": ["preferred/nice-to-have qualifications"]
}

Job Description:
${jobDescription.substring(0, 4000)}

Return ONLY valid JSON, no explanations.`;

    try {
      console.log('[AI Service] Calling AI for JD requirement extraction...');
      const text = await this.callAI(prompt);
      const parsed = await this.parseJSONResponse(text);
      console.log('[AI Service] JD requirements parsed:', !!parsed);
      return parsed || { requirements: [], responsibilities: [], preferred: [] };
    } catch (error) {
      console.error('[AI Service] Error extracting JD requirements:', error);
      return { requirements: [], responsibilities: [], preferred: [] };
    }
  }

  // Generate questions based on CV and JD
  async generateCVJDQuestions(position, cvSkills, jdRequirements, count) {
    const profile = this.getJobProfile(position);
    const isTechnical = profile && profile.category === 'technical';

    const cvSkillsList = cvSkills.skills?.join(', ') || 'general skills';
    const jdReqsList = jdRequirements.requirements?.join(', ') || 'role requirements';
    const responsibilities = jdRequirements.responsibilities?.join(', ') || 'job responsibilities';

    const prompt = isTechnical ?
      `You are an expert technical interviewer for ${position} position.

Generate ${count} interview questions based on:
- Candidate's CV Skills: ${cvSkillsList}
- Job Requirements: ${jdReqsList}
- Job Responsibilities: ${responsibilities}

Question Distribution:
- 50% "code" questions: Detailed coding challenges.
- 30% "technical" questions: Deep conceptual/system design.
- 20% "experience" questions: Based on projects in CV.

Each question MUST include:
{
  "question": "Clear, specific question",
  "type": "code|technical|experience",
  "expectedTime": 300-900 (in seconds),
  "difficulty": "easy|medium|hard",
  "language": "Suggested language (javascript/python/java/cpp)",
  "hint1": "Small conceptual hint",
  "hint2": "Detailed implementation hint",
  "testCases": [
    {"input": "example input", "output": "expected output"},
    {"input": "edge case input", "output": "expected output"}
  ]
}

CRITICAL RULES:
1. Coding questions must be solvable in the editor and executed via Judge0.
2. Non-coding questions should still be practical and role-specific.
3. Return ONLY a valid JSON array.`
      : `You are an expert interviewer for ${position} position.

Generate ${count} PRACTICAL interview questions based on:
- Candidate's CV Experience: ${cvSkills.experience?.map(e => e.role).join(', ') || 'general experience'}
- Job Requirements: ${jdReqsList}
- Job Responsibilities: ${responsibilities}

Question types to include:
- "case-study": A specific workplace scenario requiring a detailed strategy.
- "email-writing": Draft an email for a specific professional situation.
- "essay-writing": Write a short response on a domain topic.
- "situational": "What would you do if..." questions.

Format: [{"question": "...", "type": "case-study|email-writing|essay-writing|situational", "expectedTime": 300-600, "difficulty": "easy|medium|hard"}, ...]

CRITICAL: At least 3 questions MUST be Case Studies or Writing tasks.
Return ONLY a valid JSON array.`;

    try {
      const text = await this.callAI(prompt);
      const parsed = await this.parseJSONResponse(text);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count);
      }
      return this.getFallbackQuestionsByRole(position, count);
    } catch (error) {
      console.error('[AI Service] Error generating CV/JD questions:', error);
      return this.getFallbackQuestionsByRole(position, count);
    }
  }


  // Generate interview questions based on CV and Job Description
  async generateQuestions(position, experienceLevel, cvText = '', jobDescription = '') {
    console.log(`[AI Service] Generating questions for ${position} (${experienceLevel})`);

    // Get job profile configuration
    const profile = this.getJobProfile(position);

    // Enforce 20 for technical, 15 for non-technical as requested
    let category = profile?.category;
    if (!category) {
      const techKeywords = ['developer', 'engineer', 'technician', 'data scientist', 'analyst', 'programmer', 'architect', 'devops', 'security', 'pilot', 'technical'];
      const lowerPos = position.toLowerCase();
      category = techKeywords.some(kw => lowerPos.includes(kw)) ? 'technical' : 'non_technical';
    }

    const questionCount = category === 'technical' ? 20 : 15;
    const hrCount = profile?.hr_questions || 4;
    const roleQuestionCount = questionCount - hrCount;

    console.log(`[AI Service] Role: ${position} | Category: ${category}`);
    console.log(`[AI Service] Total: ${questionCount} questions (${roleQuestionCount} role-specific + ${hrCount} HR)`);

    try {
      // Extract information from CV and JD
      console.log('[AI Service] Parsing CV and JD...');
      const cvSkills = await this.extractCVSkills(cvText);
      const jdRequirements = await this.extractJDRequirements(jobDescription);

      console.log('[AI Service] CV Skills extracted:', cvSkills.skills?.length || 0, 'skills');
      console.log('[AI Service] JD Requirements extracted:', jdRequirements.requirements?.length || 0, 'requirements');

      // Generate role-specific questions based on CV and JD
      console.log(`[AI Service] Generating ${roleQuestionCount} CV/JD-based questions...`);
      const roleQuestions = await this.generateCVJDQuestions(
        position,
        cvSkills,
        jdRequirements,
        roleQuestionCount
      );

      // Get fixed HR questions
      const hrQuestions = this.getFixedHRQuestions(hrCount);

      // Combine all questions
      const allQuestions = [...roleQuestions, ...hrQuestions];

      console.log(`[AI Service] Generated ${allQuestions.length} total questions`);
      console.log(`  - ${roleQuestions.length} role-specific questions`);
      console.log(`  - ${hrQuestions.length} HR questions`);

      return allQuestions;

    } catch (error) {
      console.error('[AI Service] Error in generateQuestions:', error);

      // Fallback to generic questions
      console.log('[AI Service] Using fallback questions');
      const fallbackQuestions = this.getFallbackQuestionsByRole(position, roleQuestionCount);
      const hrQuestions = this.getFixedHRQuestions(hrCount);

      return [...fallbackQuestions, ...hrQuestions];
    }
  }

  // Fallback questions by role category
  getFallbackQuestionsByRole(position, count) {
    const profile = this.getJobProfile(position);
    const isTechnical = profile && profile.category === 'technical';

    const questions = [];
    if (isTechnical) {
      const techList = [
        "Explain the core architecture of your last major project.",
        "How do you handle error management and debugging in complex applications?",
        "Describe a performance optimization you implemented recently.",
        "How do you ensure code quality and maintainability in your work?",
        "Explain the difference between different state management approaches you've used.",
        "Talk about a challenging technical trade-off you had to make.",
        "How do you approach database schema design for scalability?",
        "Describe your experience with CI/CD pipelines and deployment processes.",
        "What is your approach to security best practices in development?",
        "How do you stay updated with the latest trends in your technology stack?",
        "Explain a complex bug you found and how you fixed it."
      ];
      for (let i = 0; i < count; i++) {
        questions.push({
          question: techList[i % techList.length],
          type: "technical",
          expectedTime: 300,
          difficulty: "medium"
        });
      }
    } else {
      const nonTechList = [
        "Describe your process for managing complex projects and deadlines.",
        "How do you handle conflict within a team or with stakeholders?",
        "Tell me about a time you had to pivot your strategy based on new data.",
        "How do you ensure effective communication across different departments?",
        "Describe your approach to problem-solving in a fast-paced environment.",
        "How do you prioritize your tasks when faced with multiple urgent requests?",
        "Tell me about a successful initiative you led and its impact.",
        "How do you handle feedback and criticism from your team or superiors?",
        "Describe a time you had to persuade others to adopt your point of view.",
        "What motivates you to perform at your best in this role?",
        "How do you approach learning a new domain or industry quickly?"
      ];
      for (let i = 0; i < count; i++) {
        questions.push({
          question: nonTechList[i % nonTechList.length],
          type: "behavioral",
          expectedTime: 240,
          difficulty: "medium"
        });
      }
    }
    return questions;
  }

  // Transcribe audio using Python Whisper service
  async transcribeAudio(audioBuffer, mimeType, metadata = {}) {
    try {
      // 1. Fallback to Python Whisper Service
      console.log('Sending audio to local Python Whisper service...');

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.wav',  // Python service expects a filename with extension
        contentType: mimeType || 'audio/wav'
      });

      try {
        const response = await axios.post(`${env.PYTHON_SERVICE_URL}/transcribe`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 30000 // 30s timeout
        });

        if (response.data && response.data.success) {
          console.log(`Python Service Transcription successful:`, response.data.text.substring(0, 50) + "...");
          return {
            text: response.data.text,
            language: "en",
            duration: metadata.duration || 0,
            confidence: 0.95,
            provider: 'python-whisper-local'
          };
        } else {
          throw new Error(response.data.error || "Python service returned unsuccessful");
        }
      } catch (pyError) {
        console.error("Python Transcription Service failed:", pyError.message);
        // proceed to error throw below to trigger soft fallback
      }

      throw new Error("All transcription services failed");

    } catch (error) {
      console.error("Transcription error:", error.message);

      // 3. Soft Fallback (Mock) - so the user can continue even if STT fails
      console.warn('All transcription methods failed. Using soft fallback.');
      return {
        text: "[Audio Response Received - Transcription Unavailable]",
        language: "en",
        duration: metadata.duration || 0,
        confidence: 0.5,
        pace: "normal",
        fillerWords: 0,
        tone: "neutral",
        provider: 'fallback-mock'
      };
    }
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
      - hint1 (if type is "code", provide a small conceptual hint, otherwise null)
      - hint2 (if type is "code", provide a more detailed implementation hint, otherwise null)
      
      IMPORTANT: Return ONLY valid JSON.
    `;

    return await this.safeGenerateQuestions(prompt, count, "technical");
  }

  // Generate full 25-question interview (Split into 3 requests for stability)
  async generateFullInterview(cvText, position, experienceLevel, count = 25) {
    console.log('[AI Service] Generating interview rounds in parallel...');

    // We split into 3 prompts to avoid token limits (4096 is often tight for 25 items + reasoning)
    const p1 = this.generateRoundQuestions(1, 10, cvText, position, experienceLevel, "CV Analysis & Theory");
    const p2 = this.generateRoundQuestions(2, 10, cvText, position, experienceLevel, "Technical Coding & Problem Solving");
    const p3 = this.generateRoundQuestions(3, 5, cvText, position, experienceLevel, "Behavioral & General (Hard)");

    try {
      const results = await Promise.all([p1, p2, p3]);

      // Ensure we strictly adhere to the counts (slice if AI generated extra)
      const q1 = results[0].questions.slice(0, 10);
      const q2 = results[1].questions.slice(0, 10);
      const q3 = results[2].questions.slice(0, 5);

      const allQuestions = [...q1, ...q2, ...q3];
      const totalUsage = {
        prompt_tokens: (results[0].usage?.prompt_tokens || 0) + (results[1].usage?.prompt_tokens || 0) + (results[2].usage?.prompt_tokens || 0),
        completion_tokens: (results[0].usage?.completion_tokens || 0) + (results[1].usage?.completion_tokens || 0) + (results[2].usage?.completion_tokens || 0),
        total_tokens: (results[0].usage?.total_tokens || 0) + (results[1].usage?.total_tokens || 0) + (results[2].usage?.total_tokens || 0)
      };

      console.log(`[AI Service] Generated ${allQuestions.length} questions total (Strict Limit Enforced).`);

      if (allQuestions.length < 5) throw new Error("Too few questions generated");
      return { questions: allQuestions, usage: totalUsage };

    } catch (error) {
      console.error('Error in parallel generation:', error);
      return this.generateFallbackFullInterview(count);
    }
  }

  async generateRoundQuestions(round, count, cvText, position, experienceLevel, focusArea) {
    const prompt = `
      You are an expert technical interviewer for a ${position} role (${experienceLevel} level).
      Analyze the following CV content:
      "${cvText.substring(0, 2000)}"

      Generate ${count} questions for Round ${round}: ${focusArea}.
      
      Guidelines:
      - Round 1: Specific "How did you..." questions about projects/claims. Type: "cv-analysis".
      - Round 2: Strict "code" challenges (write a function) for tech roles. For non-tech, focus on "case-study" or "professional-writing".
      - Round 3: "behavioral" or "hard-logic".

      Specific Types for Tech: "code", "cv-analysis", "technical-problem".
      Specific Types for Non-Tech: "case-study", "email-writing", "essay-writing", "behavioral".

      Format: Return as a JSON array EXACTLY with this structure:
      [
        { 
          "question": "...", 
          "type": "code|case-study|cv-analysis|...", 
          "expectedTime": 300, 
          "difficulty": "medium|hard",
          "language": "python/js/etc (if code)",
          "hint1": "...",
          "hint2": "...",
          "testCases": [{"input": "...", "output": "..."}] (if code)
        }
      ]

      IMPORTANT: Technical Round 2 MUST have at least 5 "code" questions.
      Non-Technical Round 2 MUST have at least 3 "case-study" or writing tasks.
      Return ONLY valid JSON.
    `;

    try {
      const { content, usage } = await this.callAI(prompt, this.complexModel);
      const parsed = await this.parseJSONResponse(content);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) return { questions: parsed, usage };
      throw new Error("Empty or invalid questions returned");
    } catch (e) {
      console.error(`Error generating Round ${round}:`, e.message);
      // Return specific fallback questions for this round to ensure we meet the count
      const fallback = this.getRoundFallback(round, count, position);
      return { questions: fallback, usage: { total_tokens: 0 } };
    }
  }

  getRoundFallback(round, count, position) {
    return Array(count).fill(0).map((_, i) => {
      let type = "behavioral";
      let questionText = `Fallback Question ${i + 1} for Round ${round} (${position}): Please explain a key concept related to ${position}.`;
      let language = null;

      if (round === 1) {
        type = "cv-analysis";
        questionText = `Fallback CV Question ${i + 1}: Tell me about your experience with ${position}.`;
      } else if (round === 2) {
        // First half code, second half technical-problem
        const isCode = i < Math.ceil(count / 2);
        type = isCode ? "code" : "technical-problem";
        questionText = isCode
          ? `Write a function to solve a basic problem (e.g., Fibonacci sequence) relevant to ${position}.`
          : `Explain a complex technical concept related to ${position}.`;

        if (isCode) {
          // Simple heuristic for language
          language = position.toLowerCase().includes('python') ? 'python' : 'javascript';
        }
      }

      return {
        round: round,
        question: questionText,
        type: type,
        expectedTime: type === 'code' ? 300 : 120,
        difficulty: "medium",
        language: language,
        hint1: type === 'code' ? "Think about the base case first or use a specific data structure." : null,
        hint2: type === 'code' ? "Consider the time complexity and edge cases." : null,
        testCases: type === 'code' ? [
          { input: "5", output: language === 'python' ? "5" : "5" }, // Example: Fibonacci(5) -> 5
          { input: "10", output: "55" }
        ] : []
      };
    });
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
        language: isCode ? "javascript" : null,
        hint1: isCode ? "Think about the data structure's properties." : null,
        hint2: isCode ? "A two-pointer approach might be efficient here." : null
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
      const { content, usage } = await this.callAI(prompt);
      const parsed = await this.parseJSONResponse(content);
      if (parsed && Array.isArray(parsed)) {
        return { questions: parsed, usage };
      }
      throw new Error('Invalid JSON format');
    } catch (error) {
      console.error('Error generating questions:', error);
      return {
        questions: Array(count).fill(0).map((_, i) => ({
          question: `Fallback ${fallbackType} question ${i + 1}`,
          type: fallbackType,
          expectedTime: 120,
          difficulty: "medium"
        })),
        usage: { total_tokens: 0 }
      };
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
      const text = await this.callAI(prompt);
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
      console.error('Error analyzing video:', error);
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
  async evaluateAnswer({ question, answer, voiceMetrics, videoMetrics, hintsUsed }) {
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



      Hint Usage: 
      - Hints Used Count: ${hintsUsed || 0}
      - Penalty Applied: ${hintsUsed > 0 ? "YES" : "NO"}
      
      Provide evaluation in this JSON format:
      {
        "technicalAccuracy": 0-10,
        "communicationSkills": 0-10,
        "confidenceScore": 0-10,
        "overallScore": 0-10 (Deduct 1-2 points if Hint Used is YES),
        "strengths": ["array", "of", "strengths"],
        "improvements": ["areas", "to", "improve"],
        "feedback": "detailed feedback text"
      }
      
      IMPORTANT: Return ONLY valid JSON. Do not include any additional text.
    `;

    try {
      const { content, usage } = await this.callAI(prompt);
      console.log('Evaluation raw response:', content);

      const parsed = await this.parseJSONResponse(content);
      if (parsed) return { evaluation: parsed, usage };

      return { evaluation: this.getDefaultEvaluation(), usage };
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return { evaluation: this.getDefaultEvaluation(), usage: { total_tokens: 0 } };
    }
  }

  getDefaultEvaluation() {
    return {
      technicalAccuracy: 0.5,
      communicationSkills: 0.5,
      confidenceScore: 0.5,
      overallScore: 0.5,
      feedback: "Could not generate detailed evaluation due to AI service error."
    };
  }

  getDefaultReport(candidateName, position) {
    return {
      summary: {
        overallScore: 0,
        technicalScore: 0,
        communicationScore: 0,
        decision: "Pending",
        reason: "Could not generate report due to AI service unavailability."
      },
      detailedBreakdown: {
        technicalSkills: { score: 0, feedback: "N/A" },
        problemSolving: { score: 0, feedback: "N/A" },
        communication: { score: 0, feedback: "N/A" },
        confidence: { score: 0, feedback: "N/A" }
      },
      strengths: [],
      weaknesses: ["Report generation failed"],
      finalFeedback: `An error occurred while generating the final report for ${candidateName}. Please try again later.`,
      suggestions: []
    };
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
      const { content, usage } = await this.callAI(prompt, this.complexModel);
      console.log('Final report raw response:', content);

      const parsed = await this.parseJSONResponse(content);
      if (parsed) return { report: parsed, usage };

      return { report: this.getDefaultReport(candidateName, position), usage };
    } catch (error) {
      console.error('Error generating final report:', error);
      return { report: this.getDefaultReport(candidateName, position), usage: { total_tokens: 0 } };
    }
  }

  // Convert text to speech
  async textToSpeech(text) {
    // 1. Try Google Translate TTS (Primary - Requested by User for Reliability)
    try {
      console.log('Attempting TTS via Google Translate...');

      // Helper to split text into safe chunks (Google TTS limit ~200 chars)
      const splitTextIntoChunks = (text, maxLength = 180) => {
        const chunks = [];
        let currentChunk = '';
        const sentences = text.split(/([.?!]+)/); // Split by punctuation, keeping it

        for (let i = 0; i < sentences.length; i++) {
          const part = sentences[i];
          if (currentChunk.length + part.length < maxLength) {
            currentChunk += part;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = part;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks.filter(c => c.length > 0);
      };

      const chunks = splitTextIntoChunks(text);
      console.log(`Split text into ${chunks.length} chunks for TTS.`);

      const audioBuffers = await Promise.all(chunks.map(async (chunk) => {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=en&client=tw-ob`;
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          }
        });
        return Buffer.from(response.data);
      }));

      if (audioBuffers.length > 0) {
        return Buffer.concat(audioBuffers);
      }
    } catch (googleError) {
      console.error('Google Translate TTS failed:', googleError.message);
      // Fallthrough to other methods
    }

    // 2. Fallback to Python gTTS service
    try {
      console.log('Generating TTS via Python service...');
      const response = await axios.post(`${env.PYTHON_SERVICE_URL}/tts`, {
        text: text,
        lang: 'en'
      }, { responseType: 'arraybuffer' });

      if (response.data) {
        return Buffer.from(response.data);
      }
    } catch (pythonError) {
      console.error('Python TTS failed:', pythonError.message);
    }

    console.error('All TTS methods failed. Returning null.');
    return null;
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
        difficulty: "easy",
        hint1: null,
        hint2: null
      },
      {
        question: `Write a function to reverse a string in your preferred language.`,
        type: "code",
        expectedTime: 300,
        difficulty: "medium",
        hint1: "You can iterate through the string backwards.",
        hint2: "Consider using built-in methods like split(), reverse(), and join()."
      },
      {
        question: `Describe a challenging technical problem you solved recently.`,
        type: "behavioral",
        expectedTime: 180,
        difficulty: "medium",
        hint1: null,
        hint2: null
      }
    ];

    return baseQuestions.slice(0, count);
  }
}

module.exports = new AIService();
