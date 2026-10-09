import type { ClinicRole, User } from './types'

export type Area = 'owner' | 'clinic' | 'admin'
export const areaOf = (user: User): Area => user.role === 'owner' ? 'owner' : user.role === 'staff' ? 'clinic' : 'admin'
export const homeFor = (user: User) => ({ owner: '/app', clinic: '/clinica', admin: '/admin' })[areaOf(user)]
export const can = (user: User | null | undefined, ...roles: ClinicRole[]) => !!user?.membership && roles.includes(user.membership.role)
