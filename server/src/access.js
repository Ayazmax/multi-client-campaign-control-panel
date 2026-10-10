export function canAccessClient(user, client) {
  const membership = user.memberships.find(
    (item) => item.workspaceId === client.workspaceId,
  );
  if (!membership) return false;
  if (membership.role === "owner") return true;
  return user.clientGrants.some((grant) => grant.clientId === client.id);
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
