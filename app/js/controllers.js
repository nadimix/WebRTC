'use strict';

/* Controllers */
(function(){
  angular.module('myApp.controllers', [])
    .controller('VideoController', function(){
      this.video = video;
    });

  var video = {
    title: 'Sintel trailer',
    mpd: 'http://localhost:8080/test/dashes/test.mpd',
    description: '. . .',
  }
})();
