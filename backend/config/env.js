module.exports = {
  // Server
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // AI APIs
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',


  // Services
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://localhost:5001',

  // AI Configuration
  INTERVIEWER_PERSONA: process.env.INTERVIEWER_PERSONA || "You are an expert technical interviewer.",

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Session
  SESSION_SECRET: process.env.SESSION_SECRET || 'interview-secret-key-change-in-production'
};