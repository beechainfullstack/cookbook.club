import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { backend, errorCopy, supabase } from './backend';
import { type Entry, type Flavor } from './domain';

export function useBook(schoolId: string, recipient: string | undefined, flavor: Flavor | undefined, demo: Entry[] | undefined) {
  const queryKey = `${schoolId}:${recipient ?? ''}:${flavor ?? ''}`;
  const [request, setRequest] = useState<{ key: string; version: number; cursor?: Entry }>({ key: queryKey, version: 0 });
  const [result, setResult] = useState<{
    key: string; version: number; entries: Entry[]; hasMore: boolean; error: string;
  }>();
  const version = request.key === queryKey ? request.version : 0;
  const cursor = request.key === queryKey ? request.cursor : undefined;
  const loading = !demo && (result?.key !== queryKey || result?.version !== version);
  const entries = result?.key === queryKey && (!loading || cursor) ? result.entries : [];
  const refresh = useCallback(() => {
    setRequest((previous) => ({ key: queryKey, version: previous.version + 1 }));
  }, [queryKey]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    void (async () => {
      try {
        const { data, error: failure } = await backend().rpc('get_book', {
        ...(cursor ? { p_before_time: cursor.created_at, p_before_id: cursor.id } : {}),
        ...(recipient ? { p_recipient: recipient } : {}),
        ...(flavor ? { p_flavor: flavor } : {}),
        });
        if (failure) throw failure;
        if (active) setResult((previous) => ({
          key: queryKey, version,
          entries: cursor && previous?.key === queryKey ? [...previous.entries, ...data] : data,
          hasMore: data.length === 30, error: '',
        }));
      } catch (failure) {
        if (active) setResult((previous) => ({
          key: queryKey, version,
          entries: cursor && previous?.key === queryKey ? previous.entries : [],
          hasMore: !!cursor, error: errorCopy(failure),
        }));
      }
    })();
    return () => { active = false; };
  }, [queryKey, version, cursor, recipient, flavor, demo]);

  useEffect(() => {
    if (demo || !supabase) return;
    const channel = supabase.channel(`book:${schoolId}`).on('system', {}, (event) => {
      if (event.status === 'ok' && event.extension === 'postgres_changes') refresh();
    }).on('postgres_changes', {
      event: '*', schema: 'public', table: 'book_entries', filter: `school_id=eq.${schoolId}`,
    }, refresh).subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    const focus = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { focus.remove(); void supabase?.removeChannel(channel); };
  }, [refresh, schoolId, demo]);

  return {
    entries: demo?.filter((entry) => (!recipient || entry.tagged_user_id === recipient) && (!flavor || entry.flavor === flavor)) ?? entries,
    loading, error: !loading ? result?.error ?? '' : '', hasMore: !demo && !!result?.hasMore,
    refresh,
    loadMore: () => {
      if (!loading && entries.length) setRequest((previous) => ({
        key: queryKey, version: previous.version + 1, cursor: entries[entries.length - 1],
      }));
    },
  };
}
