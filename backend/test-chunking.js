const splitTextIntoChunks = (text, maxLength = 180) => {
    const chunks = [];
    let currentChunk = '';
    const sentences = text.split(/([.?!]+)/); // Split by punctuation, keeping it

    for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];
        if (currentChunk.length + part.length < maxLength) {
            currentChunk += part;
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = part;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.filter(c => c.length > 0);
};

const longText = "This is a very long sentence that needs to be split. It has multiple parts. " +
    "We need to ensure that Google TTS can handle it without crashing. " +
    "Usually, the limit is around 200 characters. " +
    "If we send more than that, the API will fail or truncate the text. " +
    "So, this logic is crucial for the reliability of the system. " +
    "Let's add some more text to be absolutely sure it works correctly for very long paragraphs.";

console.log("Original Length:", longText.length);
const chunks = splitTextIntoChunks(longText);
console.log("Chunks generated:", chunks.length);
chunks.forEach((c, i) => console.log(`Chunk ${i}: [${c.length} chars] ${c}`));

if (chunks.every(c => c.length <= 180)) {
    console.log("✅ All chunks are within limit.");
} else {
    console.error("❌ Some chunks exceeded limit.");
}
