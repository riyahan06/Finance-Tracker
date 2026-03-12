# RunAnywhere Web Starter App

A minimal React + TypeScript starter app demonstrating **on-device AI in the browser** using the [`@runanywhere/web`](https://www.npmjs.com/package/@runanywhere/web) SDK. All inference runs locally via WebAssembly — no server, no API key, 100% private.

## Features

| Tab | What it does |
|-----|-------------|
| **📚 Study Buddy** | 🆕 AI-powered study companion combining Vision + Voice + LLM for interactive learning. Point camera at textbooks/notes, ask questions naturally, get voice explanations. Three modes: Explain, Quiz Me, and Solve Step-by-Step |
| **Chat** | Stream text from an on-device LLM (LFM2 350M) |
| **Vision** | Point your camera and describe what the VLM sees (LFM2-VL 450M) |
| **Voice** | Speak naturally — VAD detects speech, STT transcribes, LLM responds, TTS speaks back |
| **Tools** | Function calling and structured output demonstrations |

## 🌟 Study Buddy - Featured Demo

The **Study Buddy** tab showcases the full power of RunAnywhere's multimodal capabilities in a real-world application:

- **📸 Visual Learning**: Point your camera at textbooks, diagrams, notes, or problems
- **🎤 Natural Conversation**: Ask questions via voice and get spoken responses
- **🧠 Context-Aware**: AI sees what you're studying and maintains context across the conversation
- **🔒 100% Private**: All processing happens on-device - your study material never leaves your browser
- **📖 Three Study Modes**:
  - **Explain**: Get detailed explanations of concepts
  - **Quiz Me**: AI generates questions to test your understanding
  - **Solve Step-by-Step**: Walk through problems with guided hints

Perfect for studying offline, privacy-sensitive material, or when you need an AI tutor that's always available.

👉 **[See Testing Guide](./STUDY_BUDDY_TEST_GUIDE.md)** for detailed usage instructions and testing scenarios.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Models are downloaded on first use and cached in the browser's Origin Private File System (OPFS).

## How It Works

```
@runanywhere/web (npm package)
  ├── WASM engine (llama.cpp, whisper.cpp, sherpa-onnx)
  ├── Model management (download, OPFS cache, load/unload)
  └── TypeScript API (TextGeneration, STT, TTS, VAD, VLM, VoicePipeline)
```

The app imports everything from `@runanywhere/web`:

```typescript
import { RunAnywhere, SDKEnvironment } from '@runanywhere/web';
import { TextGeneration, VLMWorkerBridge } from '@runanywhere/web-llamacpp';

await RunAnywhere.initialize({ environment: SDKEnvironment.Development });

// Stream LLM text
const { stream } = await TextGeneration.generateStream('Hello!', { maxTokens: 200 });
for await (const token of stream) { console.log(token); }

// VLM: describe an image
const result = await VLMWorkerBridge.shared.process(rgbPixels, width, height, 'Describe this.');
```

## Project Structure

```
src/
├── main.tsx                # React root
├── App.tsx                 # Tab navigation (Study Buddy | Chat | Vision | Voice | Tools)
├── runanywhere.ts          # SDK init + model catalog + VLM worker
├── workers/
│   └── vlm-worker.ts       # VLM Web Worker entry (2 lines)
├── hooks/
│   └── useModelLoader.ts   # Shared model download/load hook
├── components/
│   ├── StudyBuddyTab.tsx   # 🆕 AI study companion (Vision + Voice + Context)
│   ├── ChatTab.tsx         # LLM streaming chat
│   ├── VisionTab.tsx       # Camera + VLM inference
│   ├── VoiceTab.tsx        # Full voice pipeline
│   ├── ToolsTab.tsx        # Function calling demos
│   └── ModelBanner.tsx     # Download progress UI
└── styles/
    └── index.css           # Dark theme CSS + Study Buddy styles
```

## Adding Your Own Models

Edit the `MODELS` array in `src/runanywhere.ts`:

```typescript
{
  id: 'my-custom-model',
  name: 'My Model',
  repo: 'username/repo-name',           // HuggingFace repo
  files: ['model.Q4_K_M.gguf'],         // Files to download
  framework: LLMFramework.LlamaCpp,
  modality: ModelCategory.Language,      // or Multimodal, SpeechRecognition, etc.
  memoryRequirement: 500_000_000,        // Bytes
}
```

Any GGUF model compatible with llama.cpp works for LLM/VLM. STT/TTS/VAD use sherpa-onnx models.

## Deployment

### Vercel

```bash
npm run build
npx vercel --prod
```

The included `vercel.json` sets the required Cross-Origin-Isolation headers.

### Netlify

Add a `_headers` file:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
```

### Any static host

Serve the `dist/` folder with these HTTP headers on all responses:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

## Browser Requirements

- Chrome 96+ or Edge 96+ (recommended: 120+)
- WebAssembly (required)
- SharedArrayBuffer (requires Cross-Origin Isolation headers)
- OPFS (for persistent model cache)

## Documentation

- [SDK API Reference](https://docs.runanywhere.ai)
- [npm package](https://www.npmjs.com/package/@runanywhere/web)
- [GitHub](https://github.com/RunanywhereAI/runanywhere-sdks)

## License

MIT
