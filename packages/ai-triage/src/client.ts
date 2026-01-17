/**
 * Claude API Client
 * Wrapper for Anthropic Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

/**
 * Initialize Claude client
 */
export function initClient(apiKey: string): void {
  client = new Anthropic({
    apiKey,
  });
}

/**
 * Get the Claude client instance
 */
export function getClient(): Anthropic {
  if (!client) {
    throw new Error('Claude client not initialized. Call initClient first.');
  }
  return client;
}

/**
 * Generate a completion using Claude
 */
export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  } = {}
): Promise<string> {
  const anthropic = getClient();

  const {
    maxTokens = 4096,
    temperature = 0.3,
    model = 'claude-sonnet-4-20250514',
  } = options;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  // Extract text from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response');
  }

  return textContent.text;
}

/**
 * Generate a structured JSON completion
 */
export async function generateStructuredCompletion<T>(
  systemPrompt: string,
  userMessage: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  } = {}
): Promise<T> {
  const text = await generateCompletion(systemPrompt, userMessage, options);

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}
