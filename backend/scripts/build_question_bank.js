#!/usr/bin/env node
/**
 * Build Question Bank
 * 
 * Reads all data files and consolidates them into a role-mapped question bank.
 * Output: backend/config/role_question_bank.json
 * 
 * Data Sources:
 * 1. Mock_interview_questions.json (5000 questions, 14 academic fields)
 * 2. full_interview_questions_dataset.csv (660 rows, SW Engineer + HR)
 * 3. Software Questions.csv (200 CS Q&A with answers)
 * 4. intents.json (172 CS concept Q&A pairs)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

// ─── Field-to-Role Mapping ───────────────────────────────────────────────────
// Maps academic fields from Mock_interview_questions.json to job roles
const FIELD_TO_ROLES = {
    'Computer Science': [
        'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
        'Data Scientist', 'DevOps Engineer', 'Cybersecurity Analyst'
    ],
    'Mathematics': [
        'Data Scientist', 'Financial Analyst', 'Accountant'
    ],
    'Economics': [
        'Financial Analyst', 'Accountant', 'Relationship Manager', 'Sales Executive'
    ],
    'Psychology': [
        'HR Executive', 'Talent Acquisition Specialist', 'School Teacher', 'Professor'
    ],
    'Sociology': [
        'HR Executive', 'Talent Acquisition Specialist', 'Content Writer'
    ],
    'Political Science': [
        'Corporate Lawyer', 'HR Executive'
    ],
    'Philosophy': [
        'Professor', 'School Teacher', 'Content Writer', 'Corporate Lawyer'
    ],
    'Literature': [
        'Content Writer', 'School Teacher', 'Professor'
    ],
    'Linguistics': [
        'Content Writer', 'School Teacher', 'Professor'
    ],
    'Environmental Science': [
        'Agricultural Officer', 'Civil Engineer', 'Mechanical Engineer'
    ],
    'Cultural Studies': [
        'Hotel Manager', 'Digital Marketing Executive', 'Store Manager'
    ],
    'Religious Studies': [
        'School Teacher', 'Professor'
    ],
    'History': [
        'School Teacher', 'Professor', 'Content Writer'
    ],
    'Art Criticism': [
        'Graphic Designer', 'Content Writer'
    ]
};

// Tier to difficulty mapping
const TIER_TO_DIFFICULTY = {
    'beginner': 'easy',
    'intermediate': 'medium',
    'advanced': 'hard'
};

// ─── CSV Parser (Simple) ─────────────────────────────────────────────────────
function parseCSV(content, delimiter = ',') {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    // Parse header
    const headers = parseCSVLine(lines[0], delimiter);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter);
        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((h, idx) => {
                row[h.trim()] = (values[idx] || '').trim();
            });
            rows.push(row);
        }
    }
    return rows;
}

function parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// ─── Initialize Bank Structure ───────────────────────────────────────────────
function initializeBank() {
    const jobProfilesPath = path.join(CONFIG_DIR, 'job_profiles.json');
    const jobProfiles = JSON.parse(fs.readFileSync(jobProfilesPath, 'utf8'));

    const bank = {};
    for (const profile of jobProfiles.job_profiles) {
        bank[profile.role] = {
            industry: profile.industry,
            category: profile.category,
            technical: [],
            behavioral: [],
            'case-study': [],
            situational: [],
            general_knowledge: []
        };
    }
    return bank;
}

// ─── Source 1: Mock Interview Questions JSON ─────────────────────────────────
function processMockQuestions(bank) {
    console.log('\n📚 Processing Mock_interview_questions.json...');
    const filePath = path.join(ROOT, 'Mock_interview_questions.json');

    if (!fs.existsSync(filePath)) {
        console.warn('  ⚠️ File not found, skipping.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const questions = data.questions || [];
    let mapped = 0;

    for (const q of questions) {
        const field = q.field;
        const roles = FIELD_TO_ROLES[field];
        if (!roles) continue;

        const questionObj = {
            question: q.question,
            difficulty: TIER_TO_DIFFICULTY[q.tier] || 'medium',
            type: 'technical',
            category: q.category || field,
            answer: q.answer ? q.answer.substring(0, 500) : null,
            source: 'mock_interview_questions'
        };

        // For CS field, mark as technical; for others, mark as general_knowledge
        const bucket = field === 'Computer Science' ? 'technical' : 'general_knowledge';

        for (const role of roles) {
            if (bank[role]) {
                bank[role][bucket].push(questionObj);
                mapped++;
            }
        }
    }

    console.log(`  ✅ Mapped ${mapped} question-role assignments from ${questions.length} questions`);
}

// ─── Source 2: Full Interview Questions Dataset CSV ──────────────────────────
function processFullDatasetCSV(bank) {
    console.log('\n📚 Processing full_interview_questions_dataset.csv...');
    const filePath = path.join(ROOT, 'full_interview_questions_dataset.csv');

    if (!fs.existsSync(filePath)) {
        console.warn('  ⚠️ File not found, skipping.');
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSV(content);
    let mapped = 0;

    for (const row of rows) {
        const question = row.question || row.Question;
        const role = row.role || row.Role;
        const category = (row.category || row.Category || '').toLowerCase();
        const difficulty = (row.difficulty || row.Difficulty || 'medium').toLowerCase();

        if (!question) continue;

        const questionObj = {
            question: question,
            difficulty: difficulty,
            type: category === 'behavioral' ? 'behavioral' : 'technical',
            source: 'full_interview_dataset'
        };

        // Map Software Engineer questions to all IT roles
        if (role === 'Software Engineer' && category === 'Technical') {
            const techRoles = ['Frontend Developer', 'Backend Developer', 'Full Stack Developer',
                'Data Scientist', 'DevOps Engineer', 'Cybersecurity Analyst'];
            for (const r of techRoles) {
                if (bank[r]) {
                    bank[r].technical.push(questionObj);
                    mapped++;
                }
            }
        } else if (role === 'HR' || category === 'Behavioral') {
            // Map HR/behavioral to ALL roles
            for (const r of Object.keys(bank)) {
                bank[r].behavioral.push({ ...questionObj, type: 'behavioral' });
                mapped++;
            }
        }
    }

    console.log(`  ✅ Mapped ${mapped} question-role assignments from ${rows.length} rows`);
}

// ─── Source 3: Software Questions CSV ────────────────────────────────────────
function processSoftwareQuestionsCSV(bank) {
    console.log('\n📚 Processing Software Questions.csv...');
    const filePath = path.join(ROOT, 'Software Questions.csv');

    if (!fs.existsSync(filePath)) {
        console.warn('  ⚠️ File not found, skipping.');
        return;
    }

    // Read with latin-1 fallback
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        content = fs.readFileSync(filePath, 'latin1');
    }

    const rows = parseCSV(content);
    let mapped = 0;

    const techRoles = ['Frontend Developer', 'Backend Developer', 'Full Stack Developer',
        'Data Scientist', 'DevOps Engineer', 'Cybersecurity Analyst'];

    for (const row of rows) {
        const question = row.Question || row.question;
        const answer = row.Answer || row.answer;
        const category = row.Category || row.category || 'General';
        const difficulty = (row.Difficulty || row.difficulty || 'medium').toLowerCase().trim();

        if (!question) continue;

        const questionObj = {
            question: question,
            answer: answer ? answer.substring(0, 500) : null,
            difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
            type: 'technical',
            category: category,
            source: 'software_questions_csv'
        };

        for (const r of techRoles) {
            if (bank[r]) {
                bank[r].technical.push(questionObj);
                mapped++;
            }
        }
    }

    console.log(`  ✅ Mapped ${mapped} question-role assignments from ${rows.length} rows`);
}

// ─── Source 4: Intents JSON ──────────────────────────────────────────────────
function processIntentsJSON(bank) {
    console.log('\n📚 Processing intents.json...');
    const filePath = path.join(ROOT, 'intents.json');

    if (!fs.existsSync(filePath)) {
        console.warn('  ⚠️ File not found, skipping.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const intents = data.intents || [];
    let mapped = 0;

    const techRoles = ['Frontend Developer', 'Backend Developer', 'Full Stack Developer',
        'Data Scientist', 'DevOps Engineer', 'Cybersecurity Analyst'];

    for (const intent of intents) {
        const tag = intent.tag;
        const patterns = intent.patterns || [];
        const responses = intent.responses || [];

        // Each pattern is a way to ask the question; pick the first as canonical
        const question = patterns[0];
        const answer = responses[0] ? responses[0].substring(0, 500) : null;

        if (!question) continue;

        const questionObj = {
            question: question,
            answer: answer,
            difficulty: 'medium',
            type: 'technical',
            tag: tag,
            alternateQuestions: patterns.slice(1),
            source: 'intents_json'
        };

        for (const r of techRoles) {
            if (bank[r]) {
                bank[r].technical.push(questionObj);
                mapped++;
            }
        }
    }

    console.log(`  ✅ Mapped ${mapped} question-role assignments from ${intents.length} intents`);
}

// ─── Deduplicate & Limit ─────────────────────────────────────────────────────
function deduplicateBank(bank) {
    console.log('\n🔧 Deduplicating and trimming question bank...');

    for (const role of Object.keys(bank)) {
        for (const type of ['technical', 'behavioral', 'case-study', 'situational', 'general_knowledge']) {
            if (!bank[role][type]) continue;

            const seen = new Set();
            const unique = [];

            for (const q of bank[role][type]) {
                // Normalize for dedup: lowercase first 80 chars
                const key = q.question.toLowerCase().substring(0, 80);
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(q);
                }
            }

            bank[role][type] = unique;
        }
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
    console.log('🏗️  Building Role-Mapped Question Bank');
    console.log('='.repeat(60));

    const bank = initializeBank();

    // Process all sources
    processMockQuestions(bank);
    processFullDatasetCSV(bank);
    processSoftwareQuestionsCSV(bank);
    processIntentsJSON(bank);

    // Deduplicate
    deduplicateBank(bank);

    // Print summary
    console.log('\n📊 Question Bank Summary:');
    console.log('-'.repeat(60));

    let totalQuestions = 0;
    for (const [role, data] of Object.entries(bank)) {
        const tech = data.technical.length;
        const behav = data.behavioral.length;
        const cs = data['case-study'].length;
        const sit = data.situational.length;
        const gk = data.general_knowledge.length;
        const total = tech + behav + cs + sit + gk;
        totalQuestions += total;

        if (total > 0) {
            console.log(`  ${role}: ${total} questions (tech:${tech}, behav:${behav}, gk:${gk})`);
        } else {
            console.log(`  ${role}: ⚠️  No questions (will rely on AI generation)`);
        }
    }

    console.log('-'.repeat(60));
    console.log(`  TOTAL: ${totalQuestions} question-role assignments`);

    // Write output
    const outputPath = path.join(CONFIG_DIR, 'role_question_bank.json');
    fs.writeFileSync(outputPath, JSON.stringify(bank, null, 2), 'utf8');
    console.log(`\n✅ Question bank saved to: ${outputPath}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
}

main();
