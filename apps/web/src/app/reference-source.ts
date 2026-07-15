import bindingReferenceHtml from "../../../../docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html?raw";

export interface ReferenceElementSnapshot {
  attributes: Array<[string, string]>;
  innerHtml: string;
  tagName: string;
}

let referenceDocument: Document | undefined;

function getReferenceDocument() {
  referenceDocument ??= new DOMParser().parseFromString(bindingReferenceHtml, "text/html");
  return referenceDocument;
}

export function getReferenceElementSnapshot(selector: string): ReferenceElementSnapshot {
  const element = getReferenceDocument().querySelector(selector);
  if (!element) throw new Error(`NS-514 binding reference is missing ${selector}`);
  return {
    attributes: [...element.attributes].map((attribute) => [attribute.name, attribute.value]),
    innerHtml: element.innerHTML,
    tagName: element.tagName.toLowerCase(),
  };
}

export function getReferenceStyleText() {
  const style = getReferenceDocument().querySelector("head > style");
  if (!style?.textContent) throw new Error("NS-514 binding reference is missing its stylesheet");
  return style.textContent;
}

export function getReferenceRuntimeText() {
  const script = getReferenceDocument().querySelector("body > script");
  if (!script?.textContent) throw new Error("NS-514 binding reference is missing its runtime script");
  return script.textContent;
}

export { bindingReferenceHtml };
