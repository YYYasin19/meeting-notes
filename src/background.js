// background.js - Handles requests from the UI, runs the model, then sends back a response

import { pipeline, env } from '@xenova/transformers';
import { WaveFile } from 'wavefile';

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
    static task = 'text-classification';
    static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }

        return this.instance;
    }
}


// Create generic classify function, which will be reused for the different types of events.
const classify = async (text) => {
    // Get the pipeline instance. This will load and build the model when run for the first time.
    let model = await PipelineSingleton.getInstance((data) => {
        // console.log('progress', data)
    });

    // Actually run the model on the input text
    return await model(text);
};

let settings = {
    SAMPLING_RATE: 16000,
    DEFAULT_AUDIO_URL: `https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/ted_60_16k.wav`,
    DEFAULT_MODEL: "Xenova/whisper-tiny",
    DEFAULT_SUBTASK: "transcribe",
    DEFAULT_LANGUAGE: "english",
    DEFAULT_QUANTIZED: false,
    DEFAULT_MULTILINGUAL: false,
};

class PipelineFactory {
    static task = null;
    static model = null;
    static quantized = null;
    static instance = null;

    constructor(tokenizer, model, quantized) {
        this.tokenizer = tokenizer;
        this.model = model;
        this.quantized = quantized;
    }

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                quantized: this.quantized,
                progress_callback,

                // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
                revision: this.model.includes("/whisper-medium") ? "no_attentions" : "main"
            });
        }

        return this.instance;
    }
}

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
    static task = "automatic-speech-recognition";
    static model = settings.DEFAULT_MODEL;
    static quantized = settings.DEFAULT_QUANTIZED;
}

async function wavAudioFromUrl(url) {
    let response = await fetch(url);
    let arrayBuffer = await response.arrayBuffer();
    let buffer = new Uint8Array(arrayBuffer);

    // Read .wav file and convert it to required format
    let wav = new WaveFile(buffer);
    wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
    wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
        const SCALING_FACTOR = Math.sqrt(2);

        // Merge channels (into first channel to save memory)
        for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
        }
    }

    // Select first channel
    audioData = audioData[0];
    }
    return audioData; // Return the processed audio data
}

const transcribe = async (audio) => {
    console.log("Transcribe task", settings.DEFAULT_MODEL, settings.DEFAULT_MULTILINGUAL, settings.DEFAULT_QUANTIZED, settings.DEFAULT_SUBTASK, settings.DEFAULT_LANGUAGE)
    const pipeline = AutomaticSpeechRecognitionPipelineFactory;

    let transcriber = await pipeline.getInstance();

    // Actually run transcription
    let audioData;
    try {
        audioData = await wavAudioFromUrl(settings.DEFAULT_AUDIO_URL);
    } catch (error) {
        console.error("Error processing audio file:", error);
        return "Error processing audio file: " + error.message;
    }

    if (!audioData || audioData.length === 0) {
        return "Error: No audio data available";
    }

    let output = await transcriber(audioData, {
        language: settings.DEFAULT_LANGUAGE,
        task: settings.DEFAULT_SUBTASK,
        chunk_length_s: 30,
        stride_length_s: 5
    }).catch((error) => {
        console.error("Error transcribing audio", error)
        return "Error transcribing audio: \n" + JSON.stringify(error);
    });

    console.log("Transcribe output", output)
    return output;
};


////////////////////// Message Events /////////////////////
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'classify' && message.action !== 'transcribe') return; // Ignore messages that are not meant for classification or transcription.

    // Run model prediction asynchronously
    (async function () {
        let result;
        if (message.action === 'classify') {
            // Perform classification
            result = await classify(message.text);
        
        } else if (message.action === 'transcribe') {
            let audioArray = Float32Array.from(Object.values(message.audio))
            result = await transcribe(audioArray);
        }

        // Send response back to UI
        sendResponse(result);
    })();

    // return true to indicate we will send a response asynchronously
    // see https://stackoverflow.com/a/46628145 for more information
    return true;
});
