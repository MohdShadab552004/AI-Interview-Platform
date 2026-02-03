"""
Environment loader for IAIS
Loads OpenRouter API key from backend .env file
"""

import os
import sys
from pathlib import Path


def load_env_from_backend():
    """Load environment variables from backend .env file"""
    # Get the backend .env path
    current_dir = Path(__file__).parent
    backend_env_path = current_dir.parent / 'backend' / '.env'
    
    if not backend_env_path.exists():
        print(f"⚠️ Warning: .env file not found at {backend_env_path}")
        return False
    
    # Read and parse .env file
    with open(backend_env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()
    
    print(f"✓ Loaded environment variables from {backend_env_path}")
    return True


def get_openrouter_key():
    """Get OpenRouter API key from environment"""
    # First try to load from backend .env
    if 'OPENROUTER_API_KEY' not in os.environ:
        load_env_from_backend()
    
    api_key = os.getenv('OPENROUTER_API_KEY')
    
    if not api_key:
        print("⚠️ OPENROUTER_API_KEY not found in environment")
        print("Please set it in backend/.env file or as environment variable")
        return None
    
    print(f"✓ OpenRouter API key loaded (length: {len(api_key)})")
    return api_key


if __name__ == "__main__":
    # Test loading
    key = get_openrouter_key()
    if key:
        print(f"\nOpenRouter API Key: {key[:20]}...")
    else:
        print("\nFailed to load OpenRouter API key")
