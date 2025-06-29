const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));
app.use(express.json());

const roomPasswords = {};

app.get('/', (req, res) => {
  const roomId = uuidv4();
  res.redirect(`/room/${roomId}`);
});

app.get('/room/:room', (req, res) => {
  res.sendFile(__dirname + '/public/room.html');
});

app.post('/validate-password', (req, res) => {
  const { roomId, password } = req.body;
  if (roomPasswords[roomId] === password) {
    res.json({ valid: true });
  } else {
    res.json({ valid: false });
  }
});

io.on('connection', socket => {
  socket.on('join-room', ({ roomId, password }) => {
    if (!roomPasswords[roomId]) {
      roomPasswords[roomId] = password || null;
    }
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);

    socket.on('message', (data) => {
      socket.to(roomId).emit('message', data);
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server started on port ${PORT}`));