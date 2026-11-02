/**
 * Pre-built static sample transcript for guest demo preview.
 * Showcases 2-speaker diarization with timestamps and multi-language translation.
 */
export const SAMPLE_TRANSCRIPT = {
  id: 'sample-demo-1',
  fileName: 'product_strategy_sync.mp3',
  duration: 36,
  language: 'hi',
  languageName: 'Hindi',
  speakerCount: 2,
  hasDiarization: true,
  summary: 'Sprint planning discussion covering model evaluation, latency benchmarks, and upcoming release milestones.',
  originalText:
    'Speaker 1: नमस्कार! क्या हम नए स्पीच मॉडल के बेंचमार्क टेस्ट्स रिव्यू कर सकते हैं? Speaker 2: हाँ बिल्कुल। लेटेंसी 300 मिलीसेकंड से कम है और एक्यूरेसी 98% से ज्यादा आ रही है। Speaker 1: बहुत बढ़िया। फिर हम इसे आज रात प्रोडक्शन में रोल आउट कर सकते हैं। Speaker 2: परफेक्ट! मैं डेप्लॉयमेंट पाइपलाइन तैयार कर देता हूँ।',
  translatedText:
    'Speaker 1: Hello! Can we review the benchmark tests for the new speech model? Speaker 2: Yes, absolutely. Latency is under 300 milliseconds and accuracy is above 98%. Speaker 1: Great news. Then we can roll this out to production tonight. Speaker 2: Perfect! I will prepare the deployment pipeline.',
  utterances: [
    {
      speaker: 1,
      start: 0.0,
      end: 4.8,
      originalText: 'नमस्कार! क्या हम नए स्पीच मॉडल के लेटेंसी और एक्यूरेसी बेंचमार्क रिव्यू कर सकते हैं?',
      translatedText: 'Hello! Can we review the latency and accuracy benchmarks for the new speech model?',
    },
    {
      speaker: 2,
      start: 5.2,
      end: 14.1,
      originalText: 'हाँ बिल्कुल। लेटेंसी 300 मिलीसेकंड से कम है और वर्ड एरर रेट काफी कम होकर एक्यूरेसी 98% से ऊपर आ रही है।',
      translatedText: 'Yes, absolutely. Latency is under 300 milliseconds and word error rate has dropped significantly with accuracy over 98%.',
    },
    {
      speaker: 1,
      start: 14.6,
      end: 22.4,
      originalText: 'यह तो बहुत बढ़िया परिणाम है। क्या हम इसे आज रात प्रोडक्शन में रोल आउट करने के लिए तैयार हैं?',
      translatedText: 'That is fantastic. Are we ready to roll this out to production tonight?',
    },
    {
      speaker: 2,
      start: 22.9,
      end: 32.5,
      originalText: 'परफेक्ट! मैं डेप्लॉयमेंट पाइपलाइन और मॉनिटरिंग अलर्ट्स तैयार कर देता हूँ ताकि सब कुछ स्मूद रहे।',
      translatedText: 'Perfect! I will set up the deployment pipeline and monitoring alerts to make sure everything runs smoothly.',
    },
  ],
};

