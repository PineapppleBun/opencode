/**
 * Classifies a model into `{ vendor, infrastructure, region }`:
 *
 *   - `vendor` is the model's originating creator (e.g. "Anthropic", "OpenAI",
 *     "Meta"). It's distinct from the provider ID because a single cloud
 *     gateway (e.g. `amazon-bedrock`) hosts many vendors' models. The TUI
 *     displays this as the "Provider" column.
 *   - `infrastructure` is how the model is reached (e.g. "Direct", "Bedrock",
 *     "Azure", "Vertex", "OpenRouter").
 *   - `region` is where the request runs when known (e.g. "US", "EU").
 *
 * Explicit model metadata wins where it is authoritative. Known provider IDs
 * still win for infrastructure because they define the actual runtime route.
 */

/** Subset of `Provider.Model` fields this helper reads. Type-only dep. */
export interface ClassifyInput {
  id: string
  family?: string
  api?: { npm?: string }
  name?: string
  vendor?: string
  infrastructure?: string
  region?: string
  publisher?: string
  creator?: string
}

export interface Classification {
  vendor: string
  infrastructure: string
  region: string
}

/** Known provider IDs → human-readable infrastructure label. */
const INFRASTRUCTURE_BY_PROVIDER: Record<string, string> = {
  anthropic: "Direct",
  openai: "Direct",
  google: "Direct",
  mistral: "Direct",
  xai: "Direct",
  deepseek: "Direct",
  groq: "Direct",
  cohere: "Direct",
  fireworks: "Direct",
  together: "Direct",
  perplexity: "Direct",
  nvidia: "NV Inference",
  "amazon-bedrock": "Bedrock",
  azure: "Azure",
  "azure-cognitive-services": "Azure",
  "google-vertex": "Vertex",
  "google-vertex-anthropic": "Vertex",
  openrouter: "OpenRouter",
  "cloudflare-ai-gateway": "Cloudflare Gateway",
  "github-copilot": "GitHub Copilot",
  "github-copilot-enterprise": "GitHub Copilot",
  opencode: "OpenCode Zen",
  "sap-ai-core": "SAP AI Core",
  zenmux: "ZenMux",
  gitlab: "GitLab AI",
}

/** Fallback: map `model.api.npm` to an infrastructure label. */
const INFRASTRUCTURE_BY_NPM: Record<string, string> = {
  "@ai-sdk/amazon-bedrock": "Bedrock",
  "@ai-sdk/azure": "Azure",
  "@ai-sdk/google-vertex": "Vertex",
  "@ai-sdk/gateway": "Gateway",
  "@openrouter/ai-sdk-provider": "OpenRouter",
}

/** Provider IDs that are themselves vendors (not gateways). */
const PROVIDER_AS_VENDOR: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  mistral: "Mistral",
  xai: "xAI",
  deepseek: "DeepSeek",
  groq: "Groq",
  cohere: "Cohere",
  fireworks: "Fireworks",
  together: "Together",
  perplexity: "Perplexity",
  "google-vertex": "Google",
  "google-vertex-anthropic": "Anthropic",
}

/** Vendor detection by modelID prefix (before `.` or `/`). */
const VENDOR_BY_PREFIX: Array<[RegExp, string]> = [
  [/^anthropic[./]/i, "Anthropic"],
  [/^meta[./]/i, "Meta"],
  [/^amazon[./]/i, "Amazon"],
  [/^mistral[./]/i, "Mistral"],
  [/^mistralai[./]/i, "Mistral"],
  [/^openai[./]/i, "OpenAI"],
  [/^google[./]/i, "Google"],
  [/^cohere[./]/i, "Cohere"],
  [/^deepseek[./]/i, "DeepSeek"],
  [/^qwen[./]/i, "Alibaba"],
  [/^ai21[./]/i, "AI21"],
  [/^stability[./]/i, "Stability AI"],
  [/^x-ai[./]/i, "xAI"],
  [/^nvidia[./]/i, "NVIDIA"],
  [/^microsoft[./]/i, "Microsoft"],
  [/^black-forest-labs[./]/i, "Black Forest Labs"],
  [/^stepfun-ai[./]/i, "StepFun"],
]

const REGION_BY_BEDROCK_PREFIX: Record<string, string> = {
  "global.": "Global",
  "us.": "US",
  "eu.": "EU",
  "jp.": "Japan",
  "apac.": "APAC",
  "au.": "Australia",
}

/** Vendor detection from model family keyword (case-insensitive contains). */
const VENDOR_BY_FAMILY: Array<[RegExp, string]> = [
  [/claude/i, "Anthropic"],
  [/\bgpt\b|o1|o3|o4/i, "OpenAI"],
  [/gemini|palm|bison/i, "Google"],
  [/llama/i, "Meta"],
  [/mistral|mixtral|codestral/i, "Mistral"],
  [/nova|titan/i, "Amazon"],
  [/deepseek/i, "DeepSeek"],
  [/qwen/i, "Alibaba"],
  [/command/i, "Cohere"],
  [/grok/i, "xAI"],
  [/phi-?\d/i, "Microsoft"],
]

function deriveInfrastructure(providerID: string, model: ClassifyInput): string {
  const direct = INFRASTRUCTURE_BY_PROVIDER[providerID]
  if (direct) return direct
  const npm = model.api?.npm
  if (npm && INFRASTRUCTURE_BY_NPM[npm]) return INFRASTRUCTURE_BY_NPM[npm]
  if (model.infrastructure) return model.infrastructure
  return "Direct"
}

function deriveVendor(providerID: string, model: ClassifyInput): string {
  const id = model.id.replace(/^(global|us|eu|jp|apac|au)\./i, "")
  if (model.vendor) return model.vendor
  if (model.publisher) return model.publisher
  if (model.creator) return model.creator

  // For single-vendor providers, prefer the provider mapping immediately —
  // but only if the model prefix doesn't disagree (e.g. `anthropic` + model
  // `meta.llama-…` would be a config anomaly; modelID wins).
  const prefixMatch = VENDOR_BY_PREFIX.find(([re]) => re.test(id))
  if (prefixMatch) return prefixMatch[1]

  const providerVendor = PROVIDER_AS_VENDOR[providerID]
  if (providerVendor) return providerVendor

  const family = model.family ?? ""
  const familyMatch = VENDOR_BY_FAMILY.find(([re]) => re.test(family))
  if (familyMatch) return familyMatch[1]

  // Last-ditch: try to infer from the model.id itself (no vendor prefix).
  const idMatch = VENDOR_BY_FAMILY.find(([re]) => re.test(id))
  if (idMatch) return idMatch[1]

  return "Unknown"
}

function deriveRegion(providerID: string, model: ClassifyInput): string {
  if (model.region) return model.region
  if (providerID === "amazon-bedrock") {
    const prefix = Object.keys(REGION_BY_BEDROCK_PREFIX).find((item) => model.id.startsWith(item))
    if (prefix) return REGION_BY_BEDROCK_PREFIX[prefix]
  }
  return "Default"
}

export function classifyModel(providerID: string, model: ClassifyInput): Classification {
  return {
    vendor: deriveVendor(providerID, model),
    infrastructure: deriveInfrastructure(providerID, model),
    region: deriveRegion(providerID, model),
  }
}
