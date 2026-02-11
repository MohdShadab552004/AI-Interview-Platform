
require('dotenv').config();
const aiService = require('./services/aiService');

async function testHindi() {
    console.log("🧪 Testing Hindi Language Support...");

    const question = "Explain the concept of Object Oriented Programming.";
    const hindiAnswer = "OOPs ek programming paradigm hai jo 'objects' par based hai. Isme hum classes aur objects banate hain. Iske main pillars hain: Encapsulation, Inheritance, Polymorphism, aur Abstraction. Ye code ko reusable aur organized banata hai.";

    console.log(`\n❓ Question: ${question}`);
    console.log(`🗣️ Answer (Hindi/Hinglish): ${hindiAnswer}`);

    try {
        const evaluation = await aiService.evaluateAnswer({
            question: question,
            answer: hindiAnswer,
            voiceMetrics: { confidence: 0.9 }, // Mock metrics
            videoMetrics: { attention: 0.8 },
            hintUsed: false
        });

        console.log("\n🤖 AI Evaluation Result:");
        console.log(JSON.stringify(evaluation, null, 2));

        if (evaluation.overallScore > 0) {
            console.log("\n✅ Test Passed: AI understood the Hindi answer.");
        } else {
            console.log("\n❌ Test Failed: AI did not evaluate properly.");
        }

    } catch (error) {
        console.error("\n❌ Error during test:", error);
    }
}

testHindi();
