"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { defaultLabelConfigs } from "@/lib/demo-data";
import { getCurrentUser, getTasks, getUsers, saveTasks } from "@/lib/storage";
import { createTaskFromInput, updateTaskFromInput } from "@/lib/task-actions";
import type { DisplayConfig, DraftTaskInput, LabelConfig, Task, TaskCreationMode, TaskEntryMode, TrialSamplingMode } from "@/lib/types";
import { uid } from "@/lib/utils";

const defaultImages = `https://picsum.photos/id/1011/640/420
https://picsum.photos/id/1015/640/420, https://picsum.photos/id/1025/640/420
https://picsum.photos/id/1035/640/420
https://picsum.photos/id/1041/640/420`;

export default function NewTaskPage() {
  const [editId, setEditId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("");
  const [creationMode, setCreationMode] = useState<TaskCreationMode>("from_scratch");
  const [historyTaskId, setHistoryTaskId] = useState("");
  const [entryMode, setEntryMode] = useState<TaskEntryMode>("trial_quote");
  const [title, setTitle] = useState("新图像标注任务");
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
    imageDataMode: "multi_image",
    multiImageDisplayMode: "parallel",
    enableDoubleClickZoom: true,
    zoomDisplayMode: "modal"
  });
  const [labelConfigs, setLabelConfigs] = useState<LabelConfig[]>(defaultLabelConfigs);

  useEffect(() => {
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
      setImageRows([...editing.trialItems, ...editing.formalItems].map((item) => item.imageUrls.join(", ")).join("\n") || defaultImages);
      setTrialSamplingMode(editing.trialSamplingMode ?? "first_n");
      setTrialSampleSize(editing.trialSampleSize ?? Math.max(1, editing.trialItems.length));
      setDisplayConfig(editing.displayConfig);
      setLabelConfigs(editing.labelConfigs);
    }
  }, []);

  const users = getUsers();
  const annotators = users.filter((user) => user.role === "annotator");
  const historyTasks = useMemo(() => tasks.filter((task) => task.status === "completed"), [tasks]);

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

  function validate(publish: boolean) {
    if (!title.trim()) return "请填写任务名称";
    if (!imageRows.trim()) return "请填写图片 URL 数据";
    if (creationMode === "from_history" && !historyTaskId) return "请选择历史任务";
    if (publish && entryMode === "direct_formal" && !assignedAnnotatorId) return "直接进入正式标注必须指定标注方";
    if (publish && entryMode === "direct_formal" && creationMode === "from_scratch" && manualUnitPrice <= 0) return "请填写手动单价";
    if (publish && entryMode === "trial_quote" && trialSampleSize <= 0) return "请填写试标数据条数";
    if (labelConfigs.some((config) => !config.title.trim() || config.options.length === 0)) return "每个问题组需要标题和选项";
    if (labelConfigs.some((config) => config.options.some((option) => !option.label.trim() || !option.criteria.trim()))) return "每个标签选项需要名称和判断依据";
    return "";
  }

  function save(publish: boolean) {
    const error = validate(publish);
    if (error) {
      setMessage(error);
      return;
    }
    const currentUser = getCurrentUser();
    const existing = tasks.find((task) => task.id === editId);
    const nextTask = existing ? updateTaskFromInput(existing, buildInput(), publish) : createTaskFromInput(buildInput(), currentUser.id, publish);
    const nextTasks = existing ? tasks.map((task) => (task.id === existing.id ? nextTask : task)) : [...tasks, nextTask];
    saveTasks(nextTasks);
    setMessage(publish ? "任务已发布" : "草稿已保存");
    window.location.href = "/requester/dashboard";
  }

  return (
    <main className="shell">
      <AppHeader />
      <div className="page grid">
        <div className="row between">
          <div>
            <h1>{editId ? "编辑任务草稿" : "发布图像标注任务"}</h1>
            <p className="muted">支持草稿、试标报价、直接正式标注、历史任务继承。</p>
          </div>
          <Link href="/requester/dashboard">
            <button>返回工作台</button>
          </Link>
        </div>

        {message ? <div className="panel">{message}</div> : null}

        <section className="grid two">
          <div className="panel grid">
            <h2>任务配置</h2>
            <div className="field">
              <label>创建方式</label>
              <select value={creationMode} onChange={(event) => setCreationMode(event.target.value as TaskCreationMode)}>
                <option value="from_scratch">从 0 创建</option>
                <option value="from_history">基于历史任务创建</option>
              </select>
            </div>
            {creationMode === "from_history" ? (
              <div className="field">
                <label>历史任务</label>
                <select value={historyTaskId} onChange={(event) => applyHistory(event.target.value)}>
                  <option value="">请选择</option>
                  {historyTasks.map((task) => (
                    <option value={task.id} key={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="field">
              <label>任务进入方式</label>
              <select value={entryMode} onChange={(event) => setEntryMode(event.target.value as TaskEntryMode)}>
                <option value="trial_quote">试标报价后进入正式标注</option>
                <option value="direct_formal">直接进入正式标注</option>
              </select>
            </div>
            <div className="field">
              <label>任务名称</label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
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
          </div>

          <div className="panel grid">
            <h2>数据与流程</h2>
            <div className="grid two">
              <div className="field">
                <label>截止时间</label>
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </div>
              <div className="field">
                <label>指定标注方</label>
                <select value={assignedAnnotatorId} onChange={(event) => setAssignedAnnotatorId(event.target.value)}>
                  <option value="">不指定</option>
                  {annotators.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {entryMode === "direct_formal" ? (
              <div className="field">
                <label>手动单价（每条数据）</label>
                <input type="number" min="0" step="0.01" value={manualUnitPrice} onChange={(event) => setManualUnitPrice(Number(event.target.value))} />
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
                <div className="field">
                  <label>试标条数</label>
                  <input type="number" min="1" value={trialSampleSize} onChange={(event) => setTrialSampleSize(Number(event.target.value))} />
                </div>
              </div>
            )}
            <div className="field">
              <label>图片 URL 数据（一行一条，多图用英文逗号分隔）</label>
              <textarea style={{ minHeight: 180 }} value={imageRows} onChange={(event) => setImageRows(event.target.value)} />
            </div>
          </div>
        </section>

        <section className="grid two">
          <div className="panel grid">
            <h2>图片展示配置</h2>
            <div className="field">
              <label>数据形态</label>
              <select
                value={displayConfig.imageDataMode}
                onChange={(event) => setDisplayConfig({ ...displayConfig, imageDataMode: event.target.value as DisplayConfig["imageDataMode"] })}
              >
                <option value="single_image">单张图片</option>
                <option value="multi_image">多张图片</option>
              </select>
            </div>
            <div className="field">
              <label>多图展示方式</label>
              <select
                value={displayConfig.multiImageDisplayMode ?? "parallel"}
                onChange={(event) => setDisplayConfig({ ...displayConfig, multiImageDisplayMode: event.target.value as DisplayConfig["multiImageDisplayMode"] })}
              >
                <option value="parallel">全部并列展示</option>
                <option value="carousel">单张展示 + 左右切换</option>
              </select>
            </div>
            <label className="row">
              <input
                style={{ width: "auto" }}
                type="checkbox"
                checked={displayConfig.enableDoubleClickZoom}
                onChange={(event) => setDisplayConfig({ ...displayConfig, enableDoubleClickZoom: event.target.checked })}
              />
              支持双击放大
            </label>
            <div className="field">
              <label>放大展示形式</label>
              <select
                value={displayConfig.zoomDisplayMode ?? "modal"}
                onChange={(event) => setDisplayConfig({ ...displayConfig, zoomDisplayMode: event.target.value as DisplayConfig["zoomDisplayMode"] })}
              >
                <option value="modal">弹窗居中展示</option>
                <option value="fullscreen">全屏沉浸展示</option>
              </select>
            </div>
          </div>

          <div className="panel grid">
            <h2>标签配置</h2>
            <p className="muted">MVP 提供 AI 审核能力说明，不实现真实后台审核。</p>
            {labelConfigs.map((config, index) => (
              <div className="item grid" key={config.id}>
                <div className="grid two">
                  <div className="field">
                    <label>问题组标题</label>
                    <input value={config.title} onChange={(event) => updateLabelTitle(index, event.target.value)} />
                  </div>
                  <div className="field">
                    <label>选择方式</label>
                    <select value={config.selectionMode} onChange={(event) => updateLabelMode(index, event.target.value as LabelConfig["selectionMode"])}>
                      <option value="single">单选</option>
                      <option value="multiple">多选</option>
                    </select>
                  </div>
                </div>
                <div className="grid">
                  {config.options.map((option, optionIndex) => (
                    <div className="panel" key={option.id}>
                      <div className="grid two">
                        <div className="field">
                          <label>选项名称</label>
                          <input value={option.label} onChange={(event) => updateOption(index, optionIndex, "label", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>判断依据</label>
                          <input value={option.criteria} onChange={(event) => updateOption(index, optionIndex, "criteria", event.target.value)} />
                        </div>
                      </div>
                      <button style={{ marginTop: 8 }} disabled={config.options.length <= 1} onClick={() => removeOption(index, optionIndex)}>
                        删除选项
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addOption(index)}>添加选项</button>
              </div>
            ))}
            <button className="primary" onClick={addLabelGroup}>添加问题组</button>
          </div>
        </section>

        <div className="row">
          <button onClick={() => save(false)}>保存草稿</button>
          <button className="primary" onClick={() => save(true)}>
            发布任务
          </button>
        </div>
      </div>
    </main>
  );
}
