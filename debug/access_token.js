'use strict';

mapboxgl.accessToken = getAccessToken();

function getAccessToken() {
    var accessToken =
        "pk.eyJ1IjoiaGdsODY4IiwiYSI6ImNqY3IxazAxODIzZzMzM3M1eTZnMzM3ZWYifQ.r4fHRX1Ty6qgBqbLOZ3srw"

    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}

function getURLParameter(name) {
    var regexp = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
    var output = regexp.exec(window.location.href);
    return output && output[1];
}
