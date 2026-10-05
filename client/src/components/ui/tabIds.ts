export function getTabId(prefix: string, value: string): string {
  return `${prefix}-tab-${value}`;
}

export function getTabPanelId(prefix: string, value: string): string {
  return `${prefix}-panel-${value}`;
}
