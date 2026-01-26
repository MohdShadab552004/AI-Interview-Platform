import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    candidateName: 'Guest Candidate',
    email: 'guest@example.com',
    position: 'General Developer',
    experienceLevel: 'Mid-level',
    company: '',
    jobId: '',
  });

  // Available positions
  const positions = [];

  // Experience levels
  const experienceLevels = [];

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.cvFile) {
      toast.error('Please upload your CV');
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

      const formPayload = new FormData();
      formPayload.append('candidateName', formData.candidateName);
      formPayload.append('email', formData.email);
      formPayload.append('position', formData.position);
      formPayload.append('experienceLevel', formData.experienceLevel);
      formPayload.append('company', formData.company);
      formPayload.append('jobId', formData.jobId);

      if (formData.cvFile) {
        formPayload.append('cv', formData.cvFile);
      }

      const response = await axios.post(`${API_BASE}/interview/start`, formPayload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.dismiss();

      if (response.data.success) {
        toast.success('Interview session created!');

        // Save to localStorage
        localStorage.setItem('currentInterview', JSON.stringify({
          sessionId: response.data.interview.id,
          candidateName: formData.candidateName,
          email: formData.email,
          position: formData.position
        }));

        navigate(`/interview/${response.data.sessionId}`);
      } else {
        toast.error(response.data.error || 'Failed to start interview');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error starting interview:', error);
      toast.error(error.response?.data?.error || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === "application/pdf") {
        setFormData(prev => ({ ...prev, cvFile: file }));
        toast.success("CV Uploaded");
      } else {
        toast.error("Please upload a PDF file");
      }
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
            <div className="form-group">
              <label htmlFor="cv">
                Upload CV (PDF) *
              </label>
              <div className="file-upload-wrapper">
                <input
                  type="file"
                  id="cv"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="file-input"
                />
                {formData.cvFile && <span className="file-name">✅ {formData.cvFile.name}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="jobId">
                Interview ID (Optional)
              </label>
              <input
                type="text"
                id="jobId"
                name="jobId"
                value={formData.jobId}
                onChange={handleInputChange}
                placeholder="Enter Interview ID"
                disabled={loading}
              />
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
    </div >
  );
};

export default HomePage;