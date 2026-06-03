export type UserRole = "requester" | "annotator";

export type DemoUser = {
  id: string;
  role: UserRole;
  name: string;
};

export type TaskStatus =
  | "draft"
  | "pending_trial"
  | "trial_in_progress"
  | "pending_quote_selection"
  | "formal_in_progress"
  | "pending_review"
  | "partially_rejected"
  | "completed"
  | "cancelled";

export type TaskStage = "draft" | "trial" | "formal" | "review" | "completed" | "cancelled";
export type AnnotationType = "image_annotation";
export type TaskCreationMode = "from_scratch" | "from_history";
export type TaskEntryMode = "trial_quote" | "direct_formal";
export type TrialSamplingMode = "first_n" | "random_n";

export type ImageDataMode = "single_image" | "multi_image";
export type MultiImageDisplayMode = "parallel" | "carousel";
export type ZoomDisplayMode = "modal" | "fullscreen";

export type DisplayConfig = {
  imageDataMode: ImageDataMode;
  multiImageDisplayMode?: MultiImageDisplayMode;
  enableDoubleClickZoom: boolean;
  zoomDisplayMode?: ZoomDisplayMode;
};

export type LabelSelectionMode = "single" | "multiple";

export type LabelOption = {
  id: string;
  label: string;
  criteria: string;
};

export type LabelConfig = {
  id: string;
  title: string;
  selectionMode: LabelSelectionMode;
  options: LabelOption[];
};

export type AnnotationValue = {
  labelConfigId: string;
  value: string | string[];
};

export type AnnotationReviewStatus =
  | "not_submitted"
  | "pending_review"
  | "approved"
  | "rejected"
  | "appealed";

export type RejectionIssueType =
  | "label_error"
  | "image_unclear"
  | "rule_misunderstanding"
  | "missing_annotation"
  | "other";

export type AnnotationItem = {
  id: string;
  imageUrls: string[];
  sourceData?: Record<string, unknown>;
  packageId?: string;
  annotationValues?: AnnotationValue[];
  annotationNote?: string;
  reviewStatus: AnnotationReviewStatus;
  rejectionIssueType?: RejectionIssueType;
  rejectionReason?: string;
  appealReason?: string;
  appealHandledReason?: string;
  hasAppealed?: boolean;
  updatedAt: string;
};

export type PackageStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "approved"
  | "partially_rejected";

export type AnnotationPackage = {
  id: string;
  taskId: string;
  annotatorId?: string;
  itemIds: string[];
  status: PackageStatus;
  submittedAt?: string;
  approvedAt?: string;
  updatedAt: string;
};

export type ReviewSamplingMode = "random" | "label_filter" | "manual";

export type ReviewBatch = {
  id: string;
  taskId: string;
  packageId: string;
  samplingMode: ReviewSamplingMode;
  sampledItemIds: string[];
  approvedCount: number;
  rejectedCount: number;
  operatorId: string;
  createdAt: string;
};

export type QuoteStatus = "draft" | "submitted" | "selected" | "not_selected";
export type TrialReviewStatus = "pending" | "approved" | "rejected";

export type Quote = {
  id: string;
  taskId: string;
  annotatorId: string;
  trialItemIds: string[];
  trialValues?: Record<string, AnnotationValue[]>;
  trialReviewStatus?: TrialReviewStatus;
  unitPrice: number;
  quoteNote: string;
  status: QuoteStatus;
  submittedAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  annotationType: AnnotationType;
  creationMode: TaskCreationMode;
  historyTaskId?: string;
  entryMode: TaskEntryMode;
  trialSamplingMode?: TrialSamplingMode;
  trialSampleSize?: number;
  rules: string;
  trainingContent: string;
  stage: TaskStage;
  status: TaskStatus;
  requesterId: string;
  assignedAnnotatorId?: string;
  selectedAnnotatorId?: string;
  quotedUnitPrice?: number;
  manualUnitPrice?: number;
  deadline: string;
  displayConfig: DisplayConfig;
  labelConfigs: LabelConfig[];
  trialItems: AnnotationItem[];
  formalItems: AnnotationItem[];
  packages: AnnotationPackage[];
  reviewBatches: ReviewBatch[];
  quotes: Quote[];
  cancelReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DraftTaskInput = {
  title: string;
  description: string;
  trainingContent: string;
  rules: string;
  deadline: string;
  creationMode: TaskCreationMode;
  historyTaskId?: string;
  entryMode: TaskEntryMode;
  assignedAnnotatorId?: string;
  manualUnitPrice?: number;
  imageRows: string;
  trialSamplingMode: TrialSamplingMode;
  trialSampleSize: number;
  displayConfig: DisplayConfig;
  labelConfigs: LabelConfig[];
};
