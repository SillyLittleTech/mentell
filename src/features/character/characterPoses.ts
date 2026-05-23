import type { CharacterPoseId } from './charManifest'

export type ArmPose = { armL: number; armR: number }

export const CHARACTER_POSES: Record<CharacterPoseId, ArmPose> = {
  idle: { armL: 0, armR: 0 },
  present: { armL: -48, armR: 42 },
  think: { armL: -66, armR: 22 },
  write: { armL: -24, armR: 48 },
  shop: { armL: 24, armR: -44 },
  wave: { armL: -82, armR: 16 },
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
