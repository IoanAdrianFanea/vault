/*
Builds matching element ids for a tab and its panel so they can reference each
other for accessibility.
*/


export function getTabId(prefix: string, value: string): string {
  return `${prefix}-tab-${value}`;
}

export function getTabPanelId(prefix: string, value: string): string {
  return `${prefix}-panel-${value}`;
}
