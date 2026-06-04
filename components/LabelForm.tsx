"use client";

import type { AnnotationValue, LabelConfig } from "@/lib/types";

type Props = {
  labelConfigs: LabelConfig[];
  values: AnnotationValue[];
  onChange: (values: AnnotationValue[]) => void;
};

export function LabelForm({ labelConfigs, values, onChange }: Props) {
  function current(configId: string) {
    return values.find((value) => value.labelConfigId === configId)?.value;
  }

  function setSingle(configId: string, optionId: string) {
    onChange([...values.filter((value) => value.labelConfigId !== configId), { labelConfigId: configId, value: optionId }]);
  }

  function toggleMultiple(configId: string, optionId: string) {
    const existing = current(configId);
    const list = Array.isArray(existing) ? existing : [];
    const next = list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId];
    onChange([...values.filter((value) => value.labelConfigId !== configId), { labelConfigId: configId, value: next }]);
  }

  return (
    <div className="label-form grid">
      {labelConfigs.map((config) => (
        <div className="panel label-question" key={config.id}>
          <h3>{config.title}</h3>
          <div className="muted label-question-help">
            {config.selectionMode === "single" ? "单选" : "多选"} · 每条数据必须填写
          </div>
          <div className="label-options grid">
            {config.options.map((option) => {
              const selected = config.selectionMode === "single"
                ? current(config.id) === option.id
                : Array.isArray(current(config.id)) && current(config.id)?.includes(option.id);
              return (
                <label className={selected ? "item label-option selected" : "item label-option"} key={option.id}>
                  <div className="row label-option-main">
                    <input
                      style={{ width: "auto" }}
                      type={config.selectionMode === "single" ? "radio" : "checkbox"}
                      checked={Boolean(selected)}
                      onChange={() =>
                        config.selectionMode === "single"
                          ? setSingle(config.id, option.id)
                          : toggleMultiple(config.id, option.id)
                      }
                    />
                    <strong>{option.label}</strong>
                  </div>
                  <div className="muted label-option-criteria">
                    {option.criteria}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function isComplete(values: AnnotationValue[], labelConfigs: LabelConfig[]) {
  return labelConfigs.every((config) => {
    const value = values.find((entry) => entry.labelConfigId === config.id)?.value;
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}
