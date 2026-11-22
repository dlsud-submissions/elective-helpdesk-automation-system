import type { HelloResponse } from '../types/hello.types.js';

export function validateHelloMessage(message: unknown): string {
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('A non-empty message is required.');
  }

  return message;
}

export function createHelloResponse(message: string): HelloResponse {
  return {
    message: 'Hello from server',
    received: message,
  };
}
