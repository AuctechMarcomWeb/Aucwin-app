import { useQuery } from "@tanstack/react-query";
import { getLeadStages } from "@/lib/api";
import { LEAD_STATUSES, label as humanize } from "@/lib/types";

// Used only until the company's stages load (or if the request fails), so the
// pipeline never renders empty. Once stages arrive from the API they take over.
const FALLBACK = LEAD_STATUSES.map((key, i) => ({
  key,
  label: humanize(key),
  color: null,
  position: i,
  is_open: !["sale_done", "junk", "not_interested", "hanged_up"].includes(key),
}));

/** Loads the company's admin-managed lead stages (cached, shared across screens). */
export function useStages() {
  const q = useQuery({
    queryKey: ["lead_stages"],
    queryFn: getLeadStages,
    staleTime: 5 * 60 * 1000,
  });
  const stages = q.data && q.data.length ? q.data : FALLBACK;
  const byKey = {};
  for (const s of stages) byKey[s.key] = s;
  return {
    stages,
    loading: q.isLoading,
    keys: stages.map((s) => s.key),
    openKeys: stages.filter((s) => s.is_open).map((s) => s.key),
    byKey,
    labelOf: (key) => byKey[key]?.label ?? humanize(key),
    colorOf: (key) => byKey[key]?.color || "#64748B",
  };
}
