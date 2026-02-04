"""
IAIS - Simplified Demo (Without Gaze/Stress Modules)
Demonstrates OpenRouter integration with CCAQE and MMFDF modules
"""

import os
from datetime import datetime
from env_loader import get_openrouter_key
from ccaqe_module import CCAQEEngine
from mmfdf_module import MMFDFEngine
from network_monitor import NetworkMonitor

def demo_adaptive_questioning():
    """Demo the adaptive questioning system with OpenRouter"""
    print("\n" + "=" * 70)
    print("IAIS - Adaptive Questioning Demo (OpenRouter)")
    print("=" * 70)
    
    # Load API key
    print("\n[1/4] Loading OpenRouter API key...")
    api_key = get_openrouter_key()
    
    if not api_key:
        print("❌ Failed to load API key from backend/.env")
        return
    
    # Initialize modules
    print("\n[2/4] Initializing IAIS modules...")
    ccaqe = CCAQEEngine(openrouter_api_key=api_key)
    mmfdf = MMFDFEngine()
    network = NetworkMonitor(monitoring_enabled=False)
    
    print("✓ CCAQE (Adaptive Questioning) initialized")
    print("✓ MMFDF (Multi-Modal Fusion) initialized")
    print("✓ Network Monitor initialized")
    
    # Sample resume
    print("\n[3/4] Preparing sample interview...")
    sample_resume = {
        "name": "Alex Johnson",
        "email": "alex.johnson@example.com",
        "education": [
            {
                "degree": "B.Tech in Computer Science",
                "institution": "Stanford University",
                "year": "2021"
            }
        ],
        "skills": [
            "Python", "JavaScript", "React", "Node.js",
            "Machine Learning", "TensorFlow", "AWS"
        ],
        "experience": [
            {
                "company": "Tech Innovations Inc",
                "role": "Full Stack Developer",
                "duration": "2021-2024",
                "responsibilities": "Built scalable web applications using React and Node.js, implemented ML models for user recommendations"
            }
        ],
        "projects": [
            {
                "name": "AI-Powered Chatbot",
                "technologies": ["Python", "NLP", "TensorFlow"],
                "description": "Developed a conversational AI chatbot using transformer models"
            },
            {
                "name": "E-Commerce Platform",
                "technologies": ["React", "Node.js", "MongoDB"],
                "description": "Built a full-stack e-commerce platform with payment integration"
            }
        ]
    }
    
    job_description = """
    Senior Full Stack Developer Position
    
    We are looking for an experienced Full Stack Developer with:
    - 3+ years of experience with React and Node.js
    - Strong knowledge of Python and Machine Learning
    - Experience with cloud platforms (AWS/GCP)
    - Excellent problem-solving and communication skills
    - Experience building scalable web applications
    """
    
    # Generate questions
    print("\n[4/4] Generating interview questions using OpenRouter AI...")
    print("(This may take a few seconds...)")
    
    try:
        questions = ccaqe.generate_questions(
            resume_data=sample_resume,
            job_description=job_description,
            num_questions=5
        )
        
        if not questions:
            print("❌ No questions generated")
            return
        
        print(f"\n✓ Successfully generated {len(questions)} questions!")
        
        # Display questions
        print("\n" + "=" * 70)
        print("GENERATED INTERVIEW QUESTIONS")
        print("=" * 70)
        
        for i, q in enumerate(questions, 1):
            print(f"\n{'─' * 70}")
            print(f"Question {i} of {len(questions)}")
            print(f"{'─' * 70}")
            print(f"Type: {q.type.value.upper()}")
            print(f"Difficulty: {q.difficulty.name}")
            print(f"Context: {q.context}")
            print(f"\n{q.question_text}")
            
            if q.expected_keywords:
                print(f"\nExpected Keywords: {', '.join(q.expected_keywords[:5])}")
        
        # Simulate interview with adaptive difficulty
        print("\n" + "=" * 70)
        print("SIMULATING ADAPTIVE INTERVIEW")
        print("=" * 70)
        
        sample_responses = [
            "I have extensive experience with React and Node.js. I've built several full-stack applications using these technologies, including an e-commerce platform with real-time features.",
            "In my previous role, I implemented machine learning models for user recommendations using TensorFlow and Python. The models improved user engagement by 30%.",
            "I'm familiar with the basics of AWS, but I haven't worked extensively with cloud deployment.",
        ]
        
        for i in range(min(3, len(questions))):
            question = ccaqe.select_next_question()
            if not question:
                break
            
            print(f"\n{'─' * 70}")
            print(f"Interview Question {i+1}")
            print(f"{'─' * 70}")
            print(f"Difficulty: {question.difficulty.name}")
            print(f"Q: {question.question_text}")
            
            # Simulate response
            response_text = sample_responses[i % len(sample_responses)]
            print(f"\nCandidate Response: {response_text}")
            
            # Evaluate
            print("\nEvaluating response...")
            evaluation = ccaqe.evaluate_response(question, response_text, response_time=45.0)
            
            print(f"✓ Correctness Score: {evaluation.correctness_score:.2f}")
            print(f"  Keyword Match: {evaluation.keyword_match_score:.2f}")
            print(f"  Confidence: {evaluation.confidence_score:.2f}")
            
            # Simulate fusion scoring
            fusion_result = mmfdf.fuse_scores(
                gaze_score=0.2,  # Simulated
                timing_score=0.3 if evaluation.response_time < 60 else 0.5,
                network_score=network.get_network_score(),
                audio_score=0.15  # Simulated
            )
            
            print(f"\n  Multi-Modal Fusion Score: {fusion_result.final_score:.2f}")
            print(f"  Alert Level: {fusion_result.alert_level.upper()}")
            
            if fusion_result.is_suspicious:
                print(f"  ⚠️ {mmfdf.generate_alert_message(fusion_result)}")
        
        # Show performance summary
        print("\n" + "=" * 70)
        print("INTERVIEW PERFORMANCE SUMMARY")
        print("=" * 70)
        
        summary = ccaqe.get_performance_summary()
        print(f"\nTotal Questions Asked: {summary['total_questions']}")
        print(f"Average Score: {summary['average_score']:.2f}")
        print(f"Ability Estimate: {summary['ability_estimate']:.2f}")
        print(f"Current Difficulty: {summary['current_difficulty']}")
        
        mmfdf_stats = mmfdf.get_statistics()
        print(f"\nTotal Fusion Analyses: {mmfdf_stats['total_analyses']}")
        print(f"Average Fusion Score: {mmfdf_stats['average_score']:.2f}")
        print(f"Total Alerts: {mmfdf_stats['total_alerts']}")
        
        print("\n" + "=" * 70)
        print("✅ DEMO COMPLETE!")
        print("=" * 70)
        print("\nThe IAIS system successfully:")
        print("  ✓ Loaded OpenRouter API key from backend/.env")
        print("  ✓ Generated adaptive interview questions using AI")
        print("  ✓ Evaluated candidate responses")
        print("  ✓ Adjusted difficulty based on performance (IRT)")
        print("  ✓ Calculated multi-modal fusion scores")
        print("  ✓ Generated comprehensive performance report")
        
        print("\n📝 Next Steps:")
        print("  1. Fix MediaPipe for gaze tracking: pip install protobuf==3.20.3")
        print("  2. Run full system with webcam: python iais_main.py")
        print("  3. Integrate with your React frontend")
        print("  4. Create REST API wrapper for production use")
        
    except Exception as e:
        print(f"\n❌ Error during demo: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    demo_adaptive_questioning()
