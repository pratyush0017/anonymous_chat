const socket = io();
let currentRoom = null;
let cooldown = false;
let typingTimer = null; // prevents instant rematch spam

document.body.classList.add('on-role');

// Role screen buttons
document.getElementById('btn-talker').addEventListener('click', function() {
  showScreen('topic');
});

document.getElementById('btn-listener').addEventListener('click', function() {
  if (cooldown) return;
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

// Cancel — sends user back from waiting screen to role screen
document.getElementById('btn-cancel').addEventListener('click', function() {
  cancelWait();
});

// End chat button
document.getElementById('btn-end').addEventListener('click', function() {
  endChat();
});

// Send message
document.getElementById('btn-send').addEventListener('click', function() {
  sendMessage();
});
document.getElementById('msgInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    sendMessage();
    return;
  }

  // Tell partner you are typing
  if (currentRoom) {
    socket.emit('typing', currentRoom);
  }

  // Stop typing after 1.5 seconds of no keypress
  clearTimeout(typingTimer);
  typingTimer = setTimeout(function() {
    if (currentRoom) {
      socket.emit('stop_typing', currentRoom);
    }
  }, 1500);
});


// ── Functions ──

function joinAsTalker(topic) {
  if (cooldown) return;
  socket.emit('join', { role: 'talker', topic: topic });
  showScreen('waiting');
}

function cancelWait() {
  // Tell server to remove from queue
  socket.emit('cancel');
  showScreen('role');
}

function endChat() {
  if (!currentRoom) return;
  socket.emit('leave', currentRoom);
  currentRoom = null;
  clearChat();
  startCooldown(); // 3 second cooldown before they can rejoin
  showScreen('role');
  showCooldownMessage();
}

function clearChat() {
  document.getElementById('messages').innerHTML = '';
}

function startCooldown() {
  cooldown = true;
  setTimeout(function() {
    cooldown = false;
  }, 3000); // 3 seconds
}

function showCooldownMessage() {
  // Show a small message on role screen that fades away
  const existing = document.getElementById('cooldown-msg');
  if (existing) existing.remove();

  const msg = document.createElement('p');
  msg.id = 'cooldown-msg';
  msg.innerText = 'You can start a new conversation in 3 seconds...';
  msg.style.cssText = 'text-align:center; font-size:12px; color:#666; margin-top:16px;';
  document.getElementById('screen-role').appendChild(msg);

  setTimeout(function() {
    msg.innerText = 'Ready. Pick a role above to start again.';
    msg.style.color = '#5dba7a';
  }, 3000);

  setTimeout(function() {
    if (msg.parentNode) msg.remove();
  }, 6000);
}

function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !currentRoom) return;
  socket.emit('message', { room: currentRoom, text });
  socket.emit('stop_typing', currentRoom);
  clearTimeout(typingTimer);
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

// ── Socket events ──

socket.on('matched', function({ room, topic }) {
  currentRoom = room;
  showScreen('chat');

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

  const btn = document.createElement('button');
  btn.innerText = 'Find a new match';
  btn.style.cssText = `
    display: block;
    margin: 12px auto;
    background: #1e3a5f;
    color: #7aaee8;
    border: none;
    padding: 10px 20px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
  `;

  btn.addEventListener('click', function() {
    currentRoom = null;
    clearChat();

    // Switch to waiting screen with connecting message
    const waitingTitle = document.querySelector('#screen-waiting h2');
    const waitingSubtitle = document.querySelector('#screen-waiting p');
    waitingTitle.innerText = 'Connecting...';
    waitingTitle.style.fontWeight = 'bold';
    waitingSubtitle.innerText = 'Please wait while we find someone new for you.';
    waitingSubtitle.style.color = '#888';

    showScreen('waiting');

    // Auto rejoin as listener
    setTimeout(function() {
      socket.emit('join', { role: 'listener', topic: null });
    }, 1000);
  });

  document.getElementById('messages').appendChild(btn);
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
  socket.on('typing', function() {
  document.getElementById('typing-indicator').style.display = 'block';
});

socket.on('stop_typing', function() {
  document.getElementById('typing-indicator').style.display = 'none';
});
});