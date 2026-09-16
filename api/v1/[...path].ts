import { createApiV1App } from '../../src/api/v1';

const apiV1App = createApiV1App();

export default function handler(req: unknown, res: unknown) {
  return apiV1App(req as never, res as never);
}
