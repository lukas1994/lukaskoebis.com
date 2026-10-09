// An intentionally stateless-in-practice relay: each Durable Object holds at
// most two live WebSockets for one table and never writes poker data to storage.
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/table\/([a-z0-9-]{4,64})$/i);
    if (!match) return new Response("Heads Up relay", { status: 404 });
    const id = env.TABLE.idFromName(match[1]);
    return env.TABLE.get(id).fetch(request);
  },
};

export class PokerTable {
  constructor() {
    this.clients = new Set();
  }

  fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (this.clients.size >= 2) return new Response("Table is full", { status: 409 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.clients.add(server);
    this.broadcast({ type: "presence", count: this.clients.size });

    server.addEventListener("message", (event) => {
      // The relay has no game knowledge and never persists payloads.
      for (const other of this.clients) {
        if (other !== server) {
          try { other.send(event.data); } catch { this.clients.delete(other); }
        }
      }
    });
    const remove = () => { this.clients.delete(server); this.broadcast({ type: "presence", count: this.clients.size }); };
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      try { client.send(data); } catch { this.clients.delete(client); }
    }
  }
}
