const socket = io();
let currentRoom = null;

// Show background on load
document.body.classList.add('on-role');

// Button listeners — no onclick in HTML
document.getElementById('btn-talker').addEventListener('click', function() {
  join('talker');
});

document.getElementById('btn-listener').addEventListener('click', function() {
  join('listener');
});

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
function join(role) {
  socket.emit('join', role);
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
  if (name === 'role') {
    document.body.classList.add('on-role');
  } else {
    document.body.classList.remove('on-role');
  }
}

// Socket events
socket.on('matched', function(room) {
  currentRoom = room;
  showScreen('chat');
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