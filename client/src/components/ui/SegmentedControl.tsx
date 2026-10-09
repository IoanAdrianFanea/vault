/*
Segmented button group for choosing one value, implemented as the segmented
variant of Tabs.
*/


import { Tabs, type TabsProps } from './Tabs';

export function SegmentedControl<T extends string>(
  props: Omit<TabsProps<T>, 'variant'> & {
    value: T;
    onChange: (value: T) => void;
    idPrefix: string;
  },
) {
  return <Tabs {...props} variant="segmented" />;
}
