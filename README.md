# user-management-with-api

The API contract is defined in [tests/api/openapi.json](./tests/api/openapi.json).

For the project structure, testing conventions, examples, and guidance for adding tests, see the [Playwright TypeScript Testing Guide](./docs/playwright-testing-guide.md).

Run the API locally with `npm start`. It listens on `http://127.0.0.1:3000` and
uses in-memory storage, so users are cleared when the server restarts.
The same address serves a mock UI for creating, retrieving, and deleting users.

Run the Playwright tests with `npm test`, or run only the API tests with
`npm run test:api`. Playwright starts the API automatically for test runs.

Run `npm run typecheck` to type-check the server, Playwright config, and tests.