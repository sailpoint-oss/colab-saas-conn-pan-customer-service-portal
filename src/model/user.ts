import { Role } from "./role";

// This class represents a user object and its properties.

export class User {
    // CSP fields
    userAccountId = -1
    email?: string
    supportAccountId?: number
    membershipId?: number
    description?: string
    activationDate?: string
    roles?: Role[]
    firstName?: string
    lastName?: string
}