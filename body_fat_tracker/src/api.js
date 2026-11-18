import Constants from 'expo-constants';

export function analysisBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_ANALYSIS_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri;
  if (!host) throw new Error('Open this project from the running Expo development server.');
  const secure = /\.exp\.direct(?::\d+)?$/.test(host);
  return `${secure ? 'https' : 'http'}://${host}/bodyfat-api`;
}

export async function requestAnalysis(route, payload, { signal, method = 'POST' } = {}) {
  const token = process.env.EXPO_PUBLIC_SCAN_TOKEN;
  if (!token) throw new Error('Analysis is not connected. Restart Expo with npm start or npm run start:tunnel.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 60000);
  try {
    const response = await fetch(`${analysisBaseUrl()}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: method === 'GET' ? undefined : JSON.stringify(payload), signal: controller.signal,
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The analysis service returned an unreadable response. Restart the development server.'); }
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : 'Check your measurements and try again.';
      throw new Error(detail);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Analysis was cancelled or timed out. Please try again.');
    if (/network request failed|failed to fetch/i.test(error.message)) {
      throw new Error('Cannot reach analysis. Keep the computer server running and try reconnecting with its current QR code.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
