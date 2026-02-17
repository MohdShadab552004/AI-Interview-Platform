const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const aiService = require('./services/aiService');

async function verifyPersona() {
    console.log("Starting Persona Verification Test...");

    // Log the current persona to verify it was loaded correctly
    console.log("Current Persona:", aiService.persona);

    const position = "Full Stack Developer";
    const cvSkills = {
        skills: ["React", "Node.js", "MongoDB"],
        experience: [{ role: "Frontend Developer", company: "TechCorp", duration: "2 years" }],
        projects: [{ name: "E-commerce App", technologies: ["React", "Redux"] }]
    };
    const jdRequirements = {
        requirements: ["Experience with MERN stack", "Microservices architecture"],
        responsibilities: ["Develop and maintain web applications"],
        preferred: ["Knowledge of AWS"]
    };
    const count = 2;

    console.log(`\n--- Testing CV/JD question generation for ${position} ---`);
    try {
        const questions = await aiService.generateCVJDQuestions(position, cvSkills, jdRequirements, count);
        console.log("Generated Questions:");
        console.log(JSON.stringify(questions, null, 2));
    } catch (error) {
        console.error("Test failed:", error);
    }
}

verifyPersona();
