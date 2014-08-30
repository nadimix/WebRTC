'use strict';

/************ VARIABLES  ************/

// JavaScript variables holding stream and connection information
var RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, localPeerConnection, remotePeerConnection;

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

// JavaScript variables associated with send and receive channels
var sendChannel, receiveChannel;

var preview;

// Utility function for logging information to the JavaScript console
function log(text) {
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ': ' + text);
}

/************ CONNECTION  ************/

function createConnection() {
  // Disable de Start Button on the page
  startButton.disabled = true;

  // TODO: Log info about data to share

  // Configution of RTCPeerConnection
  log('Starting RTCPeerConnection...');
  if (navigator.webkitGetUserMedia) {
    log('This appears to be Chrome');
    RTCPeerConnection = webkitRTCPeerConnection;
  } else if (navigator.mozGetUserMedia) {
    log('This appears to be Firefox');
    RTCPeerConnection = mozRTCPeerConnection;
    RTCSessionDescription = mozRTCSessionDescription;
    RTCIceCandidate = mozRTCIceCandidate;
  } else {
    log('Browser does not appear to be WebRTC-capable');
  }
  log('RTCPeerConnection object: ' + RTCPeerConnection);

  // Optional configuration associated to NAT traversal setup
  var servers = null;

  // Since Chrome M31 there is no need to pass DTLS constraint as it is on by default.
  // SCTP reliable and ordered is true by default.
  var peerConnectionConstraints = null;
  var dataConstraints = null;

  // Create the local PeerConnection object with data channels
  localPeerConnection = new RTCPeerConnection(servers, peerConnectionConstraints);
  log('Created local peer connection object localPeerConnection, with Data Channel using SCTP');

  try {
    sendChannel = localPeerConnection.createDataChannel('sendDataChannel', dataConstraints);
    log('Created reliable send data channel');
  } catch (e) {
    log('Failed to create data channel!\n createDataChannel() failed with: ' + e.message);
  }

  // Associate handlers with peer connection ICE events
  localPeerConnection.onicecandidate = gotLocalIceCandidate;

  // Associate handlers with data channel events
  sendChannel.onopen = handleSendChannelStateChange;
  sendChannel.onclose = handleSendChannelStateChange;

  // Mimic a remote peer connection
  remotePeerConnection = new RTCPeerConnection(servers, peerConnectionConstraints);
  log('Created remote peer connection object, with DataChannel using SCTP');

  // Asociate handlers with peer connection ICE events...
  remotePeerConnection.onicecandidate = gotRemoteIceCandidate;
  // ...and data channel creation events
  remotePeerConnection.ondatachannel = gotReceiveChannel;

  // We're all set! Let's start negotiating a session...
  localPeerConnection.createOffer(gotLocalDescription, onSignalingError);

  stopButton.disabled = false;
  sendButton.disabled = false;
  //closeDataChannels();
}

/************ SIGNALLING ************/

function onSignalingError(error) {
  log('Failed to create signalling message: ' + error.name);
}

// Handler to be called as soon as the local SDP is made available to the application
function gotLocalDescription(description) {
  // Add the local description to the local PeerConneciton
  localPeerConnection.setLocalDescription(description);
  log('Offer from localPeerConnection: \n' + description.sdp);

  // TODO ...do the same with the 'pseudoremote' PeerConnection
  // Note: this is the part that will have to be changed if you want
  // the communicating peers to become remote
  // (which calls for the setup of a proper signaling channel)”

  remotePeerConnection.setRemoteDescription(description);

  // Create the Answer to the received Offer based on the 'local' description
  remotePeerConnection.createAnswer(gotRemoteDescription, onSignalingError);
}

// Handler to be called when the remote SDP becomes available
function gotRemoteDescription(description) {
  // Set the remote description as the local description of the remote PeerConnection
  remotePeerConnection.setLocalDescription(description);
  log('Answer from remotePeerConnection: \n' + description.sdp);
  // Converserly, set the remote description as the remote description of the local PeerConnection
  localPeerConnection.setRemoteDescription(description);
}

/************ NAT TRAVERSAL ************/

// Handler to be called whenever a new local ICE candidate becomes available
function gotLocalIceCandidate(event){
  if(event.candidate) {
    // Add candidate to the remote PeerConnection
    remotePeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
    log('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

// Handler to be called whenever a new remote ICE candidate becomes available
function gotRemoteIceCandidate(event){
  if(event.candidate) {
    // Add candidate to the local PeerConnection
    localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
    log('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

/************ DATACHANNEL ************/

// Handler for sending data to the remote peer, Firefox allow us send blobs directly
function sendData() {
  var data = document.querySelector('input[type=file]').files[0];
  log('Sending data: ' + data);
  sendChannel.send(data);
  log('Sent data: ' + data);
}

function closeDataChannels() {
    log('Closing data channels');
    sendChannel.close();
    log('Closed data channel with label: ' + sendChannel.label);
    receiveChannel.close();
    log('Closed data channel with label: ' + receiveChannel.label);
    // Close PeerConnection(s)
    localPeerConnection.close();
    remotePeerConnection.close();
    // Reset local variables
    localPeerConnection = null;
    remotePeerConnection = null;
    log('Closed peer connections');
    // Rollback to the initial setup of the HTML5 page
    startButton.disabled = false;
    sendButton.disabled = true;
    stopButton.disabled = true;
}

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
  // TODO: open video player or close video player, etc.
}

// Handler for either 'open' or ' close' events on receiver's data channel
function handleReceiveChannelStateChange(){
  var readyState = receiveChannel.readyState;
  log('Receive channel state is: ' + readyState);
}
