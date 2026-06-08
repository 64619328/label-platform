"use client";

import { useEffect, useMemo, useState } from "react";
import { DisplayLayoutBuilder } from "@/components/DisplayLayoutBuilder";
import { RequesterShell } from "@/components/RequesterShell";
import { defaultLabelConfigs } from "@/lib/demo-data";
import { validateDisplayConfigLayout } from "@/lib/display-layout";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import { createTaskFromInput, updateTaskFromInput } from "@/lib/task-actions";
import type { DisplayConfig, DraftTaskInput, LabelConfig, Task, TaskCreationMode, TaskEntryMode, TrialSamplingMode } from "@/lib/types";
import { parseImageRows, uid } from "@/lib/utils";

const defaultImages = `{"imageUrls":["https://picsum.photos/id/1011/640/420","https://picsum.photos/id/1025/640/420","https://picsum.photos/id/1035/640/420"],"prompt":"请判断主图与参考图是否存在明显内容差异。","category":"商品图"}
{"imageUrls":["https://picsum.photos/id/1015/640/420","https://picsum.photos/id/1041/640/420"],"prompt":"对比两张图的主体、背景和画面质量。","category":"对比图"}
{"imageUrls":["https://picsum.photos/id/1050/640/420","https://picsum.photos/id/1062/640/420","https://picsum.photos/id/1074/640/420"],"prompt":"综合多张图判断是否满足标注规则。","category":"多图"}
{"imageUrls":["https://picsum.photos/id/1084/640/420","https://picsum.photos/id/1080/640/420"],"prompt":"无法判断时请选择无法判断，并在备注中说明原因。","category":"复核"}`;

const steps = ["任务配置", "数据与流程", "展示配置", "标签配置"];

type ValidationError = {
  step: number;
  field: string;
  message: string;
};

export default function NewTaskPage() {
  const [editId, setEditId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("");
  const [savingMode, setSavingMode] = useState<"draft" | "publish" | "">("");
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [creationMode, setCreationMode] = useState<TaskCreationMode>("from_scratch");
  const [historyTaskId, setHistoryTaskId] = useState("");
  const [entryMode, setEntryMode] = useState<TaskEntryMode>("trial_quote");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("请按规则完成图片安全和场景判断。");
  const [trainingContent, setTrainingContent] = useState("多图数据需要综合判断，无法判断时请选择无法判断。");
  const [rules, setRules] = useState("完成所有问题组后才能提交。");
  const [deadline, setDeadline] = useState("2026-06-30");
  const [assignedAnnotatorId, setAssignedAnnotatorId] = useState("");
  const [manualUnitPrice, setManualUnitPrice] = useState(1.2);
  const [imageRows, setImageRows] = useState(defaultImages);
  const [trialSamplingMode, setTrialSamplingMode] = useState<TrialSamplingMode>("first_n");
  const [trialSampleSize, setTrialSampleSize] = useState(2);
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>({
    layoutMode: "custom",
    imageDataMode: "multi_image",
    multiImageDisplayMode: "parallel",
    enableDoubleClickZoom: true,
    zoomDisplayMode: "fullscreen",
    canvasRatio: "16:9",
    detailViewer: {
      enabled: true,
      navigation: "all_media"
    },
    frames: [
      { id: "frame_main_image", type: "image", label: "主图", bindingKey: "image_1", x: 0, y: 0, w: 58.3333, h: 62.5, fit: "contain", allowFullscreen: true },
      { id: "frame_ref_image", type: "image", label: "参考图", bindingKey: "image_2", x: 58.3333, y: 0, w: 41.6667, h: 62.5, fit: "contain", allowFullscreen: true },
      { id: "frame_prompt", type: "text", label: "辅助文本", bindingKey: "prompt", x: 0, y: 62.5, w: 100, h: 37.5, allowFullscreen: false }
    ]
  });
  const [labelConfigs, setLabelConfigs] = useState<LabelConfig[]>(defaultLabelConfigs);

  useEffect(() => {
    if (getCurrentUser().role !== "requester") {
      window.location.href = "/annotator/tasks";
      return;
    }

    const id = new URLSearchParams(window.location.search).get("edit");
    setEditId(id);
    const loaded = getTasks();
    setTasks(loaded);
    const editing = loaded.find((task) => task.id === id);
    if (editing) {
      setCreationMode(editing.creationMode);
      setHistoryTaskId(editing.historyTaskId ?? "");
      setEntryMode(editing.entryMode);
      setTitle(editing.title);
      setDescription(editing.description);
      setTrainingContent(editing.trainingContent);
      setRules(editing.rules);
      setDeadline(editing.deadline);
      setAssignedAnnotatorId(editing.assignedAnnotatorId ?? "");
      setManualUnitPrice(editing.manualUnitPrice ?? editing.quotedUnitPrice ?? 1.2);
      setImageRows([...editing.trialItems, ...editing.formalItems].map((item) => item.sourceData ? JSON.stringify(item.sourceData) : item.imageUrls.join(", ")).join("\n") || defaultImages);
      setTrialSamplingMode(editing.trialSamplingMode ?? "first_n");
      setTrialSampleSize(editing.trialSampleSize ?? Math.max(1, editing.trialItems.length));
      setDisplayConfig(editing.displayConfig);
      setLabelConfigs(editing.labelConfigs);
    }
  }, []);

  const users = getUsers();
  const annotators = users.filter((user) => user.role === "annotator");
  const historyTasks = useMemo(() => tasks.filter((task) => task.status === "completed"), [tasks]);
  const parsedRows = useMemo(() => parseImageRows(imageRows), [imageRows]);
  const previewRow = parsedRows[0];

  function applyHistory(id: string) {
    setHistoryTaskId(id);
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setTitle(`${task.title} · 新批次`);
    setDescription(task.description);
    setTrainingContent(task.trainingContent);
    setRules(task.rules);
    setAssignedAnnotatorId(task.assignedAnnotatorId ?? "");
    setManualUnitPrice(task.quotedUnitPrice ?? task.manualUnitPrice ?? 1);
    setDisplayConfig(task.displayConfig);
    setLabelConfigs(task.labelConfigs);
  }

  function updateLabelTitle(index: number, titleValue: string) {
    setLabelConfigs((current) => current.map((config, i) => (i === index ? { ...config, title: titleValue } : config)));
  }

  function updateLabelMode(index: number, mode: LabelConfig["selectionMode"]) {
    setLabelConfigs((current) => current.map((config, i) => (i === index ? { ...config, selectionMode: mode } : config)));
  }

  function updateOption(configIndex: number, optionIndex: number, field: "label" | "criteria", value: string) {
    setLabelConfigs((current) =>
      current.map((config, i) =>
        i === configIndex
          ? {
              ...config,
              options: config.options.map((option, j) => (j === optionIndex ? { ...option, [field]: value } : option))
            }
          : config
      )
    );
  }

  function addLabelGroup() {
    setLabelConfigs((current) => [
      ...current,
      {
        id: uid("label"),
        title: "新问题组",
        selectionMode: "single",
        options: [{ id: uid("option"), label: "选项 A", criteria: "填写该选项的判断依据。" }]
      }
    ]);
  }

  function addOption(configIndex: number) {
    setLabelConfigs((current) =>
      current.map((config, i) =>
        i === configIndex
          ? {
              ...config,
              options: [...config.options, { id: uid("option"), label: `选项 ${config.options.length + 1}`, criteria: "填写该选项的判断依据。" }]
            }
          : config
      )
    );
  }

  function removeOption(configIndex: number, optionIndex: number) {
    setLabelConfigs((current) =>
      current.map((config, i) =>
        i === configIndex
          ? { ...config, options: config.options.filter((_, j) => j !== optionIndex) }
          : config
      )
    );
  }

  function buildInput(): DraftTaskInput {
    return {
      title,
      description,
      trainingContent,
      rules,
      deadline,
      creationMode,
      historyTaskId: creationMode === "from_history" ? historyTaskId : undefined,
      entryMode,
      assignedAnnotatorId: assignedAnnotatorId || undefined,
      manualUnitPrice,
      imageRows,
      trialSamplingMode,
      trialSampleSize,
      displayConfig,
      labelConfigs
    };
  }

  function validate(publish: boolean): ValidationError | null {
    if (creationMode === "from_history" && !historyTaskId) return { step: 0, field: "historyTaskId", message: "请选择历史任务" };
    if (!title.trim()) return { step: 0, field: "title", message: "请填写任务名称" };
    if (!imageRows.trim()) return { step: 1, field: "imageRows", message: "请填写图片 URL 或 JSON 数据" };
    if (parseImageRows(imageRows).length === 0) return { step: 1, field: "imageRows", message: "请填写有效数据：支持图片 URL 行，或每行包含 imageName 字段的 JSON" };
    if (publish && entryMode === "direct_formal" && !assignedAnnotatorId) return { step: 1, field: "assignedAnnotatorId", message: "直接进入正式标注必须指定标注方" };
    if (publish && entryMode === "direct_formal" && creationMode === "from_scratch" && manualUnitPrice <= 0) return { step: 1, field: "manualUnitPrice", message: "请填写大于 0 的手动单价" };
    if (publish && entryMode === "trial_quote" && trialSampleSize <= 0) return { step: 1, field: "trialSampleSize", message: "请填写大于 0 的试标数据条数" };
    const displayLayoutError = validateDisplayConfigLayout(displayConfig);
    if (displayLayoutError) return { step: 2, field: "displayLayout", message: displayLayoutError };

    for (const [configIndex, config] of labelConfigs.entries()) {
      if (!config.title.trim()) return { step: 3, field: `label-title-${configIndex}`, message: `请填写第 ${configIndex + 1} 个问题组标题` };
      if (config.options.length === 0) return { step: 3, field: `label-options-${configIndex}`, message: `第 ${configIndex + 1} 个问题组需要至少一个选项` };
      for (const [optionIndex, option] of config.options.entries()) {
        if (!option.label.trim()) return { step: 3, field: `option-label-${configIndex}-${optionIndex}`, message: `请填写第 ${configIndex + 1} 个问题组第 ${optionIndex + 1} 个选项名称` };
        if (!option.criteria.trim()) return { step: 3, field: `option-criteria-${configIndex}-${optionIndex}`, message: `请填写第 ${configIndex + 1} 个问题组第 ${optionIndex + 1} 个判断依据` };
      }
    }

    return null;
  }

  function validateStep(step: number): ValidationError | null {
    if (step === 0) {
      if (creationMode === "from_history" && !historyTaskId) return { step: 0, field: "historyTaskId", message: "请选择历史任务" };
      if (!title.trim()) return { step: 0, field: "title", message: "请填写任务名称" };
    }
    if (step === 1) {
      if (!imageRows.trim()) return { step: 1, field: "imageRows", message: "请填写图片 URL 或 JSON 数据" };
      if (parseImageRows(imageRows).length === 0) return { step: 1, field: "imageRows", message: "请填写有效数据：支持图片 URL 行，或每行包含 imageName 字段的 JSON" };
      if (entryMode === "trial_quote" && trialSampleSize <= 0) return { step: 1, field: "trialSampleSize", message: "请填写大于 0 的试标数据条数" };
    }
    if (step === 2) {
      const displayLayoutError = validateDisplayConfigLayout(displayConfig);
      if (displayLayoutError) return { step: 2, field: "displayLayout", message: displayLayoutError };
    }
    if (step === 3) {
      for (const [configIndex, config] of labelConfigs.entries()) {
        if (!config.title.trim()) return { step: 3, field: `label-title-${configIndex}`, message: `请填写第 ${configIndex + 1} 个问题组标题` };
        if (config.options.length === 0) return { step: 3, field: `label-options-${configIndex}`, message: `第 ${configIndex + 1} 个问题组需要至少一个选项` };
        for (const [optionIndex, option] of config.options.entries()) {
          if (!option.label.trim()) return { step: 3, field: `option-label-${configIndex}-${optionIndex}`, message: `请填写第 ${configIndex + 1} 个问题组第 ${optionIndex + 1} 个选项名称` };
          if (!option.criteria.trim()) return { step: 3, field: `option-criteria-${configIndex}-${optionIndex}`, message: `请填写第 ${configIndex + 1} 个问题组第 ${optionIndex + 1} 个判断依据` };
        }
      }
    }
    return null;
  }

  function focusError(error = validationError) {
    if (!error) return;
    window.setTimeout(() => {
      const target = document.querySelector(`[data-error-field="${error.field}"]`) ?? document.querySelector(".validation-alert");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  function setError(error: ValidationError) {
    setMessage("");
    setValidationError(error);
    setActiveStep(error.step);
    focusError(error);
  }

  function goNext() {
    const error = validateStep(activeStep);
    if (error) {
      setError(error);
      return;
    }
    setValidationError(null);
    setActiveStep((step) => Math.min(steps.length - 1, step + 1));
  }

  function save(publish: boolean) {
    const error = validate(publish);
    if (error) {
      setError(error);
      return;
    }
    setValidationError(null);
    const currentUser = getCurrentUser();
    if (currentUser.role !== "requester") {
      setMessage("当前身份不能发布任务");
      window.location.href = "/annotator/tasks";
      return;
    }
    setSavingMode(publish ? "publish" : "draft");
    const existing = tasks.find((task) => task.id === editId);
    const nextTask = existing ? updateTaskFromInput(existing, buildInput(), publish) : createTaskFromInput(buildInput(), currentUser.id, publish);
    const nextTasks = existing ? tasks.map((task) => (task.id === existing.id ? nextTask : task)) : [...tasks, nextTask];
    saveTasks(nextTasks);
    const params = new URLSearchParams({
      filter: nextTask.status,
      created: nextTask.id,
      toast: publish ? (existing?.status === "draft" ? "draft_published" : "published") : "draft_saved"
    });
    window.location.href = `/requester/dashboard?${params.toString()}#task-list`;
  }

  function fieldClass(field: string) {
    return validationError?.field === field ? "field field-error" : "field";
  }

  function fieldMessage(field: string) {
    return validationError?.field === field ? <p className="field-error-message">{validationError.message}</p> : null;
  }

  return (
    <RequesterShell title={editId ? "编辑任务草稿" : "发布任务"}>
      <div className="page grid">
        {message ? <div className="panel">{message}</div> : null}
        {validationError ? (
          <div className="validation-alert task-form-alert" role="alert">
            <div>
              <strong>无法继续</strong>
              <span>{validationError.message}</span>
            </div>
            <button onClick={() => focusError()}>定位到错误项</button>
          </div>
        ) : null}

        <section className="task-wizard">
          <div className="wizard-steps">
            {steps.map((step, index) => (
              <button
                key={step}
                className={index === activeStep ? "wizard-step active" : index < activeStep ? "wizard-step done" : "wizard-step"}
                onClick={() => setActiveStep(index)}
              >
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </button>
            ))}
          </div>

          <div className="panel grid wizard-panel">
            {activeStep === 0 ? (
              <>
                <div>
                  <h2>任务配置</h2>
                  <p className="muted">先确定创建方式、任务进入方式和标注说明。</p>
                </div>
                <div className="field">
                  <label>创建方式</label>
                  <select value={creationMode} onChange={(event) => setCreationMode(event.target.value as TaskCreationMode)}>
                    <option value="from_scratch">从 0 创建</option>
                    <option value="from_history">基于历史任务创建</option>
                  </select>
                </div>
                {creationMode === "from_history" ? (
                  <div className={fieldClass("historyTaskId")} data-error-field="historyTaskId">
                    <label>历史任务</label>
                    <select value={historyTaskId} onChange={(event) => applyHistory(event.target.value)}>
                      <option value="">请选择</option>
                      {historyTasks.map((task) => (
                        <option value={task.id} key={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    {fieldMessage("historyTaskId")}
                  </div>
                ) : null}
                <div className="field">
                  <label>任务进入方式</label>
                  <select value={entryMode} onChange={(event) => setEntryMode(event.target.value as TaskEntryMode)}>
                    <option value="trial_quote">试标报价后进入正式标注</option>
                    <option value="direct_formal">直接进入正式标注</option>
                  </select>
                </div>
                <div className={fieldClass("title")} data-error-field="title">
                  <label>任务名称</label>
                  <input placeholder="请输入任务名称，如：商品图安全审核标注" value={title} onChange={(event) => setTitle(event.target.value)} />
                  {fieldMessage("title")}
                </div>
                <div className="field">
                  <label>任务描述</label>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
                </div>
                <div className="field">
                  <label>培训说明</label>
                  <textarea value={trainingContent} onChange={(event) => setTrainingContent(event.target.value)} />
                </div>
                <div className="field">
                  <label>标注规则</label>
                  <textarea value={rules} onChange={(event) => setRules(event.target.value)} />
                </div>
              </>
            ) : null}

            {activeStep === 1 ? (
              <>
                <div>
                  <h2>数据与流程</h2>
                  <p className="muted">配置截止时间、标注方分配、试标抽样和图片 URL 数据。</p>
                </div>
                <div className="grid two">
                  <div className="field">
                    <label>截止时间</label>
                    <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
                  </div>
                  <div className={fieldClass("assignedAnnotatorId")} data-error-field="assignedAnnotatorId">
                    <label>指定标注方</label>
                    <select value={assignedAnnotatorId} onChange={(event) => setAssignedAnnotatorId(event.target.value)}>
                      <option value="">不指定</option>
                      {annotators.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    {fieldMessage("assignedAnnotatorId")}
                  </div>
                </div>
                {entryMode === "direct_formal" ? (
                  <div className={fieldClass("manualUnitPrice")} data-error-field="manualUnitPrice">
                    <label>手动单价（每条数据）</label>
                    <input type="number" min="0" step="0.01" value={manualUnitPrice} onChange={(event) => setManualUnitPrice(Number(event.target.value))} />
                    {fieldMessage("manualUnitPrice")}
                  </div>
                ) : (
                  <div className="grid two">
                    <div className="field">
                      <label>试标抽取方式</label>
                      <select value={trialSamplingMode} onChange={(event) => setTrialSamplingMode(event.target.value as TrialSamplingMode)}>
                        <option value="first_n">前 N 条</option>
                        <option value="random_n">随机 N 条</option>
                      </select>
                    </div>
                    <div className={fieldClass("trialSampleSize")} data-error-field="trialSampleSize">
                      <label>试标条数</label>
                      <input type="number" min="1" value={trialSampleSize} onChange={(event) => setTrialSampleSize(Number(event.target.value))} />
                      {fieldMessage("trialSampleSize")}
                    </div>
                  </div>
                )}
                <div className={fieldClass("imageRows")} data-error-field="imageRows">
                  <label>数据内容</label>
                  <textarea
                    style={{ minHeight: 220 }}
                    placeholder='支持每行一个图片 URL，或每行一个 JSON，如 {"category":"个人护理","imageName":"https://example.com/a.jpg","msg":"10208648311521"}'
                    value={imageRows}
                    onChange={(event) => setImageRows(event.target.value)}
                  />
                  {fieldMessage("imageRows")}
                </div>
              </>
            ) : null}

            {activeStep === 2 ? (
              <>
                <div>
                  <h2>展示配置</h2>
                  <p className="muted">配置每条数据默认展示画布；点击预览模式后，可以确认进入标注页时的展示效果。</p>
                </div>
                <div data-error-field="displayLayout">
                  <DisplayLayoutBuilder
                    value={displayConfig}
                    onChange={setDisplayConfig}
                    sampleImageUrls={previewRow?.imageUrls ?? []}
                    sampleSourceData={previewRow?.sourceData}
                  />
                  {fieldMessage("displayLayout")}
                </div>
              </>
            ) : null}

            {activeStep === 3 ? (
              <>
                <div className="label-config-head">
                  <div>
                    <h2>标签配置</h2>
                    <p className="muted">配置问题组、选择方式和选项判断依据。</p>
                  </div>
                  <button className="primary compact-action" onClick={addLabelGroup}>添加问题组</button>
                </div>
                {labelConfigs.map((config, index) => (
                  <div className="label-group-card" key={config.id}>
                    <div className="label-group-title">
                      <span className="badge">问题组 {index + 1}</span>
                      <button className="compact-action" onClick={() => addOption(index)}>添加选项</button>
                    </div>
                    <div className="label-group-fields">
                      <div className={fieldClass(`label-title-${index}`)} data-error-field={`label-title-${index}`}>
                        <label>问题组标题</label>
                        <input value={config.title} onChange={(event) => updateLabelTitle(index, event.target.value)} />
                        {fieldMessage(`label-title-${index}`)}
                      </div>
                      <div className="field">
                        <label>选择方式</label>
                        <select value={config.selectionMode} onChange={(event) => updateLabelMode(index, event.target.value as LabelConfig["selectionMode"])}>
                          <option value="single">单选</option>
                          <option value="multiple">多选</option>
                        </select>
                      </div>
                    </div>
                    <div className="label-options-table">
                      <div className="label-option-header">
                        <span>选项名称</span>
                        <span>判断依据</span>
                        <span>操作</span>
                      </div>
                      {config.options.map((option, optionIndex) => (
                        <div className="label-option-editor-row" key={option.id}>
                          <div className={fieldClass(`option-label-${index}-${optionIndex}`)} data-error-field={`option-label-${index}-${optionIndex}`}>
                            <label className="mobile-only">选项名称</label>
                            <input value={option.label} onChange={(event) => updateOption(index, optionIndex, "label", event.target.value)} />
                            {fieldMessage(`option-label-${index}-${optionIndex}`)}
                          </div>
                          <div className={fieldClass(`option-criteria-${index}-${optionIndex}`)} data-error-field={`option-criteria-${index}-${optionIndex}`}>
                            <label className="mobile-only">判断依据</label>
                            <input value={option.criteria} onChange={(event) => updateOption(index, optionIndex, "criteria", event.target.value)} />
                            {fieldMessage(`option-criteria-${index}-${optionIndex}`)}
                          </div>
                          <button className="compact-action" disabled={config.options.length <= 1} onClick={() => removeOption(index, optionIndex)}>
                            删除选项
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </section>

        <div className="save-action-zone">
          <div className="row between">
            <div className="row">
              <button disabled={activeStep === 0} onClick={() => setActiveStep((step) => Math.max(0, step - 1))}>
                上一步
              </button>
              <button disabled={activeStep === steps.length - 1} onClick={goNext}>
                下一步
              </button>
            </div>
            <div className="row">
              <button disabled={Boolean(savingMode)} onClick={() => save(false)}>
                {savingMode === "draft" ? "保存中..." : "保存草稿"}
              </button>
              <button className="primary" disabled={Boolean(savingMode)} onClick={() => save(true)}>
                {savingMode === "publish" ? "发布中..." : "发布任务"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </RequesterShell>
  );
}
