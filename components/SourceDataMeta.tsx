import type { AnnotationItem } from "@/lib/types";

export function SourceDataMeta({ item }: { item: AnnotationItem }) {
  if (!item.sourceData) return null;
  return (
    <div className="row">
      {Object.entries(item.sourceData).map(([key, value]) => (
        <span className="badge" key={key}>
          {key}: {String(value)}
        </span>
      ))}
    </div>
  );
}
