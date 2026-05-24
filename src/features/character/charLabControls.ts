import type { CharacterPoseId } from './charManifest'

export type LabControlKind = 'dial' | 'switch' | 'color' | 'pose'

export type LabToggleConfig = {
  groupKey: string
  label: string
  kind: 'dial' | 'switch'
  dialLabels?: string[]
}

export const LAB_TOGGLE_CONFIG: LabToggleConfig[] = [
  { groupKey: 'layer16', label: 'Hair', kind: 'dial', dialLabels: ['1', '2', '3'] },
  { groupKey: 'layer15', label: 'Shirt', kind: 'dial', dialLabels: ['1', '2', '3'] },
  { groupKey: 'layer19', label: 'Sleeves', kind: 'dial', dialLabels: ['1', '2'] },
  { groupKey: 'layer18', label: 'Eyes', kind: 'dial', dialLabels: ['1', '2', '3'] },
  { groupKey: 'layer17', label: 'Expression', kind: 'dial', dialLabels: ['1', '2', '3'] },
  { groupKey: 'blush', label: 'Blush', kind: 'switch' },
]

export const LAB_COLOR_ORDER: { key: string; label: string }[] = [
  { key: 'path45', label: 'Skin' },
  { key: 'path65', label: 'Pants' },
  { key: 'hair_fill', label: 'Hair' },
  { key: 'shirt', label: 'Shirt' },
  { key: 'sleeves', label: 'Sleeves' },
]

export const LAB_POSE_ORDER: CharacterPoseId[] = [
  'idle',
  'present',
  'think',
  'write',
  'shop',
  'wave',
]
