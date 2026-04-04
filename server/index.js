require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const leoProfanity = require('leo-profanity');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
leoProfanity.loadDictionary(); 
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
app.use(express.static('client'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

let talkerQueue = [];
let listenerQueue = [];
const messageCount = {};

const crisisWords = [
  'suicide', 'kill myself', 'end my life',
  'want to die', 'cant go on', "can't go on"
];

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  messageCount[socket.id] = 0;

  socket.on('join', ({ role, topic }) => {
    if (role === 'talker') {
      if (listenerQueue.length > 0) {
        const listener = listenerQueue.shift();
        const room = socket.id + '#' + listener.id;
        socket.join(room);
        listener.join(room);
        // Send topic to listener, send room to talker
        listener.emit('matched', { room, topic });
        socket.emit('matched', { room, topic: null });
        console.log('Matched:', socket.id, 'with', listener.id, '| Topic:', topic);
      } else {
        socket.topic = topic; // store topic on socket for later
        talkerQueue.push(socket);
        socket.emit('waiting');
      }
    }

    if (role === 'listener') {
      if (talkerQueue.length > 0) {
        const talker = talkerQueue.shift();
        const room = socket.id + '#' + talker.id;
        socket.join(room);
        talker.join(room);
        // Send talker's stored topic to listener
        socket.emit('matched', { room, topic: talker.topic });
        talker.emit('matched', { room, topic: null });
        console.log('Matched:', socket.id, 'with', talker.id, '| Topic:', talker.topic);
      } else {
        listenerQueue.push(socket);
        socket.emit('waiting');
      }
    }
  });

  socket.on('message', ({ room, text }) => {
    if (!text || !room) return;
    if (text.length > 500) return;

    messageCount[socket.id]++;
    setTimeout(() => {
      if (messageCount[socket.id]) messageCount[socket.id]--;
    }, 3000);

    if (messageCount[socket.id] > 5) {
      socket.emit('error_msg', 'Sending too fast. Slow down.');
      return;
    }

    const clean = validator.stripLow(validator.escape(text));

    const isCrisis = crisisWords.some(w => clean.toLowerCase().includes(w));
    if (isCrisis) {
      io.to(room).emit('crisis_alert', 'iCall Helpline: 9152987821');
    }

    let safeText = clean;
    try { safeText = leoProfanity.clean(clean); } catch(e) {}

    socket.to(room).emit('message', safeText);
  });

  socket.on('leave', (room) => {
    socket.to(room).emit('partner_left');
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    talkerQueue = talkerQueue.filter(s => s.id !== socket.id);
    listenerQueue = listenerQueue.filter(s => s.id !== socket.id);
    delete messageCount[socket.id];
    console.log('Disconnected:', socket.id);
  });
});

server.listen(PORT, () => console.log('Running on port', PORT));
