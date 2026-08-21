import { config } from './index.js';

const runtime = new Map<string, string>();

export function getSetting(key: string): string {
  return runtime.get(key) ?? '';
}

export function setSetting(key: string, value: string) {
  runtime.set(key, value);
}

export function initSettings() {
  if (config.masterCode) {
    runtime.set('masterCode', config.masterCode);
  }
}
