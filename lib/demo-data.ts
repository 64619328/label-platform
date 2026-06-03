import type { AnnotationItem, DemoUser, LabelConfig, Task } from "./types";
import { nowIso } from "./utils";

export const demoUsers: DemoUser[] = [
  { id: "requester_1", role: "requester", name: "需求方" },
  { id: "annotator_a", role: "annotator", name: "标注方 A" },
  { id: "annotator_b", role: "annotator", name: "标注方 B" },
  { id: "annotator_c", role: "annotator", name: "标注方 C" }
];

export const defaultLabelConfigs: LabelConfig[] = [
  {
    id: "label_safety",
    title: "图片是否包含违规内容",
    selectionMode: "single",
    options: [
      { id: "safe_no", label: "否", criteria: "画面不包含明显违规、敏感或不可展示内容。" },
      { id: "safe_yes", label: "是", criteria: "画面包含暴力、血腥、裸露或其他违规内容。" },
      { id: "safe_unknown", label: "无法判断", criteria: "图片过暗、遮挡严重或主体不可识别。" }
    ]
  },
  {
    id: "label_scene",
    title: "场景类型",
    selectionMode: "multiple",
    options: [
      { id: "scene_indoor", label: "室内", criteria: "主要环境为房间、商场、车厢等室内空间。" },
      { id: "scene_outdoor", label: "室外", criteria: "主要环境为街道、公园、自然环境等室外空间。" },
      { id: "scene_people", label: "人物", criteria: "画面中存在清晰可见的人物主体。" }
    ]
  }
];

const imageSets = [
  ["https://picsum.photos/id/1011/640/420"],
  ["https://picsum.photos/id/1015/640/420", "https://picsum.photos/id/1025/640/420"],
  ["https://picsum.photos/id/1035/640/420"],
  ["https://picsum.photos/id/1041/640/420", "https://picsum.photos/id/1050/640/420"],
  ["https://picsum.photos/id/1062/640/420"],
  ["https://picsum.photos/id/1074/640/420"],
  ["https://picsum.photos/id/1084/640/420", "https://picsum.photos/id/1080/640/420"],
  ["https://picsum.photos/id/1081/640/420"],
  ["https://picsum.photos/id/1082/640/420"],
  ["https://picsum.photos/id/1083/640/420"]
];

function item(id: string, urls: string[], packageId?: string, approved = false): AnnotationItem {
  return {
    id,
    imageUrls: urls,
    packageId,
    annotationValues: approved
      ? [
          { labelConfigId: "label_safety", value: "safe_no" },
          { labelConfigId: "label_scene", value: ["scene_outdoor"] }
        ]
      : undefined,
    reviewStatus: approved ? "approved" : "not_submitted",
    updatedAt: nowIso()
  };
}

export function createDemoTasks(): Task[] {
  const createdAt = nowIso();
  const openTrialTrialItems = imageSets.slice(0, 2).map((urls, index) => item(`trial_open_${index + 1}`, urls));
  const openTrialFormalItems = imageSets.slice(2, 8).map((urls, index) => item(`formal_open_${index + 1}`, urls));
  const directItems = imageSets.slice(0, 6).map((urls, index) => item(`direct_${index + 1}`, urls, "pkg_direct_1"));
  const historyItems = imageSets.slice(4, 9).map((urls, index) => item(`history_${index + 1}`, urls, "pkg_history_1", true));

  return [
    {
      id: "task_open_trial",
      title: "开放试标：图像安全与场景识别",
      description: "判断图片是否包含违规内容，并标注主要场景类型。",
      annotationType: "image_annotation",
      creationMode: "from_scratch",
      entryMode: "trial_quote",
      trialSamplingMode: "first_n",
      trialSampleSize: 2,
      rules: "先判断图片安全性，再判断场景类型。无法识别时选择无法判断。",
      trainingContent: "关注主体清晰度和内容合规性，多图数据需要综合判断。",
      stage: "trial",
      status: "pending_quote_selection",
      requesterId: "requester_1",
      deadline: "2026-06-20",
      displayConfig: {
        imageDataMode: "multi_image",
        multiImageDisplayMode: "parallel",
        enableDoubleClickZoom: true,
        zoomDisplayMode: "modal"
      },
      labelConfigs: defaultLabelConfigs,
      trialItems: openTrialTrialItems,
      formalItems: openTrialFormalItems,
      packages: [],
      reviewBatches: [],
      quotes: [
        {
          id: "quote_a_open",
          taskId: "task_open_trial",
          annotatorId: "annotator_a",
          trialItemIds: openTrialTrialItems.map((trialItem) => trialItem.id),
          unitPrice: 1.2,
          quoteNote: "可安排 2 人并行处理，预计 2 天完成。",
          status: "submitted",
          submittedAt: createdAt
        },
        {
          id: "quote_b_open",
          taskId: "task_open_trial",
          annotatorId: "annotator_b",
          trialItemIds: openTrialTrialItems.map((trialItem) => trialItem.id),
          unitPrice: 1.05,
          quoteNote: "熟悉安全分类任务，可以优先交付。",
          status: "submitted",
          submittedAt: createdAt
        }
      ],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "task_direct_review",
      title: "指定标注：商品图多标签复核",
      description: "继承历史任务配置，对新一批商品图进行多标签标注。",
      annotationType: "image_annotation",
      creationMode: "from_history",
      historyTaskId: "task_history_done",
      entryMode: "direct_formal",
      rules: "多图并列时需要比较所有图片，以主商品为准。",
      trainingContent: "优先判断图片质量，再判断主体类别。",
      stage: "review",
      status: "pending_review",
      requesterId: "requester_1",
      assignedAnnotatorId: "annotator_a",
      selectedAnnotatorId: "annotator_a",
      manualUnitPrice: 1.5,
      quotedUnitPrice: 1.5,
      deadline: "2026-06-18",
      displayConfig: {
        imageDataMode: "multi_image",
        multiImageDisplayMode: "carousel",
        enableDoubleClickZoom: true,
        zoomDisplayMode: "fullscreen"
      },
      labelConfigs: defaultLabelConfigs,
      trialItems: [],
      formalItems: directItems.map((formalItem) => ({
        ...formalItem,
        reviewStatus: "pending_review",
        annotationValues: [
          { labelConfigId: "label_safety", value: "safe_no" },
          { labelConfigId: "label_scene", value: ["scene_people"] }
        ]
      })),
      packages: [
        {
          id: "pkg_direct_1",
          taskId: "task_direct_review",
          annotatorId: "annotator_a",
          itemIds: directItems.map((formalItem) => formalItem.id),
          status: "pending_review",
          submittedAt: createdAt,
          updatedAt: createdAt
        }
      ],
      reviewBatches: [],
      quotes: [],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "task_history_done",
      title: "历史任务：商品图基础分类",
      description: "已完成任务，用于发布页继承配置。",
      annotationType: "image_annotation",
      creationMode: "from_scratch",
      entryMode: "direct_formal",
      rules: "按图片主体判断安全性与场景。",
      trainingContent: "示例历史配置，可被新任务继承。",
      stage: "completed",
      status: "completed",
      requesterId: "requester_1",
      assignedAnnotatorId: "annotator_a",
      selectedAnnotatorId: "annotator_a",
      manualUnitPrice: 1.4,
      quotedUnitPrice: 1.4,
      deadline: "2026-05-30",
      displayConfig: {
        imageDataMode: "multi_image",
        multiImageDisplayMode: "parallel",
        enableDoubleClickZoom: true,
        zoomDisplayMode: "modal"
      },
      labelConfigs: defaultLabelConfigs,
      trialItems: [],
      formalItems: historyItems,
      packages: [
        {
          id: "pkg_history_1",
          taskId: "task_history_done",
          annotatorId: "annotator_a",
          itemIds: historyItems.map((formalItem) => formalItem.id),
          status: "approved",
          submittedAt: createdAt,
          approvedAt: createdAt,
          updatedAt: createdAt
        }
      ],
      reviewBatches: [],
      quotes: [],
      createdAt,
      updatedAt: createdAt
    }
  ];
}
