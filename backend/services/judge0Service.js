const axios = require('axios');
const env = require('../config/env');
const { getLanguageById } = require('../../frontend/src/utils/languageConstants');
// Note: We can't strictly import from frontend in backend universally if they are separate builds, 
// but if they share the repo structure it might work if Node resolves it. 
// Safest is to duplicate or move constants to a shared folder.
// For now, I'll rely on the language ID passed from frontend.

class Judge0Service {
    constructor() {
        this.apiUrl = env.JUDGE0_API_URL;
        this.apiKey = env.JUDGE0_API_KEY; // RapidAPI
        this.apiHost = env.JUDGE0_API_HOST; // RapidAPI
        this.authnToken = env.JUDGE0_AUTHN_TOKEN; // Local
        this.authzToken = env.JUDGE0_AUTHZ_TOKEN; // Local
    }

    async executeCode(sourceCode, languageId, stdin = "") {
        console.log(`[Judge0] Executing code (Lang ID: ${languageId})...`);

        const headers = {
            'Content-Type': 'application/json'
        };

        // RapidAPI Headers
        if (this.apiKey) headers['X-RapidAPI-Key'] = this.apiKey;
        if (this.apiHost) headers['X-RapidAPI-Host'] = this.apiHost;

        // Local Auth Headers
        // Note: These header names (X-Auth-Token, X-Auth-User) are examples and can be adjusted
        // based on the actual authentication mechanism of your Judge0 instance.
        if (this.authnToken) headers['X-Auth-Token'] = this.authnToken;
        if (this.authzToken) headers['X-Auth-User'] = this.authzToken;

        const options = {
            method: 'POST',
            url: `${this.apiUrl}/submissions`,
            params: { base64_encoded: 'false', wait: 'true' }, // Wait for result
            headers: headers,
            data: {
                source_code: sourceCode,
                language_id: languageId,
                stdin: stdin
            }
        };

        try {
            const response = await axios.request(options);
            console.log('[Judge0] Execution result:', response.data);
            return response.data;
        } catch (error) {
            console.error('[Judge0] Execution failed:', error.message);
            if (error.response) {
                console.error('[Judge0] Response data:', error.response.data);
            }
            return {
                error: "Execution failed",
                details: error.message
            };
        }
    }
}

module.exports = new Judge0Service();
