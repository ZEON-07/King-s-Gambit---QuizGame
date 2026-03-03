(() => {
	const WS_PATH = '/ws';
	const PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const WS_URL = `${PROTOCOL}//${window.location.host}${WS_PATH}`;

	let socket = null;
	let reconnectTimer = null;
	const channels = new Map();

	function ensureSocket() {
		if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
			return;
		}

		socket = new WebSocket(WS_URL);

		socket.addEventListener('open', () => {
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}

			channels.forEach((_, channelName) => {
				socket.send(JSON.stringify({ type: 'subscribe', channel: channelName }));
			});
		});

		socket.addEventListener('message', (event) => {
			let payload;
			try {
				payload = JSON.parse(event.data);
			} catch (_) {
				return;
			}

			if (!payload || payload.type !== 'message' || !payload.channel) return;

			const listeners = channels.get(payload.channel);
			if (!listeners || listeners.size === 0) return;

			listeners.forEach((handler) => {
				if (typeof handler === 'function') {
					handler({ data: payload.data });
				}
			});
		});

		socket.addEventListener('close', () => {
			if (reconnectTimer) return;
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				ensureSocket();
			}, 800);
		});
	}

	function send(channelName, message) {
		ensureSocket();
		if (!socket) return;

		const packet = JSON.stringify({ type: 'message', channel: channelName, data: message });

		if (socket.readyState === WebSocket.OPEN) {
			socket.send(packet);
			return;
		}

		const onOpen = () => {
			socket.send(packet);
			socket.removeEventListener('open', onOpen);
		};

		socket.addEventListener('open', onOpen);
	}

	function createChannel(channelName) {
		ensureSocket();

		if (!channels.has(channelName)) {
			channels.set(channelName, new Set());
		}

		const listeners = channels.get(channelName);
		let onMessageHandler = null;

		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: 'subscribe', channel: channelName }));
		}

		return {
			postMessage(message) {
				send(channelName, message);
			},
			set onmessage(handler) {
				if (onMessageHandler) listeners.delete(onMessageHandler);
				onMessageHandler = typeof handler === 'function' ? handler : null;
				if (onMessageHandler) listeners.add(onMessageHandler);
			},
			get onmessage() {
				return onMessageHandler;
			},
			close() {
				if (onMessageHandler) listeners.delete(onMessageHandler);
			}
		};
	}

	window.createChannel = createChannel;
})();
