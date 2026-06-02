export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function parseImageRows(rows: string) {
  return rows
    .split("\n")
    .map((line) =>
      line
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    )
    .filter((urls) => urls.length > 0);
}

export function sampleIndexes(total: number, size: number, mode: "first_n" | "random_n") {
  const count = Math.max(0, Math.min(total, size));
  if (mode === "first_n") return Array.from({ length: count }, (_, index) => index);
  const indexes = Array.from({ length: total }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes.slice(0, count).sort((a, b) => a - b);
}

export function money(value: number) {
  return `¥${value.toFixed(2)}`;
}
