// Simple MLLP listener for manual testing.
// Usage: node test/mllp-listener.js [port]
//
// Accepts one MLLP-framed HL7 message, prints it, and responds with an ACK.

const net = require('net');

const SB = '\x0b';
const EB = '\x1c';
const CR = '\x0d';
const port = parseInt(process.argv[2], 10) || 2575;

const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', (data) => {
        buffer += data.toString();
        if (!buffer.includes(EB)) return;

        const start = buffer.indexOf(SB);
        const end = buffer.indexOf(EB);
        const message = buffer.substring(start === -1 ? 0 : start + 1, end);

        console.log('--- Received message ---');
        console.log(message.replace(/\r/g, '\n'));

        // Build a minimal ACK
        const fields = message.split('\r')[0].split('|');
        const ack = [
            `MSH|^~\\&|ACK||${fields[3] || ''}|${fields[4] || ''}|${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}||ACK|${fields[9] || ''}|P|2.5.1`,
            `MSA|AA|${fields[9] || ''}`,
        ].join('\r');

        socket.write(SB + ack + EB + CR);
        console.log('--- Sent ACK ---');
        console.log(ack.replace(/\r/g, '\n'));
    });
});

server.listen(port, () => {
    console.log(`MLLP listener running on port ${port}`);
});
