import { createServer, connect, type Socket } from 'node:net';

// Fault injection affects only connections created by this test, never the shared Redis server or another logical DB.
export async function createRedisTestProxy(targetPort: number) {
  const sockets = new Set<Socket>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let delay = 0;
  const server = createServer((incoming) => {
    const outgoing = connect({ host: '127.0.0.1', port: targetPort });
    sockets.add(incoming);
    sockets.add(outgoing);
    for (const socket of [incoming, outgoing]) {
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    }
    incoming.on('close', () => outgoing.destroy());
    outgoing.on('close', () => incoming.destroy());
    incoming.on('data', (data: Buffer) => {
      const write = () => {
        if (!outgoing.destroyed) outgoing.write(data);
      };
      if (!delay) write();
      else {
        const timer = setTimeout(() => {
          timers.delete(timer);
          write();
        }, delay);
        timers.add(timer);
      }
    });
    outgoing.pipe(incoming);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('테스트 proxy 시작 실패');
  return {
    port: address.port,
    setDelay: (ms: number) => {
      delay = ms;
    },
    dropConnections: () => {
      for (const socket of sockets) socket.destroy();
    },
    close: async () => {
      for (const timer of timers) clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
