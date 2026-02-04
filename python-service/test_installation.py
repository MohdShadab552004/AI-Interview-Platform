"""
IAIS Installation Test Script
Verifies all dependencies are installed correctly
"""

import sys

def test_imports():
    """Test all required imports"""
    print("=" * 70)
    print("IAIS Installation Test")
    print("=" * 70)
    
    tests = []
    
    # Test OpenCV
    print("\n[1/8] Testing OpenCV...")
    try:
        import cv2
        print(f"✓ OpenCV {cv2.__version__} installed")
        tests.append(True)
    except ImportError as e:
        print(f"✗ OpenCV not installed: {e}")
        tests.append(False)
    
    # Test MediaPipe
    print("\n[2/8] Testing MediaPipe...")
    try:
        import mediapipe as mp
        print(f"✓ MediaPipe {mp.__version__} installed")
        tests.append(True)
    except ImportError as e:
        print(f"✗ MediaPipe not installed: {e}")
        tests.append(False)
    
    # Test NumPy
    print("\n[3/8] Testing NumPy...")
    try:
        import numpy as np
        print(f"✓ NumPy {np.__version__} installed")
        tests.append(True)
    except ImportError as e:
        print(f"✗ NumPy not installed: {e}")
        tests.append(False)
    
    # Test scikit-learn
    print("\n[4/8] Testing scikit-learn...")
    try:
        import sklearn
        print(f"✓ scikit-learn {sklearn.__version__} installed")
        tests.append(True)
    except ImportError as e:
        print(f"✗ scikit-learn not installed: {e}")
        tests.append(False)
    
    # Test Google Generative AI
    print("\n[5/8] Testing Google Generative AI...")
    try:
        import google.generativeai as genai
        print(f"✓ Google Generative AI installed")
        tests.append(True)
    except ImportError as e:
        print(f"✗ Google Generative AI not installed: {e}")
        tests.append(False)
    
    # Test PyPDF2
    print("\n[6/8] Testing PyPDF2...")
    try:
        import PyPDF2
        print(f"✓ PyPDF2 {PyPDF2.__version__} installed")
        tests.append(True)
    except ImportError as e:
        print(f"✗ PyPDF2 not installed: {e}")
        tests.append(False)
    
    # Test TensorFlow (optional)
    print("\n[7/8] Testing TensorFlow...")
    try:
        import tensorflow as tf
        print(f"✓ TensorFlow {tf.__version__} installed")
        tests.append(True)
    except ImportError as e:
        print(f"⚠ TensorFlow not installed (optional): {e}")
        tests.append(True)  # Optional, don't fail
    
    # Test Scapy (optional)
    print("\n[8/8] Testing Scapy...")
    try:
        import scapy
        print(f"✓ Scapy installed")
        tests.append(True)
    except ImportError as e:
        print(f"⚠ Scapy not installed (optional, requires admin): {e}")
        tests.append(True)  # Optional, don't fail
    
    return all(tests)


def test_modules():
    """Test IAIS modules can be imported"""
    print("\n" + "=" * 70)
    print("Testing IAIS Modules")
    print("=" * 70)
    
    modules = [
        ('grcda_module', 'GRCDADetector'),
        ('mmfdf_module', 'MMFDFEngine'),
        ('ccaqe_module', 'CCAQEEngine'),
        ('safas_module', 'SAFASDetector'),
        ('network_monitor', 'NetworkMonitor')
    ]
    
    tests = []
    
    for i, (module_name, class_name) in enumerate(modules, 1):
        print(f"\n[{i}/{len(modules)}] Testing {module_name}...")
        try:
            module = __import__(module_name)
            cls = getattr(module, class_name)
            print(f"✓ {class_name} loaded successfully")
            tests.append(True)
        except Exception as e:
            print(f"✗ Failed to load {class_name}: {e}")
            tests.append(False)
    
    return all(tests)


def test_camera():
    """Test webcam access"""
    print("\n" + "=" * 70)
    print("Testing Webcam Access")
    print("=" * 70)
    
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("✗ Webcam not accessible")
            return False
        
        ret, frame = cap.read()
        cap.release()
        
        if ret:
            print(f"✓ Webcam accessible (resolution: {frame.shape[1]}x{frame.shape[0]})")
            return True
        else:
            print("✗ Could not read frame from webcam")
            return False
            
    except Exception as e:
        print(f"✗ Webcam test failed: {e}")
        return False


def test_api_key():
    """Test OpenRouter API key"""
    print("\n" + "=" * 70)
    print("Testing OpenRouter API Key")
    print("=" * 70)
    
    import os
    
    # Try to load from backend .env
    try:
        from env_loader import get_openrouter_key
        api_key = get_openrouter_key()
    except:
        api_key = os.getenv('OPENROUTER_API_KEY')
    
    if not api_key:
        print("⚠ OPENROUTER_API_KEY environment variable not set")
        print("  Set it in backend/.env file or as environment variable")
        print("  CCAQE module will not work without it")
        return False
    
    if api_key == 'YOUR_API_KEY_HERE' or api_key == 'DEMO_MODE':
        print("⚠ OPENROUTER_API_KEY is set to placeholder value")
        print("  Please set a valid API key")
        return False
    
    print(f"✓ OPENROUTER_API_KEY is set (length: {len(api_key)})")
    return True


def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("IAIS SYSTEM INSTALLATION TEST")
    print("=" * 70)
    
    results = {
        'Dependencies': test_imports(),
        'IAIS Modules': test_modules(),
        'Webcam': test_camera(),
        'API Key': test_api_key()
    }
    
    print("\n" + "=" * 70)
    print("TEST RESULTS SUMMARY")
    print("=" * 70)
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:20s}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 70)
    if all_passed:
        print("✓ ALL TESTS PASSED - IAIS is ready to use!")
    else:
        print("✗ SOME TESTS FAILED - Please fix the issues above")
        print("\nTo install missing dependencies:")
        print("  pip install -r requirements.txt")
    print("=" * 70 + "\n")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
