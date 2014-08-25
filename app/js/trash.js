/*
var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
var RTCIceCandidate =




var localPeerConnection = new RTCPeerConnection();
var dataChannel = undefined;
try {
  dataChannel = localPeerConnection.createDataChannel("sendDataChannel", {reliable: true});
  console.log("datachannel creado");
} catch (e) {
  console.log("createDataChannel() failed with: " + e.message);
}

// Associate handlers thith peer connection ICE events
localPeerConnection.onicecandidate = gotLocalCandidate;

// Associate handlers with data channel events
sendChannel.onopen = handlerSendChannelStateChange;
sendChannel.onclouse = handleSendChannelStateChange;

// Mimic a remote peer connection
window.remotePeerConnecion = new RTCPeerConnection(servers);
}
*/
