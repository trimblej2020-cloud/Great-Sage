export function getCookie(name: string) {
  if (typeof document === "undefined") return null

  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null
  }

  return null
}

export function getClientAuth() {
  return {
    role: getCookie("gs_role"),
    sailorId: getCookie("gs_sailor_id"),
  }
}

export function canEditDivision(
  role: string | null,
  sailorId: string | null,
  leaders: Array<{ sailor_id: string | null; role_title: string; division_id: string | null }>,
  divisionId: string | null
) {
  if (role === "admin") return true
  if (role !== "leadership" || !sailorId || !divisionId) return false

  const allowedRoles = ["LPO", "LCPO", "DLPO", "DCPO", "DIVO"]

  return leaders.some(
    (leader) =>
      leader.sailor_id === sailorId &&
      leader.division_id === divisionId &&
      allowedRoles.includes(leader.role_title)
  )
}

export function canEditProgram(
  role: string | null,
  sailorId: string | null,
  assignment: {
    owner_sailor_id: string | null
    assistant_sailor_id: string | null
    division_id?: string | null
  } | null,
  leaders: Array<{ sailor_id: string | null; role_title: string; division_id: string | null }>
) {
  if (role === "admin") return true
  if (role !== "leadership" || !sailorId || !assignment) return false

  if (assignment.owner_sailor_id === sailorId || assignment.assistant_sailor_id === sailorId) {
    return true
  }

  if (assignment.division_id) {
    return canEditDivision(role, sailorId, leaders, assignment.division_id)
  }

  return false
}

export function getRoleLabel(role: string | null) {
  if (role === "admin") return "Admin"
  if (role === "leadership") return "Leadership"
  return "Guest"
}