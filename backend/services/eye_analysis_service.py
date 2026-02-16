"""
Flask API Service for Advanced Eye Movement Analysis
Provides REST endpoints for micro-saccade detection and stress monitoring
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add services directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from eye_movement_analyzer import EyeMovementAnalyzer

app = Flask(__name__)
CORS(app)

# Store analyzer instances per session
analyzers = {}

@app.route('/api/eye-analysis/init', methods=['POST'])
def init_session():
    """Initialize a new analysis session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'session_id required'}), 400
    
    analyzers[session_id] = EyeMovementAnalyzer()
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'message': 'Analysis session initialized'
    })

@app.route('/api/eye-analysis/process', methods=['POST'])
def process_frame():
    """Process a single frame of landmark data"""
    data = request.json
    session_id = data.get('session_id')
    landmarks = data.get('landmarks')
    
    if not session_id or session_id not in analyzers:
        return jsonify({'error': 'Invalid or uninitialized session_id'}), 400
    
    if not landmarks:
        return jsonify({'error': 'landmarks data required'}), 400
    
    try:
        analyzer = analyzers[session_id]
        result = analyzer.process_frame(landmarks)
        
        return jsonify({
            'success': True,
            'analysis': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/eye-analysis/close', methods=['POST'])
def close_session():
    """Close an analysis session"""
    data = request.json
    session_id = data.get('session_id')
    
    if session_id in analyzers:
        del analyzers[session_id]
    
    return jsonify({
        'success': True,
        'message': 'Session closed'
    })

@app.route('/api/eye-analysis/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'active_sessions': len(analyzers)
    })

if __name__ == '__main__':
    print("🔬 Eye Movement Analysis Service Starting...")
    print("📊 Endpoints:")
    print("  POST /api/eye-analysis/init - Initialize session")
    print("  POST /api/eye-analysis/process - Process frame")
    print("  POST /api/eye-analysis/close - Close session")
    print("  GET  /api/eye-analysis/health - Health check")
    print("\n🚀 Server running on http://localhost:5001")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
