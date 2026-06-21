import {
  PromptTemplatePreviewResultSchema,
  type PromptTemplate,
  type PromptTemplatePreviewResult,
} from "@novel-studio/contracts";

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/gu;
const ANY_MUSTACHE_PATTERN = /\{\{([\s\S]*?)\}\}/gu;
const VARIABLE_NAME_PATTERN = /^\s*[A-Za-z][A-Za-z0-9_]*\s*$/u;

export class PromptRenderError extends Error {
  constructor(
    message: string,
    public readonly code: "PROMPT_INPUT_MISSING" | "PROMPT_TEMPLATE_INVALID",
    public readonly details: unknown = null,
  ) {
    super(message);
  }
}

function validateTemplateSyntax(label: string, value: string): void {
  for (const match of value.matchAll(ANY_MUSTACHE_PATTERN)) {
    const expression = match[1] ?? "";
    if (!VARIABLE_NAME_PATTERN.test(expression)) {
      throw new PromptRenderError(
        `提示词模板 ${label} 只能使用 {{变量名}} 占位符，不能执行表达式。`,
        "PROMPT_TEMPLATE_INVALID",
        { label, expression: expression.trim() },
      );
    }
  }
  const scrubbed = value.replace(ANY_MUSTACHE_PATTERN, "");
  if (scrubbed.includes("{{") || scrubbed.includes("}}")) {
    throw new PromptRenderError(
      `提示词模板 ${label} 存在未闭合的占位符。`,
      "PROMPT_TEMPLATE_INVALID",
      { label },
    );
  }
}

function resolveInputs(template: PromptTemplate, inputs: Record<string, string>): Record<string, string> {
  const usedInputs: Record<string, string> = {};
  const missing: Array<{ key: string; label: string }> = [];
  for (const variable of template.variables) {
    const rawInput = inputs[variable.key];
    const hasInput = typeof rawInput === "string" && rawInput.trim().length > 0;
    if (hasInput) {
      usedInputs[variable.key] = rawInput;
      continue;
    }
    if (variable.defaultValue !== null && variable.defaultValue !== undefined) {
      usedInputs[variable.key] = variable.defaultValue;
      continue;
    }
    if (variable.required) {
      missing.push({ key: variable.key, label: variable.label });
    } else {
      usedInputs[variable.key] = "";
    }
  }
  for (const [key, value] of Object.entries(inputs)) {
    if (usedInputs[key] === undefined) {
      usedInputs[key] = value;
    }
  }
  if (missing.length) {
    throw new PromptRenderError(
      `缺少必填提示词输入：${missing.map((item) => item.label).join("、")}`,
      "PROMPT_INPUT_MISSING",
      { missingInputs: missing },
    );
  }
  return usedInputs;
}

function renderPart(label: string, value: string, inputs: Record<string, string>): string {
  validateTemplateSyntax(label, value);
  return value.replace(PLACEHOLDER_PATTERN, (_match, key: string) => inputs[key] ?? "");
}

export function renderPromptTemplate(
  template: PromptTemplate,
  inputs: Record<string, string>,
): PromptTemplatePreviewResult {
  const usedInputs = resolveInputs(template, inputs);
  const renderedSystem = renderPart("system", template.system, usedInputs);
  const renderedInstructions = renderPart("instructions", template.instructions, usedInputs);
  const renderedComponents = template.components.map((component) => ({
    key: component.key,
    title: component.title,
    body: renderPart(`components.${component.key}`, component.body, usedInputs),
  }));
  const finalPrompt = [
    "# 系统角色",
    renderedSystem,
    "# 工作指令",
    renderedInstructions,
    ...renderedComponents.flatMap((component) => [`# ${component.title}`, component.body]),
  ].join("\n\n");

  return PromptTemplatePreviewResultSchema.parse({
    promptTemplateId: template.id,
    promptTemplateVersion: template.version,
    roleId: template.roleId,
    templateName: template.name,
    renderedSystem,
    renderedInstructions,
    renderedComponents,
    finalPrompt,
    usedInputs,
  });
}
