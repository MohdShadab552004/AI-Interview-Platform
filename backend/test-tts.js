require('dotenv').config();
const aiService = require('./services/aiService');
const fs = require('fs');

async function testTTS() {
    console.log("--- Testing AI Service TTS ---");
    console.log("Provider:", process.env.AI_PROVIDER);
    console.log("HF Key:", process.env.HUGGINGFACE_API_KEY ? "Present" : "Missing");

    const testText = "Hello, this is a test of the audio system.";

    try {
        console.log(`Generating audio for text: "${testText}"...`);
        const audioBase64 = await aiService.getAudioForText(testText);

        if (audioBase64) {
            console.log("--- AUDIO GENERATION SUCCESS ---");
            console.log("Audio data length:", audioBase64.length);

            // Save to file to verify it's a valid audio file
            const buffer = Buffer.from(audioBase64, 'base64');
            fs.writeFileSync('test_output.wav', buffer);
            console.log("Saved audio to test_output.wav");
        } else {
            console.error("--- AUDIO GENERATION FAILED (Returned null) ---");
        }
    } catch (error) {
        console.error("--- AUDIO GENERATION ERROR ---");
        console.error(error);
    }
}

testTTS();
