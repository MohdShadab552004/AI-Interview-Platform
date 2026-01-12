import axios from 'axios';
import fs from 'fs';

class GoogleTranslateTTS {
  async textToSpeech(text, language = 'en') {
    try {
      const url = 'https://translate.google.com/translate_tts';
      
      const response = await axios.get(url, {
        params: {
          ie: 'UTF-8',
          tl: language,
          q: text,
          client: 'tw-ob',
          ttsspeed: '1.0'
        },
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return Buffer.from(response.data); // MP3 format

    } catch (error) {
      console.error('Google TTS error:', error.message);
      return null;
    }
  }
}

// Usage
const tts = new GoogleTranslateTTS();

const main = async () => {
  const audioBuffer = await tts.textToSpeech("Hello, let's start the interview.");
  
  if (audioBuffer) {
    fs.writeFileSync('output.mp3', audioBuffer);
    console.log('TTS saved to output.mp3');
  }
};

main();
