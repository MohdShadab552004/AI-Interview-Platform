import numpy as np
import librosa
import scipy.signal
if not hasattr(scipy.signal, 'hann'):
    try:
        import scipy.signal.windows
        scipy.signal.hann = scipy.signal.windows.hann
    except:
        pass

def test():
    try:
        y = np.random.randn(44100)
        sr = 44100
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo_result = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        
        print(f"Tempo result type: {type(tempo_result)}")
        
        # Handle different return types (tuple, scalar, or array)
        if isinstance(tempo_result, tuple):
            tempo = tempo_result[0]
        else:
            tempo = tempo_result
            
        print(f"Tempo type: {type(tempo)}")
            
        # Ensure tempo is a float value
        if hasattr(tempo, "__len__"):
            tempo_val = float(tempo[0]) if len(tempo) > 0 else 0
        else:
            tempo_val = float(tempo)
            
        print(f"Validated tempo_val: {tempo_val}")
        print("Success! No len() error.")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
