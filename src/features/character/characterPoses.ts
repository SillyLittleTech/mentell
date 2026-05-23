import type { CharacterPoseId } from './charManifest'

export type ArmPose = { armL: number; armR: number }

export const CHARACTER_POSES: Record<CharacterPoseId, ArmPose> = {
  idle: { armL: 0, armR: 0 },
  present: { armL: -35, armR: 35 },
  think: { armL: -52, armR: 18 },
  write: { armL: -15, armR: 32 },
  shop: { armL: 10, armR: -28 },
  wave: { armL: -58, armR: 6 },
}

export const POSE_LABELS: Record<CharacterPoseId, string> = {
  idle: 'Idle',
  present: 'Present',
  think: 'Think',
  write: 'Write',
  shop: 'Shop',
  wave: 'Wave',
}

export const ALL_POSE_IDS = Object.keys(CHARACTER_POSES) as CharacterPoseId[]

export function poseForPathname(pathname: string): CharacterPoseId {
  switch (pathname) {
    case '/':
      return 'present'
    case '/week':
      return 'think'
    case '/notes':
      return 'write'
    case '/shop':
      return 'shop'
    case '/settings':
      return 'idle'
    default:
      return 'idle'
  }
}
