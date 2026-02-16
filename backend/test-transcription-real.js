
require('dotenv').config();
const aiService = require('./services/aiService');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testRealTranscription() {
    console.log("🧪 Testing Real Audio Transcription (Python Service Integration)...");

    // We need a real audio file. 
    // If one exists in uploads, use it. Otherwise, we might fail or need to generate one.
    const uploadsDir = path.join(__dirname, 'uploads');

    // Check for any webm or wav file
    let testFile = null;
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        testFile = files.find(f => f.endsWith('.webm') || f.endsWith('.wav'));
    }

    if (!testFile) {
        console.error("❌ No test audio file found in uploads/. Please record an answer in the UI first or provide a file.");
        // Try creating a dummy file if needed, but real audio is better.
        // For now, let's assume the user has some history or we can pick one if we knew the path.
        // Let's list uploads to see if we can pick one.
        if (fs.existsSync(uploadsDir)) {
            console.log("Files in uploads:", fs.readdirSync(uploadsDir));
        }
        return;
    }

    const filePath = path.join(uploadsDir, testFile);
    console.log(`📂 Using test file: ${testFile}`);

    const audioBuffer = fs.readFileSync(filePath);
    const mimeType = testFile.endsWith('.webm') ? 'audio/webm' : 'audio/wav';

    try {
        console.log("⏳ Calling aiService.transcribeAudio...");
        const result = await aiService.transcribeAudio(audioBuffer, mimeType, { duration: 5 });

        console.log("\n✅ Transcription Result:");
        console.log(JSON.stringify(result, null, 2));

        if (result.provider === 'python-whisper-local') {
            console.log("🎉 SUCCESS: Verified using Python Whisper Service!");
        } else if (result.text) {
            console.log(`⚠️ Success but provider is ${result.provider || 'unknown'}`);
        } else {
            console.error("❌ Transcription returned empty text.");
        }

    } catch (error) {
        console.error("\n❌ Error during test:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
}

testRealTranscription();
