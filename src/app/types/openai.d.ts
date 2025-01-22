/* eslint-disable @typescript-eslint/prefer-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai"

declare module "openai" {
  interface OpenAIClient extends OpenAI {
    images: {
      generate(params: GenerateImageParams): Promise<GenerateImageResponse>
    }
  }

  interface GenerateImageParams {
    model: string
    prompt: string
    n: number
    size: "256x256" | "512x512" | "1024x1024"
    response_format: "url" | "b64_json"
  }

  interface GenerateImageResponse {
    created: number
    data: Array<{ url: string | null }>
  }

  namespace OpenAI {
    interface ClientOptions {
      apiKey: string
      [key: string]: any
    }
  }
}

declare const OpenAI: {
  new (options: OpenAI.ClientOptions): OpenAI.OpenAIClient
}

export = OpenAI

