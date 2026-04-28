import { createMemo, createSignal, onMount } from "solid-js"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { map, pipe, flatMap, entries, filter, sortBy } from "remeda"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { DialogProvider } from "./dialog-provider"
import { DialogVariant } from "./dialog-variant"
import { useKeybind } from "../context/keybind"
import { useConnected } from "./use-connected"

const NAME_COL_WIDTH = 34
const METADATA_COLUMNS = [
  { key: "vendor", label: "Vendor", width: 12 },
  { key: "infrastructure", label: "Infra", width: 14 },
  { key: "region", label: "Region", width: 12 },
] as const
const COLUMN_GAP_WIDTH = 2

function pad(value: string, width: number): string {
  const clean = value ?? ""
  if (clean.length >= width) return clean.slice(0, Math.max(0, width - 1)) + "…"
  return clean + " ".repeat(width - clean.length)
}

/**
 * `/models` in table form.
 *
 * Renders a picker with optional metadata columns:
 *
 *   Name  |  Vendor  |  Infra  |  Region
 *
 * Metadata comes from the model fields exposed by the provider service, which
 * includes values configured in `opencode.json(c)`.
 *
 * Built on top of `DialogSelect` so fuzzy filter, keyboard nav, scrolling,
 * keybinds for favorites, and current-model indicator are all inherited from
 * the existing picker. Columns are aligned by pre-padding the option `title`.
 */
export function DialogModelTable(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const keybind = useKeybind()
  const [query, setQuery] = createSignal("")

  const connected = useConnected()

  onMount(() => {
    dialog.setSize("xlarge")
  })

  const showExtra = createMemo(() => connected() && !props.providerID)
  const metadataColumns = createMemo(() =>
    METADATA_COLUMNS.filter((column) =>
      sync.data.provider.some((provider) =>
        Object.values(provider.models).some(
          (model) =>
            model.status !== "deprecated" &&
            (props.providerID ? model.providerID === props.providerID : true) &&
            Boolean(model[column.key]),
        ),
      ),
    ),
  )

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
      const displayName = model.name ?? modelID
      const columns = metadataColumns().map((column) => pad(model[column.key] ?? "", column.width))
      return {
        value: { providerID: provider.id, modelID },
        title: [pad(displayName, NAME_COL_WIDTH), ...columns].join("  "),
        category:
          category === provider.name && (model.infrastructure === "NVIDIA" || model.infrastructure === "NV Inference")
            ? "NV Inference"
            : category,
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
    return "Select model  " + [pad("Name", NAME_COL_WIDTH), ...metadataColumns().map((x) => pad(x.label, x.width))].join("  ")
  })

  const titleMaxWidth = createMemo(
    () => NAME_COL_WIDTH + metadataColumns().reduce((total, column) => total + COLUMN_GAP_WIDTH + column.width, 0),
  )

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
      titleMaxWidth={titleMaxWidth()}
      title={title()}
      current={local.model.current()}
    />
  )
}
