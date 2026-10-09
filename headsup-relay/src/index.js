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
  constructor(state) {
    this.state = state;
  }

  fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (this.state.getWebSockets().length >= 2) return new Response("Table is full", { status: 409 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernation keeps sockets alive without billing idle object duration.
    this.state.acceptWebSocket(server);
    this.broadcast({ type: "presence", count: this.state.getWebSockets().length });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    // The relay has no game knowledge and never persists payloads.
    for (const other of this.state.getWebSockets()) if (other !== socket) other.send(message);
  }

  webSocketClose(socket) {
    const clients = this.state.getWebSockets();
    const update = JSON.stringify({ type: "presence", count: clients.length - 1 });
    for (const other of clients) if (other !== socket) other.send(update);
    socket.close(1000, "Table connection closed");
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.state.getWebSockets()) client.send(data);
  }
}
