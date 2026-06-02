import type {
  AnnotationItem,
  AnnotationPackage,
  AnnotationValue,
  DraftTaskInput,
  LabelConfig,
  RejectionIssueType,
  ReviewSamplingMode,
  Task
} from "./types";
import { nowIso, parseImageRows, sampleIndexes, uid } from "./utils";

export function createTaskFromInput(input: DraftTaskInput, requesterId: string, publish: boolean): Task {
  const imageSets = parseImageRows(input.imageRows);
  const trialIndexes =
    input.entryMode === "trial_quote"
      ? sampleIndexes(imageSets.length, input.trialSampleSize, input.trialSamplingMode)
      : [];
  const trialIndexSet = new Set(trialIndexes);
  const trialItems: AnnotationItem[] = [];
  const formalItems: AnnotationItem[] = [];

  imageSets.forEach((imageUrls, index) => {
    const annotationItem: AnnotationItem = {
      id: uid("item"),
      imageUrls,
      reviewStatus: "not_submitted",
      updatedAt: nowIso()
    };
    if (trialIndexSet.has(index)) {
      trialItems.push(annotationItem);
    } else {
      formalItems.push(annotationItem);
    }
  });

  const isDirect = input.entryMode === "direct_formal";
  const status = publish ? (isDirect ? "formal_in_progress" : "pending_trial") : "draft";
  const stage = publish ? (isDirect ? "formal" : "trial") : "draft";
  const selectedAnnotatorId = isDirect ? input.assignedAnnotatorId : undefined;

  return {
    id: uid("task"),
    title: input.title,
    description: input.description,
    annotationType: "image_annotation",
    creationMode: input.creationMode,
    historyTaskId: input.historyTaskId,
    entryMode: input.entryMode,
    trialSamplingMode: input.entryMode === "trial_quote" ? input.trialSamplingMode : undefined,
    trialSampleSize: input.entryMode === "trial_quote" ? input.trialSampleSize : undefined,
    rules: input.rules,
    trainingContent: input.trainingContent,
    stage,
    status,
    requesterId,
    assignedAnnotatorId: input.assignedAnnotatorId,
    selectedAnnotatorId,
    quotedUnitPrice: isDirect ? input.manualUnitPrice : undefined,
    manualUnitPrice: input.manualUnitPrice,
    deadline: input.deadline,
    displayConfig: input.displayConfig,
    labelConfigs: input.labelConfigs,
    trialItems,
    formalItems,
    packages: [],
    reviewBatches: [],
    quotes: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function updateTaskFromInput(existing: Task, input: DraftTaskInput, publish: boolean): Task {
  const next = createTaskFromInput(input, existing.requesterId, publish);
  return {
    ...next,
    id: existing.id,
    createdAt: existing.createdAt,
    quotes: publish ? next.quotes : existing.quotes,
    packages: publish ? next.packages : existing.packages,
    reviewBatches: publish ? next.reviewBatches : existing.reviewBatches,
    updatedAt: nowIso()
  };
}

export function selectQuote(task: Task, quoteId: string): Task {
  const quote = task.quotes.find((item) => item.id === quoteId);
  if (!quote) return task;
  return {
    ...task,
    stage: "formal",
    status: "formal_in_progress",
    selectedAnnotatorId: quote.annotatorId,
    quotedUnitPrice: quote.unitPrice,
    quotes: task.quotes.map((item) => ({
      ...item,
      status: item.id === quoteId ? "selected" : "not_selected"
    })),
    updatedAt: nowIso()
  };
}

export function submitQuote(task: Task, annotatorId: string, unitPrice: number, quoteNote: string, values: Record<string, AnnotationValue[]>): Task {
  const trialItems = task.trialItems.map((item) => ({
    ...item,
    annotationValues: values[item.id] ?? item.annotationValues,
    reviewStatus: "not_submitted" as const,
    updatedAt: nowIso()
  }));
  const existing = task.quotes.find((quote) => quote.annotatorId === annotatorId);
  const quote = {
    id: existing?.id ?? uid("quote"),
    taskId: task.id,
    annotatorId,
    trialItemIds: trialItems.map((item) => item.id),
    unitPrice,
    quoteNote,
    status: "submitted" as const,
    submittedAt: nowIso()
  };

  return {
    ...task,
    trialItems,
    stage: "trial",
    status: "pending_quote_selection",
    quotes: existing
      ? task.quotes.map((item) => (item.id === existing.id ? quote : item))
      : [...task.quotes, quote],
    updatedAt: nowIso()
  };
}

export function ensurePackages(task: Task, annotatorId: string, packageSize: number): Task {
  if (task.packages.some((item) => item.status !== "not_started" && item.status !== "in_progress")) return task;
  const size = Math.max(1, packageSize);
  const packages: AnnotationPackage[] = [];
  const formalItems: AnnotationItem[] = task.formalItems.map((item) => ({ ...item, packageId: undefined }));
  for (let index = 0; index < formalItems.length; index += size) {
    const chunk = formalItems.slice(index, index + size);
    const packageId = uid("pkg");
    packages.push({
      id: packageId,
      taskId: task.id,
      annotatorId,
      itemIds: chunk.map((item) => item.id),
      status: "not_started",
      updatedAt: nowIso()
    });
    chunk.forEach((item) => {
      item.packageId = packageId;
    });
  }
  return { ...task, packages, formalItems, updatedAt: nowIso() };
}

export function updateFormalItem(task: Task, itemId: string, annotationValues: AnnotationValue[]): Task {
  return {
    ...task,
    formalItems: task.formalItems.map((item) =>
      item.id === itemId
        ? { ...item, annotationValues, reviewStatus: "not_submitted", updatedAt: nowIso() }
        : item
    ),
    packages: task.packages.map((pkg) =>
      pkg.itemIds.includes(itemId) && pkg.status === "not_started"
        ? { ...pkg, status: "in_progress", updatedAt: nowIso() }
        : pkg
    ),
    updatedAt: nowIso()
  };
}

export function submitPackage(task: Task, packageId: string): Task {
  const packageItem = task.packages.find((pkg) => pkg.id === packageId);
  if (!packageItem) return task;
  return {
    ...task,
    stage: "review",
    status: "pending_review",
    packages: task.packages.map((pkg) =>
      pkg.id === packageId
        ? { ...pkg, status: "pending_review", submittedAt: nowIso(), updatedAt: nowIso() }
        : pkg
    ),
    formalItems: task.formalItems.map((item) =>
      packageItem.itemIds.includes(item.id)
        ? { ...item, reviewStatus: "pending_review", updatedAt: nowIso() }
        : item
    ),
    updatedAt: nowIso()
  };
}

export function createReviewBatch(
  task: Task,
  packageId: string,
  samplingMode: ReviewSamplingMode,
  operatorId: string,
  sampleCount: number,
  manualItemIds: string[] = [],
  labelConfigId?: string,
  labelOptionIds: string[] = []
): Task {
  const packageItem = task.packages.find((pkg) => pkg.id === packageId);
  if (!packageItem) return task;
  let candidates = task.formalItems.filter((item) => packageItem.itemIds.includes(item.id));

  if (samplingMode === "label_filter" && labelConfigId && labelOptionIds.length > 0) {
    candidates = candidates.filter((item) => {
      const value = item.annotationValues?.find((entry) => entry.labelConfigId === labelConfigId)?.value;
      if (Array.isArray(value)) return value.some((optionId) => labelOptionIds.includes(optionId));
      return Boolean(value && labelOptionIds.includes(value));
    });
  }

  let sampledItemIds: string[];
  if (samplingMode === "manual") {
    sampledItemIds = manualItemIds.filter((id) => packageItem.itemIds.includes(id));
  } else {
    const indexes = sampleIndexes(candidates.length, sampleCount, "random_n");
    sampledItemIds = indexes.map((index) => candidates[index].id);
  }

  return {
    ...task,
    reviewBatches: [
      ...task.reviewBatches,
      {
        id: uid("batch"),
        taskId: task.id,
        packageId,
        samplingMode,
        sampledItemIds,
        approvedCount: 0,
        rejectedCount: 0,
        operatorId,
        createdAt: nowIso()
      }
    ],
    updatedAt: nowIso()
  };
}

export function approveReviewItem(task: Task, batchId: string, itemId: string): Task {
  return {
    ...task,
    reviewBatches: task.reviewBatches.map((batch) =>
      batch.id === batchId ? { ...batch, approvedCount: batch.approvedCount + 1 } : batch
    ),
    formalItems: task.formalItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            reviewStatus: "approved",
            rejectionIssueType: undefined,
            rejectionReason: undefined,
            updatedAt: nowIso()
          }
        : item
    ),
    updatedAt: nowIso()
  };
}

export function rejectReviewItem(
  task: Task,
  batchId: string,
  packageId: string,
  itemId: string,
  rejectionIssueType: RejectionIssueType,
  rejectionReason: string
): Task {
  return {
    ...task,
    status: "partially_rejected",
    packages: task.packages.map((pkg) =>
      pkg.id === packageId ? { ...pkg, status: "partially_rejected", updatedAt: nowIso() } : pkg
    ),
    reviewBatches: task.reviewBatches.map((batch) =>
      batch.id === batchId ? { ...batch, rejectedCount: batch.rejectedCount + 1 } : batch
    ),
    formalItems: task.formalItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            reviewStatus: "rejected",
            rejectionIssueType,
            rejectionReason,
            updatedAt: nowIso()
          }
        : item
    ),
    updatedAt: nowIso()
  };
}

export function approvePackage(task: Task, packageId: string): Task {
  const packageItem = task.packages.find((pkg) => pkg.id === packageId);
  if (!packageItem) return task;
  const packages = task.packages.map((pkg) =>
    pkg.id === packageId ? { ...pkg, status: "approved" as const, approvedAt: nowIso(), updatedAt: nowIso() } : pkg
  );
  const allApproved = packages.length > 0 && packages.every((pkg) => pkg.status === "approved");
  return {
    ...task,
    stage: allApproved ? "completed" : "review",
    status: allApproved ? "completed" : "pending_review",
    packages,
    formalItems: task.formalItems.map((item) =>
      packageItem.itemIds.includes(item.id) ? { ...item, reviewStatus: "approved", updatedAt: nowIso() } : item
    ),
    updatedAt: nowIso()
  };
}

export function appealItem(task: Task, itemId: string, appealReason: string): Task {
  return {
    ...task,
    formalItems: task.formalItems.map((item) =>
      item.id === itemId && !item.hasAppealed
        ? { ...item, reviewStatus: "appealed", appealReason, hasAppealed: true, updatedAt: nowIso() }
        : item
    ),
    updatedAt: nowIso()
  };
}

export function handleAppeal(task: Task, itemId: string, approve: boolean, handledReason: string): Task {
  return {
    ...task,
    formalItems: task.formalItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            reviewStatus: approve ? "approved" : "rejected",
            appealHandledReason: handledReason,
            updatedAt: nowIso()
          }
        : item
    ),
    updatedAt: nowIso()
  };
}

export function cancelTask(task: Task, cancelReason: string): Task {
  return {
    ...task,
    stage: "cancelled",
    status: "cancelled",
    cancelReason,
    cancelledAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function buildDownloadData(task: Task) {
  const allowed =
    task.status === "completed"
      ? task.formalItems
      : task.status === "cancelled"
        ? task.formalItems.filter((item) => item.reviewStatus === "approved")
        : [];

  return allowed.map((item) => ({
    imageUrls: item.imageUrls,
    labels:
      item.annotationValues?.map((value) => {
        const labelConfig = task.labelConfigs.find((config) => config.id === value.labelConfigId);
        return {
          question: labelConfig?.title ?? value.labelConfigId,
          value: labelValueText(labelConfig, value.value)
        };
      }) ?? []
  }));
}

function labelValueText(labelConfig: LabelConfig | undefined, value: string | string[]) {
  const values = Array.isArray(value) ? value : [value];
  const labels = values.map((id) => labelConfig?.options.find((option) => option.id === id)?.label ?? id);
  return Array.isArray(value) ? labels : labels[0];
}

export function taskStats(task: Task) {
  const approvedItems = task.formalItems.filter((item) => item.reviewStatus === "approved").length;
  const rejectedItems = task.formalItems.filter((item) => item.reviewStatus === "rejected").length;
  const pendingItems = task.formalItems.filter((item) => item.reviewStatus === "pending_review").length;
  const submittedItems = task.formalItems.filter((item) => item.annotationValues?.length).length;
  const unitPrice = task.quotedUnitPrice ?? task.manualUnitPrice ?? 0;
  return {
    approvedItems,
    rejectedItems,
    pendingItems,
    submittedItems,
    packageCount: task.packages.length,
    approvedPackages: task.packages.filter((pkg) => pkg.status === "approved").length,
    rejectedPackages: task.packages.filter((pkg) => pkg.status === "partially_rejected").length,
    amount: approvedItems * unitPrice
  };
}
