import { useState, useCallback, useEffect } from 'react';
import { ModelManager, ModelCategory, EventBus } from '@runanywhere/web';
import { TextGeneration, VLMWorkerBridge } from '@runanywhere/web-llamacpp';

export type LoaderState = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

interface SharedAIState {
  state: LoaderState;
  progress: number;
  error: string | null;
}

let sharedInstance: {
  state: LoaderState;
  progress: number;
  error: string | null;
  loadingRef: boolean;
  ensureLanguage: () => Promise<boolean>;
  ensureVision: () => Promise<boolean>;
  isReady: () => boolean;
} | null = null;

function createSharedAIInstance() {
  if (sharedInstance) return sharedInstance;

  const stateRef = { current: 'idle' as LoaderState };
  const progressRef = { current: 0 };
  const errorRef = { current: null as string | null };
  const loadingRef = { current: false };
  const visionLoadingRef = { current: false };

  const ensureLanguage = useCallback(async (): Promise<boolean> => {
    if (ModelManager.getLoadedModel(ModelCategory.Language)) {
      stateRef.current = 'ready';
      return true;
    }

    if (loadingRef.current) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (stateRef.current === 'ready' || stateRef.current === 'error') {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
      return stateRef.current === 'ready';
    }

    loadingRef.current = true;
    stateRef.current = 'loading';

    try {
      const models = ModelManager.getModels().filter(m => m.modality === ModelCategory.Language);
      if (models.length === 0) {
        throw new Error('No language model registered');
      }

      const model = models[0];

      if (model.status !== 'downloaded' && model.status !== 'loaded') {
        stateRef.current = 'downloading';
        
        const unsub = EventBus.shared.on('model.downloadProgress', (evt) => {
          if (evt.modelId === model.id) {
            progressRef.current = evt.progress ?? 0;
          }
        });

        await ModelManager.downloadModel(model.id);
        unsub();
        progressRef.current = 1;
      }

      stateRef.current = 'loading';
      const ok = await ModelManager.loadModel(model.id);
      
      if (ok) {
        stateRef.current = 'ready';
        return true;
      } else {
        throw new Error('Failed to load model');
      }
    } catch (err) {
      errorRef.current = err instanceof Error ? err.message : String(err);
      stateRef.current = 'error';
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const ensureVision = useCallback(async (): Promise<boolean> => {
    if (ModelManager.getLoadedModel(ModelCategory.Multimodal)) {
      stateRef.current = 'ready';
      return true;
    }

    if (visionLoadingRef.current) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (stateRef.current === 'ready' || stateRef.current === 'error') {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
      return stateRef.current === 'ready';
    }

    visionLoadingRef.current = true;
    stateRef.current = 'loading';

    try {
      const models = ModelManager.getModels().filter(m => m.modality === ModelCategory.Multimodal);
      if (models.length === 0) {
        throw new Error('No vision model registered');
      }

      const model = models[0];

      if (model.status !== 'downloaded' && model.status !== 'loaded') {
        stateRef.current = 'downloading';
        
        const unsub = EventBus.shared.on('model.downloadProgress', (evt) => {
          if (evt.modelId === model.id) {
            progressRef.current = evt.progress ?? 0;
          }
        });

        await ModelManager.downloadModel(model.id);
        unsub();
        progressRef.current = 1;
      }

      stateRef.current = 'loading';
      const ok = await ModelManager.loadModel(model.id);
      
      if (ok) {
        stateRef.current = 'ready';
        return true;
      } else {
        throw new Error('Failed to load vision model');
      }
    } catch (err) {
      errorRef.current = err instanceof Error ? err.message : String(err);
      stateRef.current = 'error';
      return false;
    } finally {
      visionLoadingRef.current = false;
    }
  }, []);

  const isReady = () => stateRef.current === 'ready';

  sharedInstance = {
    get state() { return stateRef.current; },
    get progress() { return progressRef.current; },
    get error() { return errorRef.current; },
    get loadingRef() { return loadingRef.current; },
    ensureLanguage,
    ensureVision,
    isReady
  };

  return sharedInstance;
}

export function useSharedAI() {
  const instance = createSharedAIInstance();
  
  const [state, setState] = useState<LoaderState>(instance.state);
  const [progress, setProgress] = useState(instance.progress);
  const [error, setError] = useState<string | null>(instance.error);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(instance.state);
      setProgress(instance.progress);
      setError(instance.error);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const ensure = useCallback(async (type: 'language' | 'vision' = 'language') => {
    if (type === 'vision') {
      return instance.ensureVision();
    }
    return instance.ensureLanguage();
  }, []);

  return {
    state,
    progress,
    error,
    ensure,
    isReady: instance.isReady
  };
}

export function useTextGeneration() {
  const { ensure, state, isReady } = useSharedAI();

  const generate = useCallback(async (prompt: string, options?: { maxTokens?: number; temperature?: number }) => {
    await ensure('language');
    
    if (!isReady()) {
      throw new Error('Model not ready');
    }

    const { result } = await TextGeneration.generateStream(prompt, {
      maxTokens: options?.maxTokens ?? 150,
      temperature: options?.temperature ?? 0.7
    });

    return (await result).text;
  }, [ensure, isReady]);

  const generateStream = useCallback(async (prompt: string, options?: { maxTokens?: number; temperature?: number }) => {
    await ensure('language');
    
    if (!isReady()) {
      throw new Error('Model not ready');
    }

    return TextGeneration.generateStream(prompt, {
      maxTokens: options?.maxTokens ?? 150,
      temperature: options?.temperature ?? 0.7
    });
  }, [ensure, isReady]);

  return { generate, generateStream, isReady, state };
}

export function useVision() {
  const { ensure, state, isReady } = useSharedAI();

  const analyzeImage = useCallback(async (imageBase64: string, prompt: string) => {
    await ensure('vision');
    
    if (!isReady()) {
      throw new Error('Vision model not ready');
    }

    const img = new Image();
    img.src = imageBase64;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const rgbPixels = new Uint8Array(imageData.data);

    const result = await VLMWorkerBridge.shared.process(
      rgbPixels, 
      img.width, 
      img.height, 
      prompt,
      { maxTokens: 512, temperature: 0.3 }
    );
    
    return result.text;
  }, [ensure, isReady]);

  return { analyzeImage, isReady, state };
}
