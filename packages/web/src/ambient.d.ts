declare module '@gatanot/qualia_web/handler' {
  import type { IncomingMessage, ServerResponse } from 'node:http';
  export const handler: (req: IncomingMessage, res: ServerResponse) => void;
}

declare module '@gatanot/qualia_web' {
  export { handler } from '@gatanot/qualia_web/handler';
}
