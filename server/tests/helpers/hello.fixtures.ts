import type {
  HelloRequest,
  HelloResponse,
} from '../../src/features/hello/types/hello.types.js';

export const helloRequest: HelloRequest = {
  message: 'Hello from client',
};

export const helloResponse: HelloResponse = {
  message: 'Hello from server',
  received: helloRequest.message,
};
