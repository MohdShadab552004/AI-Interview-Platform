"""
Quick test script to verify OpenRouter API integration
"""

from env_loader import get_openrouter_key
from ccaqe_module import CCAQEEngine

def test_openrouter():
    """Test OpenRouter API with CCAQE module"""
    print("=" * 70)
    print("Testing OpenRouter API Integration")
    print("=" * 70)
    
    # Load API key
    print("\n[1/3] Loading OpenRouter API key...")
    api_key = get_openrouter_key()
    
    if not api_key:
        print("❌ Failed to load API key")
        return False
    
    # Initialize CCAQE engine
    print("\n[2/3] Initializing CCAQE Engine with OpenRouter...")
    try:
        engine = CCAQEEngine(
            openrouter_api_key=api_key,
            model="meta-llama/llama-3.2-3b-instruct:free"  # Use free Llama model
        )
        print("✓ Engine initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize: {e}")
        return False
    
    # Test question generation
    print("\n[3/3] Testing question generation...")
    
    test_resume = {
        "name": "Test Candidate",
        "email": "test@example.com",
        "skills": ["Python", "Machine Learning", "React", "Node.js"],
        "experience": [
            {
                "company": "Tech Corp",
                "role": "Full Stack Developer",
                "duration": "2020-2023",
                "responsibilities": "Built web applications using React and Node.js"
            }
        ],
        "projects": [
            {
                "name": "AI Chatbot",
                "technologies": ["Python", "NLP"],
                "description": "Built a conversational AI"
            }
        ]
    }
    
    job_description = """
    We are looking for a Full Stack Developer with:
    - 2+ years experience in React and Node.js
    - Knowledge of Python and ML is a plus
    - Good problem-solving skills
    """
    
    try:
        questions = engine.generate_questions(
            resume_data=test_resume,
            job_description=job_description,
            num_questions=3
        )
        
        if questions:
            print(f"\n✓ Successfully generated {len(questions)} questions!")
            print("\n" + "=" * 70)
            print("Generated Questions:")
            print("=" * 70)
            
            for i, q in enumerate(questions, 1):
                print(f"\n[Question {i}]")
                print(f"Type: {q.type.value.upper()}")
                print(f"Difficulty: {q.difficulty.name}")
                print(f"Question: {q.question_text}")
                print(f"Context: {q.context}")
                print("-" * 70)
            
            print("\n" + "=" * 70)
            print("✅ OpenRouter API Integration Test PASSED!")
            print("=" * 70)
            return True
        else:
            print("❌ No questions generated")
            return False
            
    except Exception as e:
        print(f"❌ Error generating questions: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_openrouter()
    
    if success:
        print("\n🎉 Your IAIS system is ready to use with OpenRouter!")
        print("\nNext steps:")
        print("  1. Run individual modules: python grcda_module.py")
        print("  2. Run full system: python iais_main.py")
        print("  3. Check SETUP_COMPLETE.md for more information")
    else:
        print("\n⚠️ Test failed. Please check the error messages above.")
        print("Make sure your OpenRouter API key is valid.")
