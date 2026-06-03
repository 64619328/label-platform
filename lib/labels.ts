import type { AnnotationReviewStatus, RejectionIssueType, TaskStatus, PackageStatus } from "./types";

export const taskStatusLabels: Record<TaskStatus, string> = {
  draft: "草稿",
  pending_trial: "待试标",
  trial_in_progress: "试标中",
  pending_quote_selection: "待选择报价",
  formal_in_progress: "正式标注中",
  pending_review: "待验收",
  partially_rejected: "部分驳回",
  completed: "已完成",
  cancelled: "已中止"
};

export const packageStatusLabels: Record<PackageStatus, string> = {
  not_started: "未开始",
  in_progress: "标注中",
  pending_review: "待验收",
  approved: "已通过",
  partially_rejected: "部分驳回"
};

export const annotationReviewStatusLabels: Record<AnnotationReviewStatus, string> = {
  not_submitted: "未提交",
  pending_review: "待验收",
  approved: "已通过",
  rejected: "已驳回",
  appealed: "已申诉"
};

export const issueTypeLabels: Record<RejectionIssueType, string> = {
  label_error: "标签错误",
  image_unclear: "图片无法判断",
  rule_misunderstanding: "规则理解错误",
  missing_annotation: "漏标/少标",
  other: "其他"
};

export function statusBadgeClass(status: TaskStatus | PackageStatus | AnnotationReviewStatus) {
  if (status === "completed" || status === "approved") return "badge ok";
  if (status === "cancelled" || status === "partially_rejected" || status === "rejected") return "badge danger";
  if (status === "pending_review" || status === "pending_quote_selection" || status === "appealed") return "badge warn";
  return "badge";
}
