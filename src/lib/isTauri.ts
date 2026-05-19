export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_IPC__' in window;
};
