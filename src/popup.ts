/// <reference types="chrome"/>

import { createAudioArray } from "./utils";

// Define types for the message and response
export interface ClassifyMessage {
  action: "classify";
  text: string;
}

export interface TranscribeMessage {
  action: "transcribe";
  audio: Array<number>;
}

function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target!.result as ArrayBuffer);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

type Message = ClassifyMessage | TranscribeMessage;

type ClassifyResponse = Array<{ label: string; score: number }>;
type TranscribeResponse = { text: string } | string;

type Response = ClassifyResponse | TranscribeResponse;

const inputElement = document.getElementById("text") as HTMLInputElement;
const outputElement = document.getElementById("output") as HTMLElement;

// Listen for changes made to the textbox.
inputElement.addEventListener("input", (event: Event) => {
  const target = event.target as HTMLInputElement;

  // Bundle the input data into a message.
  const message: ClassifyMessage = {
    action: "classify",
    text: target.value,
  };

  // Send this message to the service worker.
  chrome.runtime.sendMessage(message, (response: Response) => {
    // Handle results returned by the service worker (`background.js`) and update the popup's UI.
    outputElement.innerText = JSON.stringify(response, null, 2);
  });
});

// transcription
const transcribeButton = document.getElementById(
  "transcribe-button"
) as HTMLButtonElement;
const audioInput = document.getElementById("audio-input") as HTMLInputElement;
const transcribeOutput = document.getElementById(
  "transcription-output"
) as HTMLElement;

transcribeButton.addEventListener("click", async () => {
  console.log("Transcribe button clicked");
  let file = audioInput.files?.[0];
  if (!file) {
    alert("No file selected");
    return;
  }
  // const audioArray = await createAudioArray(file);
  const audio = await readFile(file);
  console.log("audio", audio);
  const message: TranscribeMessage = {
    action: "transcribe",
    audio: Array.from(new Uint8Array(audio)),
  };

  chrome.runtime.sendMessage(message, (response: Response) => {
    // Handle results returned by the service worker (`background.js`) and update the popup's UI.
    transcribeOutput.innerText = JSON.stringify(response, null, 2);
  });
});
