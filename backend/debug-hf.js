require('dotenv').config();
const fs = require('fs');
const { HfInference } = require('@huggingface/inference');

const logFile = 'debug_hf.log';

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(logFile, line);
}

async function test() {
    try {
        log("Starting debug script...");
        const token = process.env.HUGGINGFACE_API_KEY;
        log(`Token present: ${!!token}`);
        if (token) log(`Token length: ${token.length}`);
        log(`Provider: ${process.env.AI_PROVIDER}`);

        if (!token) {
            log("ERROR: No token found in .env");
            return;
        }

        const hf = new HfInference(token);
        const model = 'mistralai/Mistral-7B-Instruct-v0.2';

        log(`Testing HF connection to ${model}...`);

        // Explicitly using router endpoint if possible, but HfInference v3+ does it automatically.
        // We are on @huggingface/inference@2.x or 3.x?
        // User upgraded to latest.

        const result = await hf.chatCompletion({
            model: model,
            messages: [
                { role: 'user', content: "Hello, this is a test." }
            ],
            max_tokens: 10
        });

        log("Response received!");
        log(JSON.stringify(result));

    } catch (error) {
        log("ERROR CAUGHT:");
        log(error.message);
        if (error.cause) log(JSON.stringify(error.cause));
    }
}

test();
