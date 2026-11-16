import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';

type UserStatus = 'active' | 'inactive';
type RequestBodyErrorStatus = 400 | 413 | 415;

interface CreateUserRequest {
  name: string;
  email: string;
  status: UserStatus;
}

interface User extends CreateUserRequest {
  id: number;
}

const port = Number(process.env.PORT ?? 3000);
const MAX_USER_ID = 999_999;
const MAX_BODY_BYTES = 100 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const users = new Map<number, User>();
const uiPath = join(__dirname, '..', 'public', 'index.html');
let nextUserId = 1;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new RangeError('PORT must be an integer between 1 and 65535.');
}

class RequestBodyError extends Error {
  constructor(
    readonly status: RequestBodyErrorStatus,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'RequestBodyError';
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: object,
  headers: Record<string, string> = {}
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {}
): void {
  sendJson(response, status, { code, message }, headers);
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
    });

    request.on('end', () => {
      if (tooLarge) {
        reject(
          new RequestBodyError(
            413,
            'PAYLOAD_TOO_LARGE',
            'Request body must not exceed 100 KiB.'
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
      } catch {
        reject(new RequestBodyError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      }
    });

    request.on('error', reject);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateUser(body: unknown): CreateUserRequest | string {
  if (!isRecord(body)) {
    return 'Request body must be a JSON object.';
  }

  const { name, email, status } = body;
  if (typeof name !== 'string' || name.length < 1) {
    return 'name must be a non-empty string.';
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
    return 'email must be a valid email address.';
  }
  if (status !== 'active' && status !== 'inactive') {
    return 'status must be active or inactive.';
  }

  return { name, email, status };
}

function isJsonRequest(request: IncomingMessage): boolean {
  const contentType = request.headers['content-type'];
  return typeof contentType === 'string' && /^application\/json(?:\s*;|$)/i.test(contentType);
}

async function readUserRequest(request: IncomingMessage): Promise<CreateUserRequest> {
  if (!isJsonRequest(request)) {
    throw new RequestBodyError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.'
    );
  }

  const validation = validateUser(await readJsonBody(request));
  if (typeof validation === 'string') {
    throw new RequestBodyError(400, 'INVALID_USER', validation);
  }
  return validation;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

  if (pathname === '/' && request.method === 'GET') {
    const page = await readFile(uiPath);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }

  if (pathname === '/api/users') {
    if (request.method === 'GET') {
      sendJson(response, 200, [...users.values()]);
      return;
    }

    if (request.method !== 'POST') {
      sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Only GET and POST are allowed for this path.', {
        Allow: 'GET, POST',
      });
      return;
    }

    let newUser: CreateUserRequest;
    try {
      newUser = await readUserRequest(request);
    } catch (error: unknown) {
      if (!(error instanceof RequestBodyError)) {
        throw error;
      }
      sendError(response, error.status, error.code, error.message);
      return;
    }

    if (nextUserId > MAX_USER_ID) {
      sendError(response, 503, 'ID_SPACE_EXHAUSTED', 'No more user IDs are available.');
      return;
    }

    const user: User = {
      id: nextUserId,
      ...newUser,
    };
    users.set(user.id, user);
    nextUserId += 1;
    sendJson(response, 201, user);
    return;
  }

  const userPath = /^\/api\/users\/([^/]+)$/.exec(pathname);
  if (userPath) {
    const rawId = userPath[1];
    if (!rawId || !/^[1-9]\d{0,5}$/.test(rawId)) {
      sendError(response, 404, 'USER_NOT_FOUND', 'No user exists with the specified ID.');
      return;
    }
    const id = Number(rawId);

    if (request.method === 'GET') {
      const user = users.get(id);
      if (!user) {
        sendError(response, 404, 'USER_NOT_FOUND', 'No user exists with the specified ID.');
        return;
      }
      sendJson(response, 200, user);
      return;
    }

    if (request.method === 'PUT') {
      if (!users.has(id)) {
        sendError(response, 404, 'USER_NOT_FOUND', 'No user exists with the specified ID.');
        return;
      }

      let replacement: CreateUserRequest;
      try {
        replacement = await readUserRequest(request);
      } catch (error: unknown) {
        if (!(error instanceof RequestBodyError)) {
          throw error;
        }
        sendError(response, error.status, error.code, error.message);
        return;
      }

      const updatedUser: User = { id, ...replacement };
      users.set(id, updatedUser);
      sendJson(response, 200, updatedUser);
      return;
    }

    if (request.method === 'DELETE') {
      if (!users.delete(id)) {
        sendError(response, 404, 'USER_NOT_FOUND', 'No user exists with the specified ID.');
        return;
      }
      response.writeHead(204);
      response.end();
      return;
    }

    sendError(
      response,
      405,
      'METHOD_NOT_ALLOWED',
      'Only GET, PUT, and DELETE are allowed for this path.',
      { Allow: 'GET, PUT, DELETE' }
    );
    return;
  }

  sendError(response, 404, 'NOT_FOUND', 'Route not found.');
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    const serverError =
      error instanceof Error ? error : new Error('An unknown request error occurred.');
    console.error('Unhandled API request error:', serverError);

    if (!response.headersSent) {
      sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.');
    } else {
      response.destroy(serverError);
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`User Management API listening on http://127.0.0.1:${port}`);
});
