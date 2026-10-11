export function membershipFor(user, client) {
  return user.memberships.find((item) => item.workspaceId === client.workspaceId);
}

export function canAccessClient(user, client) {
  const membership = membershipFor(user, client);
  if (!membership) return false;
  if (membership.role === "owner") return true;
  return user.clientGrants.some((grant) => grant.clientId === client.id);
}

export function canEditSite(user, client) {
  if (!canAccessClient(user, client)) return false;
  const role = membershipFor(user, client)?.role;
  return role === "owner" || role === "editor";
}

export function canPublishSite(user, client) {
  if (!canAccessClient(user, client)) return false;
  const role = membershipFor(user, client)?.role;
  return role === "owner" || role === "reviewer";
}

export function canRestoreVersion(user, client) {
  return canPublishSite(user, client);
}

export function canOwnSite(user, client) {
  if (!canAccessClient(user, client)) return false;
  return membershipFor(user, client)?.role === "owner";
}

export function toAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    memberships: user.memberships.map((membership) => ({
      role: membership.role,
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
      },
    })),
  };
}
