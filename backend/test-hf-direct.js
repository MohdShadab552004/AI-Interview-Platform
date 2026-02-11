require('dotenv').config();
const { HfInference } = require('@huggingface/inference');

async function testDirect() {
    console.log("Starting direct HF test...");
    const token = process.env.HUGGINGFACE_API_KEY;
    console.log("Token present:", !!token);

    if (!token) {
        console.error("No token found!");
        return;
    }

    const hf = new HfInference(token);

    try {
        console.log("Sending request to gpt2 (small model)...");
        const result = await hf.textGeneration({
            model: 'gpt2',
            inputs: 'The verified answer is',
            parameters: { max_new_tokens: 10 }
        });
        console.log("Success:", result);
    } catch (err) {
        console.error("Error:", err.message);
        if (err.cause) console.error("Cause:", err.cause);
    }
}

testDirect();
