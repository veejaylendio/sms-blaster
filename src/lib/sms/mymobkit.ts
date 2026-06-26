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

export async function sendSmsViaMymobkit(
  gatewayUrl: string,
  to: string,
  message: string,
  slot?: number
): Promise<MymobkitResponse> {
  // Ensure gatewayUrl doesn't end with a slash for consistency
  const baseUrl = gatewayUrl.replace(/\/$/, '');
  const url = `${baseUrl}/services/api/messaging/`;

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('Message', message);
  if (slot) {
    params.append('Slot', slot.toString());
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mymobkit API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
