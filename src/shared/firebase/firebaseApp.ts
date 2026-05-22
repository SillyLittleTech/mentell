import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, initializeAuth, inMemoryPersistence, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { isDebugMode } from '../debug/debugFlags'
import { getFirebaseWebConfig } from './config'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null

export function getFirebaseApp() {
  const config = getFirebaseWebConfig()
  if (!config) return null
  if (!app) {
    app = initializeApp(config)
  }
  return app
}

export function getFirebaseAuth() {
  const fb = getFirebaseApp()
  if (!fb) return null
  if (!auth) {
    auth = isDebugMode()
      ? initializeAuth(fb, { persistence: inMemoryPersistence })
      : getAuth(fb)
  }
  return auth
}

export function getFirebaseFirestore() {
  const fb = getFirebaseApp()
  if (!fb) return null
  if (!firestore) firestore = getFirestore(fb)
  return firestore
}
