import { packageStatusLabels, statusBadgeClass, taskStatusLabels } from "@/lib/labels";
import type { AnnotationPackage, Task } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

export function TaskMeta({ task }: { task: Task }) {
  return (
    <div className="row">
      <span className={statusBadgeClass(task.status)}>{taskStatusLabels[task.status]}</span>
      <span className="badge">截止 {formatDate(task.deadline)}</span>
      <span className="badge">正式数据 {task.formalItems.length} 条</span>
      <span className="badge">单价 {money(task.quotedUnitPrice ?? task.manualUnitPrice ?? 0)}</span>
    </div>
  );
}

export function PackageBadge({ pkg }: { pkg: AnnotationPackage }) {
  return <span className={statusBadgeClass(pkg.status)}>{packageStatusLabels[pkg.status]}</span>;
}
