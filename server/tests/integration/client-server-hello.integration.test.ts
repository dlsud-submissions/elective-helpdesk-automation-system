import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sendHello } from '../../../client/src/features/hello/api/hello.api';
import { app } from '../../src/app.js';
import { helloRequest, helloResponse } from '../helpers/hello.fixtures.js';

describe('client to server hello round trip', () => {
  let server: Server;
  let apiUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    apiUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('sends the client greeting over HTTP and receives the server reply', async () => {
    await expect(sendHello(apiUrl, helloRequest.message)).resolves.toEqual(
      helloResponse
    );
  });
});
