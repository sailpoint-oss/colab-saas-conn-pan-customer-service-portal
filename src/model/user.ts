import { Role } from "./role";

// This class represents a user object and its properties.

export class User {
    // CSP fields
    userAccountId?: string
    email?: string
    supportAccountId?: string
    membershipId?: string
    description?: string
    activationDate?: string
    expirationDate?: string
    roles: Role[] = []
    firstName?: string
    lastName?: string
    IIQDisabled?: boolean
}