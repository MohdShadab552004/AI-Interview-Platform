const judge0Service = require('./services/judge0Service');

async function testJudge0() {
    console.log('Testing Judge0 execution...');
    const sourceCode = 'console.log("Hello from Judge0!");';
    const languageId = 63; // JavaScript

    try {
        const result = await judge0Service.executeCode(sourceCode, languageId);
        console.log('Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testJudge0();
