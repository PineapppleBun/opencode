import { describe, expect, test } from "bun:test"
import { classifyModel } from "../../../src/cli/cmd/tui/util/model-classify"

describe("classifyModel", () => {
  test("anthropic direct", () => {
    expect(
      classifyModel("anthropic", {
        id: "claude-sonnet-4-20250514",
        family: "claude",
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "Direct", region: "Default" })
  })

  test("openai direct", () => {
    expect(
      classifyModel("openai", {
        id: "gpt-4o",
        family: "gpt",
      }),
    ).toEqual({ vendor: "OpenAI", infrastructure: "Direct", region: "Default" })
  })

  test("openai o3 direct (family-based vendor)", () => {
    expect(
      classifyModel("openai", {
        id: "o3-mini",
        family: "o3",
      }),
    ).toEqual({ vendor: "OpenAI", infrastructure: "Direct", region: "Default" })
  })

  test("bedrock hosting anthropic", () => {
    expect(
      classifyModel("amazon-bedrock", {
        id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        family: "claude",
        api: { npm: "@ai-sdk/amazon-bedrock" },
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "Bedrock", region: "Default" })
  })

  test("bedrock hosting meta", () => {
    expect(
      classifyModel("amazon-bedrock", {
        id: "meta.llama3-70b-instruct-v1:0",
        family: "llama",
        api: { npm: "@ai-sdk/amazon-bedrock" },
      }),
    ).toEqual({ vendor: "Meta", infrastructure: "Bedrock", region: "Default" })
  })

  test("bedrock hosting amazon nova", () => {
    expect(
      classifyModel("amazon-bedrock", {
        id: "amazon.nova-pro-v1:0",
        family: "nova",
        api: { npm: "@ai-sdk/amazon-bedrock" },
      }),
    ).toEqual({ vendor: "Amazon", infrastructure: "Bedrock", region: "Default" })
  })

  test("google vertex (anthropic flavor)", () => {
    expect(
      classifyModel("google-vertex-anthropic", {
        id: "claude-3-7-sonnet@20250219",
        family: "claude",
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "Vertex", region: "Default" })
  })

  test("google vertex (google flavor)", () => {
    expect(
      classifyModel("google-vertex", {
        id: "gemini-2.0-flash-001",
        family: "gemini",
      }),
    ).toEqual({ vendor: "Google", infrastructure: "Vertex", region: "Default" })
  })

  test("azure hosting openai", () => {
    expect(
      classifyModel("azure", {
        id: "gpt-4o",
        family: "gpt",
      }),
    ).toEqual({ vendor: "OpenAI", infrastructure: "Azure", region: "Default" })
  })

  test("azure hosting gpt codex", () => {
    expect(
      classifyModel("azure", {
        id: "gpt-5.1-codex",
        family: "gpt-codex",
        api: { npm: "@ai-sdk/azure" },
      }),
    ).toEqual({ vendor: "OpenAI", infrastructure: "Azure", region: "Default" })
  })

  test("azure hosting anthropic", () => {
    expect(
      classifyModel("azure", {
        id: "claude-haiku-4-5",
        family: "claude-haiku",
        api: { npm: "@ai-sdk/anthropic" },
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "Azure", region: "Default" })
  })

  test("azure hosting meta", () => {
    expect(
      classifyModel("azure", {
        id: "llama-4-scout-17b-16e-instruct",
        family: "llama",
        api: { npm: "@ai-sdk/azure" },
      }),
    ).toEqual({ vendor: "Meta", infrastructure: "Azure", region: "Default" })
  })

  test("openrouter hosting deepseek (slash prefix)", () => {
    expect(
      classifyModel("openrouter", {
        id: "deepseek/deepseek-v3",
        family: "deepseek",
      }),
    ).toEqual({ vendor: "DeepSeek", infrastructure: "OpenRouter", region: "Default" })
  })

  test("opencode zen gateway", () => {
    expect(
      classifyModel("opencode", {
        id: "claude-sonnet-4",
        family: "claude",
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "OpenCode Zen", region: "Default" })
  })

  test("nvidia inference hosting meta", () => {
    expect(
      classifyModel("nvidia", {
        id: "meta/llama-3.1-70b-instruct",
        family: "llama",
      }),
    ).toEqual({ vendor: "Meta", infrastructure: "NV Inference", region: "Default" })
  })

  test("nvidia inference hosting nvidia", () => {
    expect(
      classifyModel("nvidia", {
        id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        family: "nemotron",
      }),
    ).toEqual({ vendor: "NVIDIA", infrastructure: "NV Inference", region: "Default" })
  })

  test("nvidia inference hosting mistralai", () => {
    expect(
      classifyModel("nvidia", {
        id: "mistralai/mistral-large-3-675b-instruct-2512",
        family: "mistral-large",
      }),
    ).toEqual({ vendor: "Mistral", infrastructure: "NV Inference", region: "Default" })
  })

  test("nvidia inference does not default vendor to nvidia", () => {
    expect(
      classifyModel("nvidia", {
        id: "unknown-publisher/model-v1",
      }),
    ).toEqual({ vendor: "Unknown", infrastructure: "NV Inference", region: "Default" })
  })

  test("fallback to npm for unknown provider with bedrock npm", () => {
    expect(
      classifyModel("custom-bedrock-clone", {
        id: "anthropic.claude-3-haiku",
        api: { npm: "@ai-sdk/amazon-bedrock" },
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "Bedrock", region: "Default" })
  })

  test("uses explicit metadata before heuristics for unknown provider", () => {
    expect(
      classifyModel("some-gateway", {
        id: "unknown/model-v1",
        vendor: "Example Labs",
        infrastructure: "Example Gateway",
        region: "us-west-2",
      }),
    ).toEqual({ vendor: "Example Labs", infrastructure: "Example Gateway", region: "us-west-2" })
  })

  test("uses explicit publisher alias before heuristics", () => {
    expect(
      classifyModel("some-gateway", {
        id: "unknown/model-v1",
        publisher: "Example Labs",
      }),
    ).toEqual({ vendor: "Example Labs", infrastructure: "Direct", region: "Default" })
  })

  test("known provider infrastructure wins over explicit metadata", () => {
    expect(
      classifyModel("azure", {
        id: "gpt-5",
        family: "gpt",
        infrastructure: "Wrong Gateway",
      }),
    ).toEqual({ vendor: "OpenAI", infrastructure: "Azure", region: "Default" })
  })

  test("derives bedrock cross-region prefix", () => {
    expect(
      classifyModel("amazon-bedrock", {
        id: "eu.anthropic.claude-3-haiku",
        api: { npm: "@ai-sdk/amazon-bedrock" },
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "Bedrock", region: "EU" })
  })

  test("unknown provider, unknown model → Unknown + Direct", () => {
    expect(
      classifyModel("some-unknown-provider", {
        id: "mystery-model-v1",
      }),
    ).toEqual({ vendor: "Unknown", infrastructure: "Direct", region: "Default" })
  })

  test("xai grok direct", () => {
    expect(
      classifyModel("xai", {
        id: "grok-2-latest",
        family: "grok",
      }),
    ).toEqual({ vendor: "xAI", infrastructure: "Direct", region: "Default" })
  })

  test("github copilot", () => {
    expect(
      classifyModel("github-copilot", {
        id: "claude-3.5-sonnet",
        family: "claude",
      }),
    ).toEqual({ vendor: "Anthropic", infrastructure: "GitHub Copilot", region: "Default" })
  })
})
