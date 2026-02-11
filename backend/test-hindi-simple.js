require('dotenv').config();
const aiService = require('./services/aiService');

async function testSimpleHindi() {
    console.log("🧪 Testing Basic Hindi Connectivity...");

    const prompt = "Translate 'Hello, how are you?' to Hindi.";

    try {
        console.log(`\n📤 Sending prompt: "${prompt}"`);
        const response = await aiService.callAI(prompt);
        console.log(`\n📥 AI Response: "${response}"`);
    } catch (error) {
        console.error("\n❌ Error during test:", error);
    }
}

testSimpleHindi();
