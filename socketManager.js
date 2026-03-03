const { WebSocketServer } = require('ws');

function setupSocketManager(httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws) => {
        ws.subscriptions = new Set();

        ws.on('message', (raw) => {
            let packet;
            try {
                packet = JSON.parse(raw.toString());
            } catch (_) {
                return;
            }

            if (!packet || !packet.type || !packet.channel) return;

            if (packet.type === 'subscribe') {
                ws.subscriptions.add(packet.channel);
                return;
            }

            if (packet.type === 'message') {
                const outgoing = JSON.stringify({
                    type: 'message',
                    channel: packet.channel,
                    data: packet.data
                });

                wss.clients.forEach((client) => {
                    if (
                        client.readyState === client.OPEN &&
                        client.subscriptions &&
                        client.subscriptions.has(packet.channel)
                    ) {
                        client.send(outgoing);
                    }
                });
            }
        });
    });

    return wss;
}

module.exports = { setupSocketManager };