import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMyAccess } from "./razul.functions";

export const accessQuery = queryOptions({ queryKey: ["access"], queryFn: () => getMyAccess() });
export function useAccess() {
  const { data } = useSuspenseQuery(accessQuery);
  return { ...data, isOwner: data.roles.includes("owner"), isMember: data.roles.length > 0 };
}
