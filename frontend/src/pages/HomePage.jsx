import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    candidateName: '',
    email: '',
    position: 'React Developer',
    experienceLevel: 'Mid-level',
    company: '',
    jobId: '',
  });

  // Available positions
  const positions = [
    'React Developer',
    'Frontend Developer',
    'Full Stack Developer',
    'Backend Developer',
    'Software Engineer',
    'DevOps Engineer',
    'Data Scientist',
    'Product Manager'
  ];

  // Experience levels
  const experienceLevels = [
    'Entry-level',
    'Junior',
    'Mid-level',
    'Senior',
    'Lead',
    'Principal'
  ];

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.candidateName.trim()) {
      toast.error('Please enter your name');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Please enter a valid email');
      return false;
    }
    return true;
  };

  const startInterview = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      toast.loading('Preparing your interview...');
      
      const response = await axios.post(`${API_BASE}/interview/start`, {
        candidateName: formData.candidateName,
        email: formData.email,
        position: formData.position,
        experienceLevel: formData.experienceLevel,
        company: formData.company,
        jobId: formData.jobId,
      });
      
      toast.dismiss();
      
      if (response.data.success) {
        toast.success('Interview session created!');
        
        // Save to localStorage for future reference
        localStorage.setItem('currentInterview', JSON.stringify({
          sessionId: response.data.interview.id,
          candidateName: formData.candidateName,
          email: formData.email,
          position: formData.position
        }));
        
        // Navigate to interview page
        navigate(`/interview/${response.data.sessionId}`);
      } else {
        toast.error(response.data.error || 'Failed to start interview');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error starting interview:', error);
      
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkCameraMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      
      toast.success('Camera and microphone are working!');
      return true;
    } catch (error) {
      toast.error('Please allow camera and microphone access');
      return false;
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            AI-Powered <span className="highlight">Technical Interviews</span>
          </h1>
          <p className="hero-subtitle">
            Experience the future of hiring. Get evaluated by our AI interview system 
            with real-time feedback and comprehensive analysis.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <h3>10,000+</h3>
              <p>Interviews Conducted</p>
            </div>
            <div className="stat">
              <h3>98%</h3>
              <p>Accuracy Rate</p>
            </div>
            <div className="stat">
              <h3>24/7</h3>
              <p>Available</p>
            </div>
            <div className="stat">
              <h3>50+</h3>
              <p>Companies</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="interview-preview">
            <div className="preview-screen"></div>
            <div className="preview-metrics">
              <span className="metric active">🎯 Attention</span>
              <span className="metric">🎤 Voice</span>
              <span className="metric">📊 Analysis</span>
            </div>
        </div>
      </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Interview Setup Form */}
        <section className="setup-section">
          <div className="section-header">
            <h2>Start Your Interview</h2>
            <p>Fill in your details to begin the AI-powered interview</p>
          </div>

          <form onSubmit={startInterview} className="interview-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="candidateName">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="candidateName"
                  name="candidateName"
                  value={formData.candidateName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="position">
                  Position Applying For *
                </label>
                <select
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  {positions.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="experienceLevel">
                  Experience Level *
                </label>
                <select
                  id="experienceLevel"
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  {experienceLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="company">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Company name"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="jobId">
                  Job ID (Optional)
                </label>
                <input
                  type="text"
                  id="jobId"
                  name="jobId"
                  value={formData.jobId}
                  onChange={handleInputChange}
                  placeholder="Job reference ID"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-test"
                onClick={checkCameraMic}
                disabled={loading}
              >
                Test Camera & Mic
              </button>
              <button
                type="submit"
                className="btn-start"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Starting Interview...
                  </>
                ) : (
                  'Start Interview Now'
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Experience a seamless interview process powered by AI</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Smart Questions</h3>
              <p>AI-generated questions tailored to your position and experience level</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎤</div>
              <h3>Voice Analysis</h3>
              <p>Real-time analysis of speech patterns, confidence, and clarity</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">👁️</div>
              <h3>Video Proctoring</h3>
              <p>Attention tracking and eye contact monitoring for comprehensive evaluation</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Instant Feedback</h3>
              <p>Detailed evaluation report immediately after the interview</p>
            </div>
          </div>
        </section>

        {/* Requirements Section */}
        <section className="requirements-section">
          <div className="section-header">
            <h2>Requirements</h2>
            <p>Ensure you have everything ready before starting</p>
          </div>

          <div className="requirements-list">
            <div className="requirement">
              <div className="req-icon">💻</div>
              <div className="req-content">
                <h3>Computer with Webcam</h3>
                <p>A laptop or desktop with a functional webcam</p>
              </div>
            </div>

            <div className="requirement">
              <div className="req-icon">🎤</div>
              <div className="req-content">
                <h3>Microphone</h3>
                <p>Built-in or external microphone for clear audio</p>
              </div>
            </div>

            <div className="requirement">
              <div className="req-icon">🌐</div>
              <div className="req-content">
                <h3>Stable Internet</h3>
                <p>Minimum 5 Mbps upload/download speed</p>
              </div>
            </div>

            <div className="requirement">
              <div className="req-icon">🔒</div>
              <div className="req-content">
                <h3>Quiet Environment</h3>
                <p>Noise-free room with good lighting</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="testimonials-section">
          <div className="section-header">
            <h2>What Candidates Say</h2>
            <p>Hear from those who've experienced our AI interview system</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"The most advanced interview system I've used. The feedback was incredibly detailed!"</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">SR</div>
                <div className="author-info">
                  <h4>Sarah Johnson</h4>
                  <p>Senior React Developer</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"Real-time metrics helped me understand my performance. Highly recommend!"</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">MK</div>
                <div className="author-info">
                  <h4>Michael Chen</h4>
                  <p>Full Stack Developer</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <h2>AI Interview</h2>
            <p>Revolutionizing technical hiring</p>
          </div>
          
          <div className="footer-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/contact">Contact Support</a>
          </div>
          
          <div className="footer-cta">
            <p>Ready to start your interview journey?</p>
            <button 
              className="btn-footer-start"
              onClick={() => document.querySelector('.setup-section').scrollIntoView({ behavior: 'smooth' })}
            >
              Get Started
            </button>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} AI Interview System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;