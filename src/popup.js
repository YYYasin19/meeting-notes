import { createAudioArray } from "./utils.js";
// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (popup.html) on completion.

const inputElement = document.getElementById('text');
const outputElement = document.getElementById('output');

// Listen for changes made to the textbox.
inputElement.addEventListener('input', (event) => {

    // Bundle the input data into a message.
    const message = {
        action: 'classify',
        text: event.target.value,
    }

    // Send this message to the service worker.
    chrome.runtime.sendMessage(message, (response) => {
        // Handle results returned by the service worker (`background.js`) and update the popup's UI.
        outputElement.innerText = JSON.stringify(response, null, 2);
    });
});


// transcription
const transcribeButton = document.getElementById("transcribe-button")
const audioInput = document.getElementById("audio-input") // this is an mp3 file
const transcribeOutput = document.getElementById("transcription-output")
transcribeButton.addEventListener("click", async (event) => {

    // const audioArray = await createAudioArray(audioInput.files[0])

    const message = {
        action: 'transcribe',
        // audio: audioArray
    }

    chrome.runtime.sendMessage(message, (response) => {
        // Handle results returned by the service worker (`background.js`) and update the popup's UI.
        transcribeOutput.innerText = JSON.stringify(response, null, 2);
    });
})