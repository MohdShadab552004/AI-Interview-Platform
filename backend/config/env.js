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

  // Judge0
  JUDGE0_API_URL: process.env.JUDGE0_API_URL || 'http://localhost:2358',
  JUDGE0_API_KEY: process.env.JUDGE0_API_KEY, // RapidAPI Key (Optional)
  JUDGE0_API_HOST: process.env.JUDGE0_API_HOST, // RapidAPI Host (Optional)
  JUDGE0_AUTHN_TOKEN: process.env.JUDGE0_AUTHN_TOKEN, // Local AuthN Token (X-Auth-Token)
  JUDGE0_AUTHZ_TOKEN: process.env.JUDGE0_AUTHZ_TOKEN, // Local AuthZ Token (X-Auth-User)

  // AI Configuration
  INTERVIEWER_PERSONA: process.env.INTERVIEWER_PERSONA || "You are an expert technical interviewer.",

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Session
  SESSION_SECRET: process.env.SESSION_SECRET || 'interview-secret-key-change-in-production'
};