const socket = io();
let currentRoom = null;

document.body.classList.add('on-role');

// Role screen buttons
document.getElementById('btn-talker').addEventListener('click', function() {
  showScreen('topic'); // talker goes to topic selection first
});

document.getElementById('btn-listener').addEventListener('click', function() {
  socket.emit('join', { role: 'listener', topic: null });
  showScreen('waiting');
});

// Topic cards
document.getElementById('topic-stress').addEventListener('click', function() {
  joinAsTalker('Stress / Academics');
});
document.getElementById('topic-relations').addEventListener('click', function() {
  joinAsTalker('Family & Relationships');
});
document.getElementById('topic-lonely').addEventListener('click', function() {
  joinAsTalker('Loneliness');
});
document.getElementById('topic-vent').addEventListener('click', function() {
  joinAsTalker('Just venting');
});

// Cancel and end buttons
document.getElementById('btn-cancel').addEventListener('click', function() {
  cancelWait();
});
document.getElementById('btn-end').addEventListener('click', function() {
  endChat();
});
document.getElementById('btn-send').addEventListener('click', function() {
  sendMessage();
});
document.getElementById('msgInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendMessage();
});

// Functions
function joinAsTalker(topic) {
  socket.emit('join', { role: 'talker', topic: topic });
  showScreen('waiting');
}

function cancelWait() {
  socket.disconnect();
  socket.connect();
  showScreen('role');
}

function endChat() {
  socket.emit('leave', currentRoom);
  currentRoom = null;
  document.getElementById('messages').innerHTML = '';
  showScreen('role');
}

function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !currentRoom) return;
  socket.emit('message', { room: currentRoom, text });
  addMessage(text, 'me');
  input.value = '';
}

function addMessage(text, sender) {
  const div = document.createElement('div');
  div.className = 'bubble ' +
    (sender === 'me' ? 'bubble-me' : sender === 'them' ? 'bubble-them' : 'bubble-system');
  div.innerText = text;
  const box = document.getElementById('messages');
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function(s) {
    s.classList.remove('active');
  });
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'role' || name === 'topic') {
    document.body.classList.add('on-role');
  } else {
    document.body.classList.remove('on-role');
  }
}

// Socket events
socket.on('matched', function({ room, topic }) {
  currentRoom = room;
  showScreen('chat');

  // If listener, show what the talker wants to talk about
  if (topic) {
    const banner = document.createElement('div');
    banner.className = 'topic-banner';
    banner.innerText = 'This person wants to talk about: ' + topic;
    document.getElementById('messages').appendChild(banner);
  }

  addMessage('You are now connected. Say hello.', 'system');
});

socket.on('partner_left', function() {
  addMessage('Your partner has disconnected.', 'system');
  setTimeout(function() {
    currentRoom = null;
    document.getElementById('messages').innerHTML = '';
    showScreen('role');
  }, 2000);
});

socket.on('message', function(text) {
  addMessage(text, 'them');
});

socket.on('crisis_alert', function(helpline) {
  const banner = document.createElement('div');
  banner.className = 'crisis-banner';
  banner.innerText = 'If you or someone needs help — ' + helpline;
  document.getElementById('messages').appendChild(banner);
});

socket.on('error_msg', function(msg) {
  addMessage(msg, 'system');
});