const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('client'));

let talkerQueue = [];
let listenerQueue = [];

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join', (role) => {
    console.log(socket.id, 'joined as', role);

    if (role === 'talker') {
      if (listenerQueue.length > 0) {
        const listener = listenerQueue.shift();
        const room = socket.id + '#' + listener.id;
        socket.join(room);
        listener.join(room);
        io.to(room).emit('matched', room);
        console.log('Matched:', socket.id, 'with', listener.id);
      } else {
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
        io.to(room).emit('matched', room);
        console.log('Matched:', socket.id, 'with', talker.id);
      } else {
        listenerQueue.push(socket);
        socket.emit('waiting');
      }
    }
  });

  // ✅ NEW: relay message only to the partner in the same room
  socket.on('message', ({ room, text }) => {
    if (!text || !room) return;
    console.log('Message in room', room, ':', text);
    socket.to(room).emit('message', text); // send to partner only, not yourself
  });
  // Add this after the message handler
  socket.on('leave', (room) => {
    socket.to(room).emit('partner_left');
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    talkerQueue = talkerQueue.filter(s => s.id !== socket.id);
    listenerQueue = listenerQueue.filter(s => s.id !== socket.id);
    console.log('Disconnected:', socket.id);
  });

});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});