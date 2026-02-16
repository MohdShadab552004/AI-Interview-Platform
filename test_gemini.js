require('dotenv').config({ path: './backend/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    console.log("--- Starting Gemini Connectivity Test ---");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("ERROR: GEMINI_API_KEY is not defined in backend/.env");
        return;
    }

    console.log("API Key detected. Length:", apiKey.length);
    console.log("First 5 chars:", apiKey.substring(0, 5));

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        console.log("Attempting to call Gemini API...");
        const result = await model.generateContent("Respond with exactly the word 'OK'.");

        console.log("Request sent. Awaiting response...");
        const response = await result.response;
        const text = response.text();

        console.log("SUCCESS! Gemini responded:", text);
    } catch (error) {
        console.error("FAILED! Gemini Error:", error.message);
        if (error.stack) console.error("Stack Trace:", error.stack);
    }
}

testGemini();
