import type { Handler, HandlerEvent } from '@netlify/functions';

import config from '../../config/kit-config.json';

const KIT_API_BASE = 'https://api.kit.com/v4';

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'The specified HTTP method is not allowed.' })
    };
  }

  const apiKey = process.env.KIT_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Newsletter service is not configured.' })
    };
  }

  const { email, name, interest } = JSON.parse(event.body || '{}');

  if (!email) {
    return {
      statusCode: 422,
      body: JSON.stringify({ message: 'Email address is required.' })
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey
  };

  try {
    const subscriberResponse = await fetch(`${KIT_API_BASE}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email_address: email,
        first_name: name || undefined,
        state: 'active'
      })
    });

    const subscriberData = await subscriberResponse.json();

    if (!subscriberResponse.ok) {
      return {
        statusCode: subscriberResponse.status,
        body: JSON.stringify(subscriberData)
      };
    }

    const tagId = config.tags[interest as keyof typeof config.tags];

    if (tagId) {
      const tagResponse = await fetch(`${KIT_API_BASE}/tags/${tagId}/subscribers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email_address: email })
      });

      if (!tagResponse.ok) {
        const tagError = await tagResponse.json();

        return {
          statusCode: tagResponse.status,
          body: JSON.stringify(tagError)
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(subscriberData)
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';

    return {
      statusCode: 500,
      body: JSON.stringify({ message })
    };
  }
};
