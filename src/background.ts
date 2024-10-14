// background.ts - Handles requests from the UI, runs the model, then sends back a response

import {
  pipeline,
  env,
  Pipeline,
  PipelineType,
  AutomaticSpeechRecognitionPipeline,
} from "@xenova/transformers";

import { TranscribeMessage, ClassifyMessage } from "./popup";

import { wavAudioFromUrl } from "./utils";

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
  static task: string = "text-classification";
  static model: string =
    "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
  static instance: AutomaticSpeechRecognitionPipeline | null = null;

  static async getInstance(
    progress_callback: ((data: any) => void) | null = null
  ): Promise<Pipeline> {
    let pipelineType: PipelineType = this.task as PipelineType;
    if (this.instance === null) {
      this.instance = (await pipeline(pipelineType, this.model, {
        progress_callback: progress_callback || undefined,
      })) as AutomaticSpeechRecognitionPipeline;
    }

    return this.instance;
  }
}

// Create generic classify function, which will be reused for the different types of events.
const classify = async (text: string): Promise<any> => {
  // Get the pipeline instance. This will load and build the model when run for the first time.
  let model = await PipelineSingleton.getInstance((data: any) => {
    // console.log('progress', data)
  });

  // Actually run the model on the input text
  return await model(text);
};

interface Settings {
  SAMPLING_RATE: number;
  DEFAULT_AUDIO_URL: string;
  DEFAULT_MODEL: string;
  DEFAULT_SUBTASK: string;
  DEFAULT_LANGUAGE: string;
  DEFAULT_QUANTIZED: boolean;
  DEFAULT_MULTILINGUAL: boolean;
}

let settings: Settings = {
  SAMPLING_RATE: 16000,
  DEFAULT_AUDIO_URL: `https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/ted_60_16k.wav`,
  DEFAULT_MODEL: "Xenova/whisper-tiny",
  DEFAULT_SUBTASK: "transcribe",
  DEFAULT_LANGUAGE: "english",
  DEFAULT_QUANTIZED: false,
  DEFAULT_MULTILINGUAL: false,
};

class PipelineFactory {
  private tokenizer: any;
  private model: any;
  private quantized: boolean;

  constructor(tokenizer: any, model: any, quantized: boolean) {
    this.tokenizer = tokenizer;
    this.model = model;
    this.quantized = quantized;
  }

  static task: string | null = null;
  static model: string | null = null;
  static quantized: boolean | null = null;
  static instance: Pipeline | null = null;

  static async getInstance(
    progress_callback: ((data: any) => void) | null = null
  ): Promise<Pipeline> {
    let pipelineType: PipelineType = this.task as PipelineType;
    if (this.instance === null) {
      this.instance = (await pipeline(pipelineType, this.model!, {
        quantized: this.quantized,
        progress_callback: progress_callback || undefined,

        // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
        revision: this.model!.includes("/whisper-medium")
          ? "no_attentions"
          : "main",
      })) as Pipeline;
    }

    return this.instance;
  }
}

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
  static task: string = "automatic-speech-recognition";
  static model: string = settings.DEFAULT_MODEL;
  static quantized: boolean = settings.DEFAULT_QUANTIZED;
}

const transcribe = async (audio: Float32Array): Promise<any> => {
  console.log(
    "Transcribe task",
    settings.DEFAULT_MODEL,
    settings.DEFAULT_MULTILINGUAL,
    settings.DEFAULT_QUANTIZED,
    settings.DEFAULT_SUBTASK,
    settings.DEFAULT_LANGUAGE
  );
  const pipeline = AutomaticSpeechRecognitionPipelineFactory;

  let transcriber = await pipeline.getInstance();

  // Actually run transcription
  let audioData: Float32Array;
  try {
    audioData = await wavAudioFromUrl(audio || settings.DEFAULT_AUDIO_URL);
  } catch (error) {
    console.error("Error processing audio file:", error);
    return "Error processing audio file: " + (error as Error).message;
  }

  if (!audioData || audioData.length === 0) {
    return "Error: No audio data available";
  }

  let output = await transcriber(audioData, {
    language: settings.DEFAULT_LANGUAGE,
    task: settings.DEFAULT_SUBTASK,
    chunk_length_s: 30,
    stride_length_s: 5,
  }).catch((error: Error) => {
    console.error("Error transcribing audio", error);
    return "Error transcribing audio: \n" + JSON.stringify(error);
  });

  console.log("Transcribe output", output);
  return output;
};

////////////////////// Message Events /////////////////////
chrome.runtime.onMessage.addListener(
  (
    message: TranscribeMessage | ClassifyMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.action !== "classify" && message.action !== "transcribe")
      return; // Ignore messages that are not meant for classification or transcription.

    // Run model prediction asynchronously
    (async function () {
      let result: any;
      if (message.action === "classify") {
        // Perform classification
        result = await classify(message.text);
      } else if (message.action === "transcribe") {
        console.log("Transcribe message audio", message.audio);

        let audioArray = Float32Array.from(message.audio);
        result = await transcribe(audioArray);
      }

      // Send response back to UI
      sendResponse(result);
    })();

    // return true to indicate we will send a response asynchronously
    // see https://stackoverflow.com/a/46628145 for more information
    return true;
  }
);
