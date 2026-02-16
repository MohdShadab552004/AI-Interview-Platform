const aiService = require('./backend/services/aiService');

async function testGeneration() {
    console.log("--- Testing Technical Generation ---");
    const techQuestions = await aiService.generateCVJDQuestions(
        "React Developer",
        ["React", "JavaScript", "Node.js"],
        ["Building scalable web apps", "Unit testing"],
        "Lead technical development",
        true,
        5
    );
    console.log(JSON.stringify(techQuestions, null, 2));

    console.log("\n--- Testing Non-Technical Generation ---");
    const nonTechQuestions = await aiService.generateCVJDQuestions(
        "HR Manager",
        ["Hiring", "Conflict Resolution"],
        ["Manage employee relations", "Strategic hiring"],
        "Lead HR operations",
        false,
        5
    );
    console.log(JSON.stringify(nonTechQuestions, null, 2));
}

testGeneration();
