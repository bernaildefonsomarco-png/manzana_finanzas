type MovementRecencyFields = {
  id: string;
  created_at: string;
  occurred_at: string;
};

export function sortMovementsByRegistrationRecency<T extends MovementRecencyFields>(
  movements: T[]
): T[] {
  return [...movements].sort(compareMovementsByRegistrationRecency);
}

export function compareMovementsByRegistrationRecency(
  left: MovementRecencyFields,
  right: MovementRecencyFields
): number {
  const createdDiff = compareIsoDesc(left.created_at, right.created_at);
  if (createdDiff !== 0) return createdDiff;

  const occurredDiff = compareIsoDesc(left.occurred_at, right.occurred_at);
  if (occurredDiff !== 0) return occurredDiff;

  return right.id.localeCompare(left.id);
}

function compareIsoDesc(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
    return right.localeCompare(left);
  }

  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;

  return rightTime - leftTime;
}
