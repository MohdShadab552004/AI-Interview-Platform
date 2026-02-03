"""
Test OpenRouter models to find working ones
"""

from openai import OpenAI
from env_loader import get_openrouter_key

# Load API key
api_key = get_openrouter_key()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

# Try different models
models_to_try = [
    "google/gemini-pro",
    "google/gemini-pro-1.5-exp",
    "anthropic/claude-3-haiku",
    "meta-llama/llama-3-8b-instruct",
    "openai/gpt-3.5-turbo",
]

print("Testing OpenRouter models...\n")

for model in models_to_try:
    print(f"Testing: {model}")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Say 'Hello' if you can hear me."}
            ],
            max_tokens=10
        )
        print(f"✓ {model} WORKS!")
        print(f"  Response: {response.choices[0].message.content}\n")
        break
    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg:
            print(f"✗ {model} - Not found\n")
        elif "429" in error_msg:
            print(f"⚠ {model} - Rate limited\n")
        else:
            print(f"✗ {model} - Error: {error_msg[:100]}\n")
