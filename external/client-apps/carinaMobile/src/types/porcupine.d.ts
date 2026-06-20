declare module '@picovoice/porcupine-react-native' {
  const PorcupineManager: {
    fromBuiltInKeywords: (
      accessKey: string,
      keywords: string[],
      callback: (keywordIndex: number) => void,
      processError?: (error: unknown) => void,
    ) => Promise<{
      start: () => Promise<void>;
      stop: () => Promise<void>;
      delete: () => Promise<void>;
    }>;
  };
  export default PorcupineManager;
}
