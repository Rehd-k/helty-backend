/** Ward name is OPD (trimmed, case-insensitive). */
export function isOpdWardName(name: string | null | undefined): boolean {
  return name?.trim().toUpperCase() === 'OPD';
}
