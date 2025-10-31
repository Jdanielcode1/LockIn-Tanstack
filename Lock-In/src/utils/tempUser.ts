import type { Id } from '../../convex/_generated/dataModel'

const USER_ID_KEY = 'temp_user_id'
const USERNAME_KEY = 'temp_username'

export interface TempUser {
  userId: Id<'users'>
  username: string
}

export function getTempUser(): TempUser | null {
  if (typeof window === 'undefined') return null
  
  const userId = localStorage.getItem(USER_ID_KEY)
  const username = localStorage.getItem(USERNAME_KEY)
  
  if (!userId || !username) return null
  
  return {
    userId: userId as Id<'users'>,
    username,
  }
}

export function setTempUser(user: TempUser): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(USER_ID_KEY, user.userId)
  localStorage.setItem(USERNAME_KEY, user.username)
}

export function clearTempUser(): void {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

export function hasTempUser(): boolean {
  return getTempUser() !== null
}

