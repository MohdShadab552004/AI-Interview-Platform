
require('dotenv').config();
const aiService = require('./services/aiService');
const fs = require('fs');
const path = require('path');

async function testTranscription() {
    console.log("🧪 Testing Audio Transcription (Hugging Face / Whisper)...");

    const filename = 'audio_b0b6a278-f6f4-4f5e-bd01-8c25ac7fba55_0_1770797508974.webm';
    const filePath = path.join(__dirname, 'uploads', filename);

    if (!fs.existsSync(filePath)) {
        console.error("❌ Test file not found:", filePath);
        return;
    }

    console.log(`📂 Reading file: ${filename}`);
    const audioBuffer = fs.readFileSync(filePath);
    console.log(`📊 Size: ${audioBuffer.length} bytes`);

    try {
        console.log("⏳ Sending to AI Service...");
        const result = await aiService.transcribeAudio(audioBuffer, 'audio/webm;codecs=opus');

        console.log("\n✅ Transcription Result:");
        console.log(JSON.stringify(result, null, 2));

        if (result && result.text && result.text !== "Transcription failed") {
            console.log("\n🎉 Success! Transcription works.");
        } else {
            console.log("\n⚠️ Transcription returned failure message.");
        }

    } catch (error) {
        console.error("\n❌ Error during test:", error);
    }
}

testTranscription();
