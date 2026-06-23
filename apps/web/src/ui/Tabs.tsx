import { cx } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  ariaLabel: string;
  activeId: string;
  items: TabItem[];
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ activeId, ariaLabel, className, items, onChange }: TabsProps) {
  return (
    <div aria-label={ariaLabel} className={cx("segmented", className)} role="tablist">
      {items.map((item) => (
        <button
          aria-selected={item.id === activeId}
          className={cx("seg-btn", item.id === activeId && "is-active")}
          disabled={item.disabled}
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
