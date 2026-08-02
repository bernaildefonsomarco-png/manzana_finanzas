export type MemoryScope = "classification" | "profile" | "preference";

export type MemoryItem = {
  id: string;
  scope: MemoryScope;
  subject_key: string;
  statement: string;
  status: string;
  active: boolean;
  positive_evidence_refs: string[];
  negative_evidence_refs: string[];
  positive_evidence_count: number;
  negative_evidence_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  can_reactivate: boolean;
};

export type MemoryGroups = {
  profile: MemoryItem[];
  classification: MemoryItem[];
  preference: MemoryItem[];
  inactive: MemoryItem[];
};

export type MemoryEvent = {
  id: string;
  scope: MemoryScope;
  subject_id: string;
  action: string;
  actor: string;
  previous_status: string | null;
  next_status: string | null;
  created_at: string;
};

export type ProfileCandidate = {
  id: string;
  subject_key: string;
  statement: string;
  status: string;
  ask_count: number;
  evidence_refs: string[];
  created_at: string;
};
