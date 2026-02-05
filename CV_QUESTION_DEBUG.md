# 🔍 Interview System - CV Question Generation Debug Guide

## ✅ How CV Questions Are Generated

### Backend Flow (Working Correctly):

1. **Interview Creation** (`interviewService.js` line 33-48):
   ```javascript
   if (cvBuffer) {
     const cvText = await aiService.extractTextFromPDF(cvBuffer);
     questions = await aiService.generateFullInterview(cvText, 25);
   }
   ```

2. **AI Service** (`aiService.js` line 252-301):
   - Extracts text from PDF using `pdf-parse`
   - Sends CV text to OpenRouter AI (Google Gemini 2.0 Flash)
   - Generates 25 questions in 3 rounds:
     - **Round 1 (10 Q)**: CV Analysis & Theory
     - **Round 2 (10 Q)**: Technical Coding & Problem Solving
     - **Round 3 (5 Q)**: Behavioral & General Knowledge

3. **Question Format**:
   ```javascript
   {
     round: 1,
     question: "Tell me about your project X...",
     type: "cv-analysis",
     expectedTime: 120,
     difficulty: "medium"
   }
   ```

---

## 🎯 Current System Status

### ✅ What's Working:
1. CV upload and PDF parsing
2. AI question generation (25 questions)
3. Question storage in Redis/Memory
4. Interview session creation
5. Frontend question navigation (1-25)
6. Timer (1 hour for all questions)
7. Notepad/Code editor toggle
8. No confirmation dialogs

### 🔧 What to Check:

#### 1. **Browser Console**
Open browser DevTools (F12) and check for:
- `📋 Interview loaded:` - Shows full interview object
- `📝 Total questions:` - Should show 25
- `🎯 First question:` - Shows question text

#### 2. **Backend Logs**
Check terminal for:
- `✅ Connected to Redis`
- OpenRouter API responses
- Question generation logs

#### 3. **Common Issues & Solutions**:

**Issue**: Questions not changing
- **Cause**: Frontend state not updating
- **Solution**: Click different question numbers in navigator
- **Check**: Console shows question index changing

**Issue**: Same question appearing
- **Cause**: Backend not generating unique questions
- **Solution**: Check OpenRouter API key in `.env`
- **Check**: Backend logs show "OpenRouter raw response"

**Issue**: CV not being analyzed
- **Cause**: PDF parsing failed
- **Solution**: Check CV file format (must be PDF)
- **Check**: Backend logs show "Extracting text from PDF"

---

## 🧪 Testing Steps

### 1. Start Fresh Interview:
```
1. Upload CV (PDF format)
2. Fill candidate details
3. Click "Start Interview"
4. Open browser console (F12)
5. Check logs for question count
```

### 2. Verify Questions:
```
1. Look at question navigator (25 blocks)
2. Click different numbers
3. Verify question text changes
4. Check question types vary
```

### 3. Test Navigation:
```
1. Click question #1 → Should show Round 1 question
2. Click question #15 → Should show Round 2 question
3. Click question #23 → Should show Round 3 question
```

---

## 📝 Environment Variables Required

### Backend `.env`:
```
OPENROUTER_API_KEY=sk-or-v1-xxxxx
REDIS_URL=redis://localhost:6379
PYTHON_SERVICE_URL=http://localhost:8000
```

### Frontend `.env`:
```
VITE_APP_API_URL=http://localhost:5000/api
```

---

## 🐛 Debugging Commands

### Check Interview Data:
```javascript
// In browser console
console.log(interview);
console.log(interview.questions);
console.log(currentQuestionIndex);
```

### Check Backend:
```bash
# In backend terminal
# Look for these logs:
- "CV-based flow - NEW Full 25-Question Structure"
- "OpenRouter raw response"
- "Successfully parsed questions"
```

---

## 🎨 UI Features Implemented

1. **Left Panel**:
   - Camera feed with proctoring
   - Metrics (Attention, Eye Contact, Stress, Network)
   - Question navigator (25 clickable blocks)
     - Gray = Not attempted
     - Green = Attempted
     - Blue = Current

2. **Right Panel**:
   - Question display with type/difficulty
   - Notepad/Code editor toggle
   - Language selector (JS/Python/Java)
   - Submit/Skip/End buttons

3. **Timer**:
   - 1 hour (3600 seconds) for all 25 questions
   - Countdown display in header
   - Auto-ends when time expires

---

## 🚀 Next Steps

1. **Open browser console** and check logs
2. **Navigate between questions** using the 25 blocks
3. **Verify each question is different**
4. **Check backend terminal** for AI generation logs

If questions are still not changing, share:
- Browser console screenshot
- Backend terminal logs
- Network tab showing API responses
