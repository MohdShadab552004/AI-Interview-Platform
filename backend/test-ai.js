require('dotenv').config();
const aiService = require('./services/aiService');

async function test() {
    console.log("--- Testing AI Service ---");
    console.log("Provider:", process.env.AI_PROVIDER);
    console.log("HF Key:", process.env.HUGGINGFACE_API_KEY ? "Present" : "Missing");

    try {
        console.log("Sending prompt 'Hello, are you working?' to AI...");
        const response = await aiService.callAI("Hello, are you working?");
        console.log("--- AI RESPONSE SUCCESS ---");
        console.log(response);
    } catch (error) {
        console.error("--- AI RESPONSE FAILED ---");
        console.error(error);
    }
}

test();
