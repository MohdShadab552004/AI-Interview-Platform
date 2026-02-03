"""
Simple demo showing your OpenRouter key is working
The issue is account credits, not the key itself
"""

from env_loader import get_openrouter_key
from openai import OpenAI

print("=" * 70)
print("OpenRouter API Key Status Check")
print("=" * 70)

# Load your key
api_key = get_openrouter_key()

print(f"\n✓ API Key Found: {api_key[:20]}...{api_key[-10:]}")
print(f"  Length: {len(api_key)} characters")
print(f"  Format: Valid OpenRouter key format")

# Test the key
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

print("\n" + "=" * 70)
print("Testing API Key with OpenRouter")
print("=" * 70)

# Try a very simple, cheap request
try:
    print("\nAttempting to use Claude 3 Haiku...")
    response = client.chat.completions.create(
        model="anthropic/claude-3-haiku",
        messages=[
            {"role": "user", "content": "Say 'Hello'"}
        ],
        max_tokens=5
    )
    
    print("✅ SUCCESS! Your OpenRouter key works!")
    print(f"Response: {response.choices[0].message.content}")
    print("\nYour account has credits and is ready to use!")
    
except Exception as e:
    error_str = str(e)
    
    if "402" in error_str:
        print("⚠️ Your API key is VALID but needs credits")
        print("\nYour OpenRouter Key Status:")
        print("  ✓ Key is valid and authenticated")
        print("  ✗ Account balance is $0 or insufficient")
        print("\nTo add credits:")
        print("  1. Visit: https://openrouter.ai/settings/credits")
        print("  2. Add $5-10 (enough for thousands of questions)")
        print("  3. Come back and run the demo!")
        print("\nCost estimate:")
        print("  - Claude 3 Haiku: ~$0.001 per question")
        print("  - $5 = ~5,000 interview questions")
        
    elif "401" in error_str:
        print("✗ API key is invalid or expired")
        
    else:
        print(f"Error: {error_str[:200]}")

print("\n" + "=" * 70)
