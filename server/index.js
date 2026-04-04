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

const PORT = process.env.PORT || 3000;

leoProfanity.loadDictionary();

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
    console.log(socket.id, 'joined as', role, '| topic:', topic);

    if (role === 'talker') {
      if (listenerQueue.length > 0) {
        const listener = listenerQueue.shift();
        const room = socket.id + '#' + listener.id;
        socket.join(room);
        listener.join(room);
        listener.emit('matched', { room, topic });
        socket.emit('matched', { room, topic: null });
        console.log('Matched:', socket.id, 'with', listener.id);
      } else {
        socket.topic = topic;
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
        socket.emit('matched', { room, topic: talker.topic });
        talker.emit('matched', { room, topic: null });
        console.log('Matched:', socket.id, 'with', talker.id);
      } else {
        listenerQueue.push(socket);
        socket.emit('waiting');
      }
    }
  });

  socket.on('cancel', () => {
    talkerQueue = talkerQueue.filter(s => s.id !== socket.id);
    listenerQueue = listenerQueue.filter(s => s.id !== socket.id);
    console.log(socket.id, 'cancelled — removed from queue');
  });
  socket.on('typing', (room) => {
    socket.to(room).emit('typing');
  });

  socket.on('stop_typing', (room) => {
    socket.to(room).emit('stop_typing');
  });

  socket.on('message', ({ room, text }) => {
    if (!text || !room) return;
    if (text.length > 500) return;

    messageCount[socket.id]++;
    setTimeout(() => {
      if (messageCount[socket.id] > 0) messageCount[socket.id]--;
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
    if (!room) return;
    socket.to(room).emit('partner_left');
    socket.leave(room);
    console.log(socket.id, 'left room:', room);
  });

  socket.on('disconnect', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(room => {
      socket.to(room).emit('partner_left');
    });
    talkerQueue = talkerQueue.filter(s => s.id !== socket.id);
    listenerQueue = listenerQueue.filter(s => s.id !== socket.id);
    delete messageCount[socket.id];
    console.log('Disconnected:', socket.id);
  });

});

server.listen(PORT, () => {
  console.log('Running on port', PORT);
});