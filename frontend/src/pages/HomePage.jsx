import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiVideo,
  FiMic,
  FiUpload,
  FiPlay,
  FiBriefcase,
  FiCpu,
  FiBarChart,
  FiShield,
  FiTarget,
  FiUsers,
  FiClock,
  FiCheckCircle
} from 'react-icons/fi';
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
    const toastId = toast.loading('Preparing your interview session...');

    try {
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

      if (response.data.success) {
        toast.success('Interview session created!', { id: toastId });

        localStorage.setItem('currentInterview', JSON.stringify({
          sessionId: response.data.interview.id,
          candidateName: formData.candidateName,
          email: formData.email,
          position: formData.position
        }));

        navigate(`/interview/${response.data.sessionId}`);
      } else {
        toast.error(response.data.error || 'Failed to start interview', { id: toastId });
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      toast.error(error.response?.data?.error || 'Network error. Please try again.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === "application/pdf") {
        setFormData(prev => ({ ...prev, cvFile: file }));
        toast.success("CV Uploaded Successfully");
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
      stream.getTracks().forEach(track => track.stop());
      toast.success('Camera and microphone are ready!');
      return true;
    } catch (error) {
      toast.error('Camera/Mic access denied. Please allow permissions.');
      return false;
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="badge">✨ Next Generation Interviewing</div>
          <h1 className="hero-title">
            AI-Powered <span className="highlight">Technical Interviews</span>
          </h1>
          <p className="hero-subtitle">
            Experience the future of hiring. Get evaluated by our advanced AI system
            with real-time behavioral analysis and technical depth.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <h3>10k+</h3>
              <p>Interviews</p>
            </div>
            <div className="stat">
              <h3>98%</h3>
              <p>Accuracy</p>
            </div>
            <div className="stat">
              <h3>24/7</h3>
              <p>Available</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="interview-preview">
            <div className="preview-screen">
              {/* Simulating scanning line and AI indicators via CSS */}
            </div>
            <div className="preview-metrics">
              <span className="metric active"><FiTarget /> Focus</span>
              <span className="metric"><FiMic /> Audio</span>
              <span className="metric"><FiBarChart /> Sentiment</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Setup Section */}
        <section className="setup-section" id="start">
          <div className="section-header">
            <h2>Ready to Begin?</h2>
            <p>Fill in your details to start your AI evaluation session</p>
          </div>

          <form onSubmit={startInterview} className="interview-form">
            <div className="form-group">
              <label htmlFor="candidateName">Full Name</label>
              <input
                type="text"
                id="candidateName"
                name="candidateName"
                value={formData.candidateName}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="position">Job Role</label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="e.g. Senior Backend Engineer"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="experienceLevel">Experience Level</label>
                <select
                  id="experienceLevel"
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                >
                  <option value="Intern">Intern (0-1 years)</option>
                  <option value="Junior">Junior (1-3 years)</option>
                  <option value="Mid-level">Mid-level (3-5 years)</option>
                  <option value="Senior">Senior (5-8 years)</option>
                  <option value="Lead">Lead (8+ years)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Resume / CV (Required)</label>
              <div className="file-upload-wrapper">
                <FiUpload size={32} style={{ marginBottom: '1rem', color: 'var(--color-primary)' }} />
                <p>{formData.cvFile ? <span className="file-name"><FiCheckCircle /> {formData.cvFile.name}</span> : 'Click or drop PDF here'}</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="file-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="jobId">Interview ID / Job Code (Optional)</label>
              <input
                type="text"
                id="jobId"
                name="jobId"
                value={formData.jobId}
                onChange={handleInputChange}
                placeholder="e.g. JB-10293"
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
                <FiVideo /> Test Setup
              </button>
              <button
                type="submit"
                className="btn-start"
                disabled={loading}
              >
                {loading ? <span className="spinner"></span> : <><FiPlay /> Start Interview</>}
              </button>
            </div>
          </form>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="section-header">
            <h2>Why Choose AI Interview?</h2>
            <p>Our platform combines deep learning with behavioral science</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><FiCpu /></div>
              <h3>Smart Questions</h3>
              <p>Adaptive technical questions that adjust based on your real-time responses.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><FiMic /></div>
              <h3>Voice Analysis</h3>
              <p>Detailed analysis of tone, confidence, and keyword relevance in your speech.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><FiVideo /></div>
              <h3>Proctoring</h3>
              <p>Advanced gaze tracking and focus monitoring to ensure interview integrity.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon"><FiBarChart /></div>
              <h3>Instant Insights</h3>
              <p>Get a comprehensive PDF report with your scores immediately after completion.</p>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="requirements-section">
          <div className="section-header">
            <h2>Technical Requirements</h2>
            <p>Ensure a smooth experience by checking these requirements</p>
          </div>

          <div className="requirements-list">
            <div className="requirement">
              <div className="req-icon"><FiVideo /></div>
              <div className="req-content">
                <h3>Stable Camera</h3>
                <p>Functional webcam with clear visibility.</p>
              </div>
            </div>
            <div className="requirement">
              <div className="req-icon"><FiMic /></div>
              <div className="req-content">
                <h3>Microphone</h3>
                <p>Clear audio input for voice evaluation.</p>
              </div>
            </div>
            <div className="requirement">
              <div className="req-icon"><FiClock /></div>
              <div className="req-content">
                <h3>30-45 Minutes</h3>
                <p>Uninterrupted time for the session.</p>
              </div>
            </div>
            <div className="requirement">
              <div className="req-icon"><FiShield /></div>
              <div className="req-content">
                <h3>Privacy</h3>
                <p>Quiet room with good lighting conditions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="testimonials-section">
          <div className="section-header">
            <h2>Success Stories</h2>
            <p>Trusted by thousands of developers and top companies</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"The AI feedback was spot on. It helped me identify gaps in my system design knowledge that I never noticed before."</p>
              </div>
              <div className="author-info">
                <h4>Alex Rivera</h4>
                <p>Lead Engineer @ TechFlow</p>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"Seamless and unbiased. The best way to practice for high-stakes technical rounds."</p>
              </div>
              <div className="author-info">
                <h4>Priya Sharma</h4>
                <p>Software Developer @ Innovate</p>
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
            <p>Advancing the future of work.</p>
          </div>
          <div className="footer-links">
            <div className="link-group">
              <h4>Platform</h4>
              <ul>
                <li><a href="#start">Start Interview</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">Solutions</a></li>
              </ul>
            </div>
            <div className="link-group">
              <h4>Support</h4>
              <ul>
                <li><a href="#">Help Center</a></li>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} AI Interview. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
