import type { AnnotationItem, Task } from "@/lib/types";

function collectImages(items: AnnotationItem[]) {
  return items.flatMap((item) => item.imageUrls).filter(Boolean);
}

function hashText(text: string) {
  return Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function taskCoverImage(task: Task, preferred: "formal" | "trial" = "formal") {
  const primary = preferred === "formal" ? collectImages(task.formalItems) : collectImages(task.trialItems);
  const fallback = preferred === "formal" ? collectImages(task.trialItems) : collectImages(task.formalItems);
  const images = Array.from(new Set([...primary, ...fallback]));

  if (!images.length) return undefined;
  return images[hashText(task.id) % images.length];
}
