import { createMemo, createSignal } from "solid-js"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { map, pipe, flatMap, entries, filter, sortBy } from "remeda"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { DialogProvider } from "./dialog-provider"
import { DialogVariant } from "./dialog-variant"
import { useKeybind } from "../context/keybind"
import { useConnected } from "./use-connected"
import { classifyModel } from "@tui/util/model-classify"

const NAME_COL_WIDTH = 34
const PROVIDER_COL_WIDTH = 12
const INFRASTRUCTURE_COL_WIDTH = 14

function pad(value: string, width: number): string {
  const clean = value ?? ""
  if (clean.length >= width) return clean.slice(0, Math.max(0, width - 1)) + "…"
  return clean + " ".repeat(width - clean.length)
}

/**
 * `/models` in table form.
 *
 * Renders a picker with three visible columns:
 *
 *   Name  |  Provider  |  Infrastructure  |  Region
 *
 * "Provider" is the vendor (who made the model, e.g. Anthropic) and
 * "Infrastructure" is how the model is reached (e.g. Bedrock, Azure, Direct),
 * and "Region" is where it runs when known. These can come from model metadata
 * in models.dev or `opencode.json(c)`, with `classifyModel()` providing
 * fallbacks from the providerID, modelID, and `model.api.npm`.
 *
 * Built on top of `DialogSelect` so fuzzy filter, keyboard nav, scrolling,
 * keybinds for favorites, and current-model indicator are all inherited from
 * the existing picker. Columns are aligned by pre-padding the option `title`
 * (name + provider) in monospace and letting the section category act as the
 * group header. Infrastructure goes in the `footer` slot (right-flush,
 * colored muted).
 */
export function DialogModelTable(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const keybind = useKeybind()
  const [query, setQuery] = createSignal("")

  const connected = useConnected()

  const showExtra = createMemo(() => connected() && !props.providerID)

  const options = createMemo(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()

    function buildRow(providerID: string, modelID: string, category: string | undefined) {
      const provider = sync.data.provider.find((x) => x.id === providerID)
      if (!provider) return null
      const model = provider.models[modelID]
      if (!model) return null
      const { vendor, infrastructure, region } = classifyModel(provider.id, {
        id: model.id,
        family: model.family,
        api: model.api,
        name: model.name,
        vendor: model.vendor,
        infrastructure: model.infrastructure,
        region: model.region,
      })
      const displayName = model.name ?? modelID
      return {
        value: { providerID: provider.id, modelID },
        title:
          pad(displayName, NAME_COL_WIDTH) +
          "  " +
          pad(vendor, PROVIDER_COL_WIDTH) +
          "  " +
          pad(infrastructure, INFRASTRUCTURE_COL_WIDTH),
        footer: region,
        category: category === provider.name && (infrastructure === "NVIDIA" || infrastructure === "NV Inference") ? "NV Inference" : category,
        disabled: provider.id === "opencode" && modelID.includes("-nano"),
        onSelect: () => onSelect(provider.id, modelID),
      }
    }

    function toOptions(items: Array<{ providerID: string; modelID: string }>, category: string) {
      if (!showSections) return []
      return items.flatMap((item) => {
        const row = buildRow(item.providerID, item.modelID, category)
        return row ? [row] : []
      })
    }

    const favoriteOptions = toOptions(favorites, "Favorites")
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      "Recent",
    )

    const providerOptions = pipe(
      sync.data.provider,
      sortBy(
        (provider) => provider.id !== "opencode",
        (provider) => provider.name,
      ),
      flatMap((provider) =>
        pipe(
          provider.models,
          entries(),
          filter(([_, info]) => info.status !== "deprecated"),
          filter(([_, info]) => (props.providerID ? info.providerID === props.providerID : true)),
          map(([modelID, _info]) => buildRow(provider.id, modelID, connected() ? provider.name : undefined)),
          filter((x): x is NonNullable<typeof x> => x !== null),
          filter((x) => {
            if (!showSections) return true
            if (favorites.some((item) => item.providerID === x.value.providerID && item.modelID === x.value.modelID))
              return false
            if (recents.some((item) => item.providerID === x.value.providerID && item.modelID === x.value.modelID))
              return false
            return true
          }),
          sortBy((x) => x.title),
        ),
      ),
    )

    return [...favoriteOptions, ...recentOptions, ...providerOptions]
  })

  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((x) => x.id === props.providerID) : null,
  )

  const title = createMemo(() => {
    const value = provider()
    if (value) return value.name
    // Show column-header hint inline with the dialog title so users see the
    // layout even without a dedicated header row.
    return (
      "Select model  " +
      pad("Name", NAME_COL_WIDTH) +
      "  " +
      pad("Provider", PROVIDER_COL_WIDTH) +
      "  " +
      pad("Infrastructure", INFRASTRUCTURE_COL_WIDTH) +
      "  Region"
    )
  })

  function onSelect(providerID: string, modelID: string) {
    local.model.set({ providerID, modelID }, { recent: true })
    const list = local.model.variant.list()
    const cur = local.model.variant.selected()
    if (cur === "default" || (cur && list.includes(cur))) {
      dialog.clear()
      return
    }
    if (list.length > 0) {
      dialog.replace(() => <DialogVariant />)
      return
    }
    dialog.clear()
  }

  return (
    <DialogSelect<ReturnType<typeof options>[number]["value"]>
      options={options()}
      keybind={[
        {
          keybind: keybind.all.model_provider_list?.[0],
          title: connected() ? "Connect provider" : "View all providers",
          onTrigger() {
            dialog.replace(() => <DialogProvider />)
          },
        },
        {
          keybind: keybind.all.model_favorite_toggle?.[0],
          title: "Favorite",
          disabled: !connected(),
          onTrigger: (option) => {
            local.model.toggleFavorite(option.value as { providerID: string; modelID: string })
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={local.model.current()}
    />
  )
}
