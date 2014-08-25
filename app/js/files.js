'use strict';

var link, preview, file, reader;

function checkFileAPISupport() {
  window.File && window.FileReader && window.FileList && window.Blob ?
    console.log("Great, all fileAPIs are supported") :
    console.log("The File APIs are not fully supported in this browser")
}
// Aquí obtenemos la URL para webRTC.
function getRTCDataURI(blob) {
  link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  //link.download = 'File Name';
  //link.click();
  console.log("link: " + link);
  document.querySelector('output[name=blobUrl]').value = link;
  document.querySelector('a[name=blobUrl]').href=link;
}

function handleFileSelect() {

  checkFileAPISupport();

  preview = document.querySelector('video');
  file = document.querySelector('input[type=file]').files[0]; // file list objects
  reader = new FileReader();

  /*reader.onloadend = function () {
    preview.src = reader.result;
    console.log("Great! Video loaded successfully");
  }*/

  file ? reader.readAsDataURL(file) : preview.src = "";
  console.log(reader);

  getRTCDataURI(file);
};

// Move in files.js
function saveToDisk(fileUrl, fileName) {
    var save = document.createElement('a');
    save.href = fileUrl;
    save.target = '_blank';
    save.download = fileName || fileUrl;

    var event = document.createEvent('Event');
    event.initEvent('click', true, true);

    save.dispatchEvent(event);
    (window.URL || window.webkitURL).revokeObjectURL(save.href);
}


// TODO: mirar de cambiar el orden de llamada. getRTCDataURI() debería llamar a handleFileSelect().
