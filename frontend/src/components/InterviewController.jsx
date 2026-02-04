import React from 'react';
import { FiMic, FiMicOff, FiSkipForward, FiPower, FiPlay, FiPause } from 'react-icons/fi';

const InterviewController = ({
  isRecording,
  isPlaying,
  hasAudioFinished,
  onStartRecording,
  onStopRecording,
  onSkipQuestion,
  onEndInterview,
  onPlayQuestion,
  onPauseQuestion,
  disabled
}) => {
  return (
    <div className="interview-controller">
      <div className="controls-grid">
        {/* Play/Pause Question */}
        <button
          className={`control-btn ${isPlaying ? 'btn-playing' : 'btn-play'}`}
          onClick={isPlaying ? onPauseQuestion : onPlayQuestion}
          disabled={disabled || !onPlayQuestion}
          title={isPlaying ? "Pause Question" : "Play Question"}
        >
          {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>

        {/* Start/Stop Recording */}
        <button
          className={`control-btn ${isRecording ? 'btn-stop' : 'btn-record'}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={disabled || isPlaying}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? <FiMicOff size={20} /> : <FiMic size={20} />}
          <span>{isRecording ? "Stop" : "Record"}</span>
        </button>

        {/* Skip Question */}
        <button
          className="control-btn btn-skip"
          onClick={onSkipQuestion}
          disabled={disabled || !hasAudioFinished}
        >
          <FiSkipForward size={20} />
          <span>Skip</span>
        </button>

        {/* End Interview */}
        <button
          className="control-btn btn-end"
          onClick={onEndInterview}
          disabled={disabled || !hasAudioFinished}
          title="End Interview"
        >
          <FiPower size={20} />
          <span>End</span>
        </button>
      </div>

      <div className="status-indicators">
        <div className={`status-indicator ${isPlaying ? 'active' : ''}`}>
          <div className="status-dot playing"></div>
          <span>Playing</span>
        </div>
        <div className={`status-indicator ${isRecording ? 'active' : ''}`}>
          <div className="status-dot recording"></div>
          <span>Recording</span>
        </div>
      </div>

      <div className="control-instructions">
        {isPlaying && (
          <p className="instruction">Listen carefully to the question...</p>
        )}
        {isRecording && (
          <p className="instruction">Speak your answer clearly...</p>
        )}
        {!isPlaying && !isRecording && (
          <p className="instruction">Click "Play" to hear the question</p>
        )}
      </div>
    </div>
  );
};

export default InterviewController;