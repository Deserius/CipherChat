import { config } from './config.ts';
import { createServer } from './index.ts';

const { server } = createServer();
server.listen(config.port, '0.0.0.0', () => {
  console.log(`CipherRoom listening on 0.0.0.0:${config.port}`);
});
