const aiService = require('./backend/services/aiService');
const dotenv = require('dotenv');
const path = require('path');

// Load .env explicitly to ensure we have the new persona
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function verifyPersona() {
    console.log("Starting Persona Verification Test...");

    const position = "Full Stack Developer";
    const cvSkills = {
        skills: ["React", "Node.js", "MongoDB", "Tailwind CSS"],
        experience: [{ role: "Frontend Developer", company: "TechCorp", duration: "2 years" }],
        projects: [{ name: "E-commerce App", technologies: ["React", "Redux"] }]
    };
    const jdRequirements = {
        requirements: ["Experience with MERN stack", "Microservices architecture"],
        responsibilities: ["Develop and maintain web applications", "Optimize performance"],
        preferred: ["Knowledge of AWS"]
    };
    const count = 3;

    console.log(`\n--- Testing CV/JD question generation for ${position} ---`);
    try {
        const questions = await aiService.generateCVJDQuestions(position, cvSkills, jdRequirements, count);
        console.log("Generated Questions:");
        console.log(JSON.stringify(questions, null, 2));

        console.log("\n--- Checking Prompt Log (if available) ---");
        // We can't easily see the internal prompt without adding logging or checking ai_debug.log
        // But the tone of questions should give a hint.
    } catch (error) {
        console.error("Test failed:", error);
    }
}

verifyPersona();
