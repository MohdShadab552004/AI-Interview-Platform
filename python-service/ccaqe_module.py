"""
CCAQE Module: Context-Aware Adaptive Questioning Engine
Generates adaptive interview questions using OpenRouter API and IRT logic.

Based on research paper specifications:
- Parses PDF Resume
- Generates 3 types of questions: Verification, Technical, Behavioral
- Implements Item Response Theory (IRT) for adaptive difficulty
- Uses OpenRouter API for flexible model selection
"""

import os
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import PyPDF2
from openai import OpenAI
from datetime import datetime
import json


class QuestionType(Enum):
    """Types of interview questions"""
    VERIFICATION = "verification"  # Verify CV claims
    TECHNICAL = "technical"        # Deep technical knowledge
    BEHAVIORAL = "behavioral"      # Soft skills and scenarios


class DifficultyLevel(Enum):
    """Question difficulty levels (IRT)"""
    EASY = 1
    MEDIUM = 2
    HARD = 3
    EXPERT = 4


@dataclass
class Question:
    """Represents a single interview question"""
    id: str
    type: QuestionType
    difficulty: DifficultyLevel
    question_text: str
    context: str  # CV section or job requirement this relates to
    expected_keywords: List[str]
    evaluation_criteria: str
    follow_up_questions: List[str]


@dataclass
class CandidateResponse:
    """Candidate's response to a question"""
    question_id: str
    response_text: str
    response_time: float  # seconds
    correctness_score: float  # 0-1
    keyword_match_score: float
    confidence_score: float


class CCAQEEngine:
    """
    Context-Aware Adaptive Questioning Engine
    
    Uses OpenRouter API to generate intelligent, adaptive interview questions
    based on candidate's CV and job requirements.
    """
    
    def __init__(
        self,
        openrouter_api_key: str,
        model: str = "anthropic/claude-3-haiku"
    ):
        """
        Initialize CCAQE Engine
        
        Args:
            openrouter_api_key: OpenRouter API key
            model: Model to use (default: Claude 3 Haiku via OpenRouter)
        """
        # Configure OpenRouter API
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_api_key,
        )
        self.model = model
        
        # Question bank
        self.generated_questions: List[Question] = []
        self.asked_questions: List[Question] = []
        self.responses: List[CandidateResponse] = []
        
        # IRT parameters
        self.current_difficulty = DifficultyLevel.MEDIUM
        self.ability_estimate = 0.5  # Candidate ability (0-1)
        
        # Performance tracking
        self.correct_streak = 0
        self.incorrect_streak = 0
        
        print(f"[CCAQE] Initialized with OpenRouter API using model: {model}")
        
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text content from PDF resume
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text content
        """
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                
                for page in pdf_reader.pages:
                    text += page.extract_text()
                
                print(f"[CCAQE] Extracted {len(text)} characters from PDF")
                return text
                
        except Exception as e:
            print(f"[CCAQE] Error extracting PDF: {e}")
            return ""
    
    def parse_resume(self, resume_text: str) -> Dict[str, any]:
        """
        Parse resume to extract key information using OpenRouter
        
        Args:
            resume_text: Raw resume text
            
        Returns:
            Structured resume data
        """
        prompt = f"""
        Analyze this resume and extract key information in JSON format:
        
        Resume:
        {resume_text}
        
        Extract:
        1. Personal Info (name, email, phone)
        2. Education (degrees, institutions, years)
        3. Work Experience (companies, roles, duration, responsibilities)
        4. Skills (technical skills, tools, languages)
        5. Projects (project names, technologies, descriptions)
        6. Certifications
        7. Achievements
        
        Return ONLY valid JSON with these sections.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract JSON from response
            json_text = response.choices[0].message.content
            
            # Clean markdown code blocks if present
            json_text = re.sub(r'```json\n?', '', json_text)
            json_text = re.sub(r'```\n?', '', json_text)
            
            resume_data = json.loads(json_text)
            print(f"[CCAQE] Successfully parsed resume")
            return resume_data
            
        except Exception as e:
            print(f"[CCAQE] Error parsing resume: {e}")
            return {}
    
    def generate_questions(
        self,
        resume_data: Dict[str, any],
        job_description: str,
        num_questions: int = 10
    ) -> List[Question]:
        """
        Generate adaptive interview questions using OpenRouter API
        
        Args:
            resume_data: Parsed resume data
            job_description: Job posting description
            num_questions: Number of questions to generate
            
        Returns:
            List of generated questions
        """
        # Create comprehensive prompt
        prompt = f"""
        You are an expert technical interviewer. Generate {num_questions} interview questions based on:
        
        CANDIDATE RESUME:
        {json.dumps(resume_data, indent=2)}
        
        JOB DESCRIPTION:
        {job_description}
        
        Generate questions in these categories:
        1. VERIFICATION (30%): Questions to verify claims in the CV
        2. TECHNICAL (50%): Deep technical questions on skills mentioned
        3. BEHAVIORAL (20%): Situational and soft skill questions
        
        For each question, provide:
        - question_text: The actual question
        - type: verification/technical/behavioral
        - difficulty: easy/medium/hard/expert
        - context: Which CV section or job requirement this relates to
        - expected_keywords: List of keywords expected in a good answer
        - evaluation_criteria: How to evaluate the answer
        - follow_up_questions: 2-3 follow-up questions to probe deeper
        
        Return as JSON array of questions.
        Make questions specific to the candidate's experience and the job requirements.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500  # Limit tokens to reduce cost
            )
            
            # Extract JSON
            json_text = response.choices[0].message.content
            json_text = re.sub(r'```json\n?', '', json_text)
            json_text = re.sub(r'```\n?', '', json_text)
            
            questions_data = json.loads(json_text)
            
            # Convert to Question objects
            questions = []
            for i, q_data in enumerate(questions_data):
                question = Question(
                    id=f"Q{i+1}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    type=QuestionType(q_data.get('type', 'technical')),
                    difficulty=self._parse_difficulty(q_data.get('difficulty', 'medium')),
                    question_text=q_data.get('question_text', ''),
                    context=q_data.get('context', ''),
                    expected_keywords=q_data.get('expected_keywords', []),
                    evaluation_criteria=q_data.get('evaluation_criteria', ''),
                    follow_up_questions=q_data.get('follow_up_questions', [])
                )
                questions.append(question)
            
            self.generated_questions.extend(questions)
            print(f"[CCAQE] Generated {len(questions)} questions using OpenRouter")
            return questions
            
        except Exception as e:
            print(f"[CCAQE] Error generating questions: {e}")
            return []
    
    def _parse_difficulty(self, difficulty_str: str) -> DifficultyLevel:
        """Parse difficulty string to enum"""
        difficulty_map = {
            'easy': DifficultyLevel.EASY,
            'medium': DifficultyLevel.MEDIUM,
            'hard': DifficultyLevel.HARD,
            'expert': DifficultyLevel.EXPERT
        }
        return difficulty_map.get(difficulty_str.lower(), DifficultyLevel.MEDIUM)
    
    def select_next_question(self) -> Optional[Question]:
        """
        Select next question using IRT (Item Response Theory) logic
        
        Returns:
            Next question to ask, or None if no suitable question
        """
        # Filter questions by current difficulty
        available_questions = [
            q for q in self.generated_questions
            if q not in self.asked_questions
            and q.difficulty == self.current_difficulty
        ]
        
        # If no questions at current difficulty, try adjacent levels
        if not available_questions:
            if self.current_difficulty.value > 1:
                available_questions = [
                    q for q in self.generated_questions
                    if q not in self.asked_questions
                    and q.difficulty.value == self.current_difficulty.value - 1
                ]
            
            if not available_questions and self.current_difficulty.value < 4:
                available_questions = [
                    q for q in self.generated_questions
                    if q not in self.asked_questions
                    and q.difficulty.value == self.current_difficulty.value + 1
                ]
        
        if not available_questions:
            print("[CCAQE] No more questions available")
            return None
        
        # Select first available question (can be randomized)
        next_question = available_questions[0]
        self.asked_questions.append(next_question)
        
        print(f"[CCAQE] Selected question: {next_question.id} ({next_question.difficulty.name})")
        return next_question
    
    def evaluate_response(
        self,
        question: Question,
        response_text: str,
        response_time: float
    ) -> CandidateResponse:
        """
        Evaluate candidate's response using OpenRouter
        
        Args:
            question: The question that was asked
            response_text: Candidate's answer
            response_time: Time taken to answer (seconds)
            
        Returns:
            CandidateResponse with evaluation scores
        """
        evaluation_prompt = f"""
        Evaluate this interview response:
        
        QUESTION: {question.question_text}
        EXPECTED KEYWORDS: {', '.join(question.expected_keywords)}
        EVALUATION CRITERIA: {question.evaluation_criteria}
        
        CANDIDATE'S RESPONSE: {response_text}
        
        Provide evaluation as JSON:
        {{
            "correctness_score": 0.0-1.0,
            "keyword_match_score": 0.0-1.0,
            "confidence_score": 0.0-1.0,
            "strengths": ["list of strengths"],
            "weaknesses": ["list of weaknesses"],
            "overall_assessment": "brief assessment"
        }}
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": evaluation_prompt}
                ],
                max_tokens=500  # Limit tokens for evaluation
            )
            
            # Extract JSON
            json_text = response.choices[0].message.content
            json_text = re.sub(r'```json\n?', '', json_text)
            json_text = re.sub(r'```\n?', '', json_text)
            
            eval_data = json.loads(json_text)
            
            candidate_response = CandidateResponse(
                question_id=question.id,
                response_text=response_text,
                response_time=response_time,
                correctness_score=eval_data.get('correctness_score', 0.5),
                keyword_match_score=eval_data.get('keyword_match_score', 0.5),
                confidence_score=eval_data.get('confidence_score', 0.5)
            )
            
            self.responses.append(candidate_response)
            
            # Update IRT parameters
            self._update_difficulty(candidate_response.correctness_score)
            
            print(f"[CCAQE] Response evaluated: {candidate_response.correctness_score:.2f}")
            return candidate_response
            
        except Exception as e:
            print(f"[CCAQE] Error evaluating response: {e}")
            # Return default response
            return CandidateResponse(
                question_id=question.id,
                response_text=response_text,
                response_time=response_time,
                correctness_score=0.5,
                keyword_match_score=0.5,
                confidence_score=0.5
            )
    
    def _update_difficulty(self, correctness_score: float):
        """
        Update difficulty level based on IRT logic
        
        Args:
            correctness_score: Score from last response (0-1)
        """
        # Update ability estimate (simple moving average)
        self.ability_estimate = 0.7 * self.ability_estimate + 0.3 * correctness_score
        
        # Track streaks
        if correctness_score >= 0.7:
            self.correct_streak += 1
            self.incorrect_streak = 0
        else:
            self.incorrect_streak += 1
            self.correct_streak = 0
        
        # Adjust difficulty
        if self.correct_streak >= 2 and self.current_difficulty.value < 4:
            # Increase difficulty
            self.current_difficulty = DifficultyLevel(self.current_difficulty.value + 1)
            self.correct_streak = 0
            print(f"[CCAQE] Difficulty increased to {self.current_difficulty.name}")
            
        elif self.incorrect_streak >= 2 and self.current_difficulty.value > 1:
            # Decrease difficulty
            self.current_difficulty = DifficultyLevel(self.current_difficulty.value - 1)
            self.incorrect_streak = 0
            print(f"[CCAQE] Difficulty decreased to {self.current_difficulty.name}")
    
    def get_performance_summary(self) -> Dict[str, any]:
        """
        Get candidate performance summary
        
        Returns:
            Dictionary with performance metrics
        """
        if not self.responses:
            return {
                'total_questions': 0,
                'average_score': 0.0,
                'ability_estimate': self.ability_estimate
            }
        
        scores = [r.correctness_score for r in self.responses]
        
        return {
            'total_questions': len(self.responses),
            'questions_by_type': {
                qtype.value: sum(1 for q in self.asked_questions if q.type == qtype)
                for qtype in QuestionType
            },
            'questions_by_difficulty': {
                diff.name: sum(1 for q in self.asked_questions if q.difficulty == diff)
                for diff in DifficultyLevel
            },
            'average_score': sum(scores) / len(scores),
            'max_score': max(scores),
            'min_score': min(scores),
            'ability_estimate': self.ability_estimate,
            'current_difficulty': self.current_difficulty.name,
            'average_response_time': sum(r.response_time for r in self.responses) / len(self.responses)
        }
    
    def export_interview_report(self, filepath: str):
        """
        Export comprehensive interview report
        
        Args:
            filepath: Path to save JSON report
        """
        report = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'total_questions_generated': len(self.generated_questions),
                'total_questions_asked': len(self.asked_questions),
                'model_used': self.model
            },
            'performance_summary': self.get_performance_summary(),
            'questions_and_responses': [
                {
                    'question_id': q.id,
                    'question_text': q.question_text,
                    'type': q.type.value,
                    'difficulty': q.difficulty.name,
                    'context': q.context,
                    'response': next(
                        (
                            {
                                'text': r.response_text,
                                'time': r.response_time,
                                'scores': {
                                    'correctness': r.correctness_score,
                                    'keyword_match': r.keyword_match_score,
                                    'confidence': r.confidence_score
                                }
                            }
                            for r in self.responses if r.question_id == q.id
                        ),
                        None
                    )
                }
                for q in self.asked_questions
            ]
        }
        
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"[CCAQE] Interview report exported to {filepath}")


# Demo/Testing function
def demo_ccaqe():
    """
    Demo function to test CCAQE engine with OpenRouter
    """
    print("=" * 60)
    print("CCAQE Demo - Adaptive Questioning Engine (OpenRouter)")
    print("=" * 60)
    
    # Get OpenRouter API key
    api_key = os.getenv('OPENROUTER_API_KEY')
    
    if not api_key:
        print("⚠️ Please set OPENROUTER_API_KEY environment variable")
        print("Example: set OPENROUTER_API_KEY='your-key-here'")
        return
    
    engine = CCAQEEngine(openrouter_api_key=api_key)
    
    # Sample resume data (normally extracted from PDF)
    sample_resume = {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "education": [
            {
                "degree": "B.Tech in Computer Science",
                "institution": "MIT",
                "year": "2020"
            }
        ],
        "skills": ["Python", "Machine Learning", "TensorFlow", "React", "Node.js"],
        "experience": [
            {
                "company": "Tech Corp",
                "role": "ML Engineer",
                "duration": "2020-2023",
                "responsibilities": "Developed ML models for fraud detection"
            }
        ],
        "projects": [
            {
                "name": "AI Chatbot",
                "technologies": ["Python", "NLP", "TensorFlow"],
                "description": "Built conversational AI using transformers"
            }
        ]
    }
    
    job_description = """
    We are looking for a Senior ML Engineer with:
    - 3+ years experience in Python and ML
    - Strong knowledge of deep learning frameworks
    - Experience with production ML systems
    - Good communication skills
    """
    
    # Generate questions
    print("\n[1] Generating questions...")
    questions = engine.generate_questions(sample_resume, job_description, num_questions=5)
    
    print(f"\nGenerated {len(questions)} questions:")
    for q in questions:
        print(f"\n{q.id} [{q.type.value.upper()}] [{q.difficulty.name}]")
        print(f"Q: {q.question_text}")
        print(f"Context: {q.context}")
    
    # Simulate interview
    print("\n" + "=" * 60)
    print("[2] Simulating Interview with IRT")
    print("=" * 60)
    
    sample_responses = [
        "I have worked extensively with TensorFlow and PyTorch for building deep learning models.",
        "In my previous role, I deployed ML models using Docker and Kubernetes.",
        "I'm not very familiar with that specific technique."
    ]
    
    for i in range(min(3, len(questions))):
        question = engine.select_next_question()
        if not question:
            break
        
        print(f"\n[Question {i+1}] {question.question_text}")
        print(f"Difficulty: {question.difficulty.name}")
        
        # Simulate response
        response_text = sample_responses[i % len(sample_responses)]
        print(f"Response: {response_text}")
        
        # Evaluate
        evaluation = engine.evaluate_response(question, response_text, response_time=45.0)
        print(f"Score: {evaluation.correctness_score:.2f}")
    
    # Show summary
    print("\n" + "=" * 60)
    print("PERFORMANCE SUMMARY")
    print("=" * 60)
    summary = engine.get_performance_summary()
    for key, value in summary.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    demo_ccaqe()
