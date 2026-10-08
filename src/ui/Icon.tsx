// src/ui/Icon.tsx
// Stroke icons drawn with Skia (already a native dependency via victory-native), so no extra
// icon font / native module is needed. Paths are from Lucide (ISC license), 24x24 viewBox.
import React, { useMemo } from 'react';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';

const PATHS = {
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  calendar:
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M16 2v4 M8 2v4 M3 10h18',
  chart: 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
  settings:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
} as const;

export type IconName = keyof typeof PATHS;

// Decorative by default: callers put the accessible name on the surrounding control.
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(PATHS[name]), [name]);
  if (!path) {
    return null;
  }
  return (
    <Canvas style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <Group transform={[{ scale: size / 24 }]}>
        <Path path={path} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" color={color} />
      </Group>
    </Canvas>
  );
}
