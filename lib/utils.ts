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

export type ParsedImageRow = {
  imageUrls: string[];
  sourceData?: Record<string, unknown>;
};

export function parseImageRows(rows: string) {
  return rows
    .split("\n")
    .map((line) => parseImageRow(line.trim()))
    .filter((row): row is ParsedImageRow => Boolean(row && row.imageUrls.length > 0));
}

function parseImageRow(line: string): ParsedImageRow | null {
  if (!line) return null;

  if (line.startsWith("{")) {
    try {
      const sourceData = JSON.parse(line) as Record<string, unknown>;
      const imageValue = sourceData.imageName ?? sourceData.imageUrl ?? sourceData.imageUrls;
      const imageUrls = normalizeImageValue(imageValue);
      return imageUrls.length > 0 ? { imageUrls, sourceData } : null;
    } catch {
      return null;
    }
  }

  const imageUrls = line
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return imageUrls.length > 0 ? { imageUrls } : null;
}

function normalizeImageValue(value: unknown) {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  }
  return [];
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
