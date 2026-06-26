import http from 'http';
import https from 'https';

export interface MymobkitResponse {
  message?: {
    date: string;
    to: string;
    id: string;
    number: string;
    message: string;
    read: boolean;
  };
  description: string;
  requestMethod: string;
  isSuccessful: boolean;
}

function postRequest(
  url: string,
  body: string,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body).toString(),
          'Connection': 'close',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            text: data,
          })
        );
      }
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.write(body);
    req.end();
  });
}

export async function sendSmsViaMymobkit(
  gatewayUrl: string,
  to: string,
  message: string,
  slot?: number
): Promise<MymobkitResponse> {
  const baseUrl = gatewayUrl.replace(/\/$/, '');
  const url = `${baseUrl}/services/api/messaging/`;

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('Message', message);
  if (slot) {
    params.append('Slot', slot.toString());
  }

  const body = params.toString();
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await postRequest(url, body, 30000);

      if (!res.ok) {
        throw new Error(`Mymobkit API error: ${res.status} ${res.text}`);
      }

      return JSON.parse(res.text) as MymobkitResponse;
    } catch (err: any) {
      lastError = err;

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
    }
  }

  throw lastError ?? new Error('Unknown error sending SMS via Mymobkit');
}
