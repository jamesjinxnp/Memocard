/**
 * Text-to-Speech Audio Service using Web Speech API
 */

// Check if speech synthesis is supported
export const isSpeechSupported = () => 'speechSynthesis' in window;

// Available voices cache
let voicesLoaded = false;
let englishVoices: SpeechSynthesisVoice[] = [];

// Load voices
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
        if (voicesLoaded) {
            resolve(englishVoices);
            return;
        }

        const loadVoiceList = () => {
            const voices = speechSynthesis.getVoices();
            englishVoices = voices.filter(
                (voice) => voice.lang.startsWith('en-')
            );
            voicesLoaded = true;
            resolve(englishVoices);
        };

        if (speechSynthesis.getVoices().length > 0) {
            loadVoiceList();
        } else {
            speechSynthesis.addEventListener('voiceschanged', loadVoiceList, { once: true });
        }
    });
}

// Speak text with options
export interface SpeakOptions {
    lang?: 'en-US' | 'en-GB';
    rate?: number; // 0.1 to 10, default 1
    pitch?: number; // 0 to 2, default 1
    volume?: number; // 0 to 1, default 1
}

export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!isSpeechSupported()) {
            reject(new Error('Speech synthesis not supported'));
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = options.lang || 'en-US';
        utterance.rate = options.rate || 1;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;

        // Try to find a matching voice
        const voices = speechSynthesis.getVoices();
        const matchingVoice = voices.find((v) => v.lang === utterance.lang);
        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
            // Log the error but resolve to prevent app from hanging
            console.warn('Speech synthesis error:', event.error, 'for text:', text);
            resolve();
        };

        speechSynthesis.speak(utterance);
    });
}

// Stop speaking
export function stopSpeaking(): void {
    if (isSpeechSupported()) {
        speechSynthesis.cancel();
    }
}

// Speak word with slower rate (for learning)
export function speakWord(word: string, slow = false): Promise<void> {
    return speak(word, {
        lang: 'en-US',
        rate: slow ? 0.7 : 1,
    });
}

// Speak example sentence
export function speakSentence(sentence: string): Promise<void> {
    return speak(sentence, {
        lang: 'en-US',
        rate: 0.9,
    });
}
