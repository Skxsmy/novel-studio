import { useLayoutEffect } from "react";

import { getReferenceStyleText } from "./reference-source";

const STYLE_ID = "ns514-binding-reference-styles";

export function useReferenceStyleSheet() {
  useLayoutEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    const owned = !style;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = getReferenceStyleText();
      document.head.append(style);
    }
    return () => {
      if (owned) style?.remove();
    };
  }, []);
}
