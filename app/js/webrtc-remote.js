'use strict';

// Look after different browser vendor's ways of calling the getUserMedia()
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia;

// Clean-up function: Collect garbage before unloading browser's window
window.onbeforeunload = function(e) {
  hangup(); //TODO
}

// Data channel information
var sendChannel, receiveChannel;

// JavaScript variables holding stream and connection information
//var RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, localPeerConnection, remotePeerConnection;

// JavaScript variables associated with call management button in the page
var startButton = document.getElementById('startButton');
startButton.disabled = false;
startButton.onclick = createConnection;

var sendButton = document.getElementById('sendButton');
sendButton.disabled = true;
sendButton.onclick = sendData;

var stopButton = document.getElementById('stopButton');
stopButton.disabled = true;
stopButton.onclick = closeDataChannels;

// HTML5 <video> elements
var preview;

// Flags...
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;

// WebRTC data structures
// Streams
//var localStream;
//var remoteStream;
// PeerConnection
var peerConnection;

// PeerConnection ICE protocol configuration (either Firefox or Chrome)
var peerConnectionConfig = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} :
  {'iceServers':[{'url':'stun:stun.l.google.com:19302'}]};
// Since Chrome M31 there is no need to pass DTLS constraint as it is on by default.
// SCTP reliable and ordered is true by default.
var peerConnectionConstraints = null;
var dataChannelConstraints = null;
var sdpConstraints = {};

// Let's get started: prompt user for input (room name)
var room = prompt('Enter room name:');

// Connect to signaling server
var socket = io.connect('http://localhost:8181');

// Send 'Create or join' message to signaling server
if (room !== '') {
  console.log('Create or join room', room);
  socket.emit('create or join' room);
}

// Utility function for logging information to the JavaScript console
function log(text) {
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ': ' + text);
}

/************ SIGNALING ************/

// 1. Server-->Client...

// Handle 'created' message coming back from server:
// this peer is the initiator
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;

  checkAndStart();
});

// Handle 'full' message comming back from server:
// this peer arrived too late :-(
socket.on('full', function (room){
  console.log('Room '+room+' is full');
});

// Handle 'join' message coming back from server:
// another peer is joining the channel
socket.on('join', function(room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;

  // TODO getUserMedia stufF?
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on('joined', function(room){
  console.log('This peer has joined room ' + room);
  isChannel Ready = true;

  // TODO getUserMedia stuff??
});

// Server-sent log message...
socket.on('log', function(array){
  console.log.apply(console, array);
});

// Receive message from other peer via the signaling server
socket.on('message', function(message){
  console.log('Received message:', message);
  if(message === 'got user media') {
    // TODO check if it is necessary to get getUserMedia for datachannel only
    checkAndStart();
  } else if(message.type === 'offer') {
    if(!isInitiator && !isStarted) {
      checkAndStart();
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if(message.type === 'answer' && isStarted) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message));
  } else if(message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.label,
      candidate:message.candidate});
    peerConnection.addIceCandidate(candidate);
  } else if(message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

// 2. Client-->Server

// Send message to the other peer via the signalling server
function sendMessage(message){
  console.log('Sending message: ', message);
  socket.emit('message', message);
}

// Channel negotiation trigger function
function checkAndStart(){
  if(!isStarted && isChannelReady) {
    createPeerConnection();
    isStarted = true;
    if(isInitiator) {
      doCall(); //TODO check this calling method
    }
  }
}

/************ CONNECTION  ************/
function createPeerConnection() {
  try {
    peerConnection = new RTCPeerConnection(peerConnectionConfig, peerConnectionConstraints);
    //peerConnection.addStream(localStream);

    // Associate handlers with peer connection ICE events
    peerConnection.onicecandidate = handleIceCandidate;
    console.log('Created RTCPeerConnection with:\n' +
    ' config: \'' + JSON.stringify(peerConnectionConfig) + '\';\n' +
    ' constraints: \'' + JSON.stringify(peerConnectionConstraints) + '\'.');
    // Disable de Start Button on the page
    startButton.disabled = true;
  } catch(e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot created RTCPeerConnection object.');
    return;
  }

  //peerConnection.onaddstream = handleRemoteStreamAdded;
  //peerConnection.onremovestream = handleRemoteStreamRemoved;

  if(isInitiator) {
    try {
      // Create a reliable data channel
      sendChannel = peerConnection.createDataChannel('sendDataChannel', dataChannelConstraints);
      log('Created send data channel');
    } catch(e) {
      alert('Failed to create data channel');
      log('createDataChannel() failed with exception: ' + e.message);
    }

    // Associate handlers with data channel events
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onmessage = handleMessage;
    sendChannel.onclose = handleSendChannelStateChange;
  } else { // Joiner
    peerConnection.ondatachannel = gotReceiveChannel;
  }
}

/************ DATACHANNEL ************/

// Data channel management
function sendData() {
  var data = document.querySelector('input[type=file]').files[0];
  log('Sending data: ' + data);
  isInitiator ? sendChannel.send(data) : receiveChannel.send(data);
  log('Sent data: ' + data);
}

// Handlers...

// Handler associated with the management of remote peer connection's data channel events
function gotReceiveChannel(event) {
  log('Receive Channel Callback: event ---> ' + event);
  // Retrieve channel information
  receiveChannel = event.channel;

  // Set handlers for the following events:
  // (i) open; (ii) message; (iii) close
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

// Message event handler
function handleMessage(event) {
  log('Received message: ' + event.data);
  preview = document.querySelector('video');
  var blob = event.data; // Firefox allos us send blobs directly
  var reader = new window.FileReader();
  blob ? reader.readAsDataURL(blob) : preview.src = "";
  reader.onload = function(event){
    var fileDataURL = event.target.result;
    log('Received blob url: ' + fileDataURL);
    preview.src = reader.result;
    log('Great! Video loaded successfully');
    //saveToDisk(fileDataURL, 'Received content');
  };
}

// Handler for either 'open' or 'close' events on sender's data channel
function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  log('Send channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState === 'open') {
    sendButton.disabled = false;
  }else{
    sendButton.disabled = true;
  }
}

// Handler for either 'open' or ' close' events on receiver's data channel
function handleReceiveChannelStateChange(){
  var readyState = receiveChannel.readyState;
  log('Receive channel state is: ' + readyState);
  log('For now the receive channel is not allowed to send data.');
  // If channel ready, enable user's input
  if (readyState === 'open') {
    sendButton.disabled = true; // TODO: change to true if allow to sendData for peers.
  }else{
    sendButton.disabled = true;
  }
}

// Create Offer
function createOffer() {
  log('Creating Offer...');
  peerConnection.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Create Answer
function createAnswer() {
  log('Sending answer to peer.');
  peerConnection.createAnswer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Success handler for both createOffer()
// and createAnswer();
function setLocalAndSendMessage(sessionDescription) {
  peerConnection.setLocalDescription(sessionDescription);
  log('Offer from localPeerConnection: \n' + sessionDescription.sdp);
  sendMessage(SessionDescription);
}

// Clean-up functions...
function hangup() {
  log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  log('Closing data channels');
  if(sendChannel) sendChannel.close();
  log('Closed data channel with label: ' + sendChannel.label);
  if(receiveChannel) receiveChannel.close();
  log('Closed data channel with label: ' + receiveChannel.label);
  // Close PeerConnection(s)
  if(peerConnection) peerConnection.close();
  peerConnection = null;
  log('Closed peer connections');
  // Rollback to the initial setup of the HTML5 page
  startButton.disabled = false;
  sendButton.disabled = true;
  stopButton.disabled = true;
}


/************ NAT TRAVERSAL ************/

// ICE candidates management
function handleIceCandidate(event) {
  log('handleIceCandidate event: ' + event);
  if(event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    log('End of candidates.');
  }
}

function onSignalingError(error) {
  log('Failed to create signalling message: ' + error.name);
}
