import useSWR from "swr";
import { fetchXConfig, updateXConfig } from "@/lib/api-client";
import type { XPageConfigData } from "@/lib/types";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  return json.data;
}

export function useXConfig(tab?: string) {
  const key = tab ? `/api/x-config?tab=${tab}` : "/api/x-config";

  const { data, error, isLoading, mutate } = useSWR<XPageConfigData[]>(
    key,
    (url: string) => fetcher<XPageConfigData[]>(url),
    { revalidateOnFocus: false, dedupingInterval: 5000 },
  );

  const update = async (config: Partial<XPageConfigData> & { tab: string }) => {
    await updateXConfig(config as Parameters<typeof updateXConfig>[0]);
    await mutate();
  };

  return { configs: data ?? [], error, loading: isLoading, update };
}
