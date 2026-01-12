# Video Analysis Explanation

This document explains how the interview system analyzes user video and behavior during the session.

## Data Flow
1. **Frontend Capturing**: The browser uses **MediaPipe FaceMesh** to track 468 3D face landmarks in real-time from the webcam feed.
2. **Local Processing**: Instead of sending heavy video files, the `MediaAnalyzer` component calculates lightweight metrics locally every frame.
3. **Backend Submission**: When you finish an answer, these aggregated metrics are sent to the backend as a JSON object.
4. **AI Evaluation**: The backend combines these metrics with your transcript and voice analysis to give a comprehensive score via Gemini AI.

## Factors Analyzed (Frontend)

| Factor | Description | Logic |
|--------|-------------|-------|
| **Attention** | Measures if the user is looking at the screen. | Calculated based on the deviation of the face center from the screen center. |
| **Eye Contact** | Estimates engagement. | Derived from the attention score; high attention consistently equals good eye contact. |
| **Confidence** | Measures composure. | Analyzed via head tilt and nose tip stability relative to the face center. |
| **Face Detection** | Reliability check. | Ensures a face is actually visible in the frame throughout the response. |

## Future Enhancements (Backend)
The backend `analyzeVideo` currently uses the transcript and the metadata metrics to provide a qualitative analysis. Since we are moving to background processing, we could eventually allow episodic frame analysis for even deeper insights (e.g., micro-expressions).
