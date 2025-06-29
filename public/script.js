const socket = io();
const roomId = window.location.pathname.split("/")[2];
const password = localStorage.getItem(`/room/${roomId}`) || "";

fetch('/validate-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ roomId, password })
}).then(res => res.json()).then(data => {
  if (!data.valid && password) {
    alert("Incorrect room password! Access denied.");
    window.location.href = "/";
  } else {
    joinRoom();
  }
});

function joinRoom() {
  socket.emit('join-room', { roomId, password });

  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localVideo.srcObject = stream;
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    });

  peer.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("message", { type: "candidate", candidate: e.candidate });
    }
  };

  socket.on("user-connected", async () => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("message", { type: "offer", offer });
  });

  socket.on("message", async data => {
    if (data.type === "offer") {
      await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("message", { type: "answer", answer });
    } else if (data.type === "answer") {
      await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === "candidate") {
      await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else if (data.type === "chat") {
      appendMessage("Partner", decrypt(data.message));
    }
  });

  const messageInput = document.getElementById("messageInput");
  const messagesDiv = document.getElementById("messages");

  window.sendMessage = function() {
    const msg = messageInput.value;
    appendMessage("You", msg);
    socket.emit("message", { type: "chat", message: encrypt(msg) });
    messageInput.value = "";
  };

  function appendMessage(sender, text) {
    const msg = document.createElement("div");
    msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesDiv.appendChild(msg);
  }

  function encrypt(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function decrypt(text) {
    return decodeURIComponent(escape(atob(text)));
  }
}