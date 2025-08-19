import { useEffect, useState } from "react";
import { onSnapshot, query as makeQuery } from "firebase/firestore";

/**
 * Reusable hook for subscribing to a Firestore collection.
 *
 * Given a collection reference and optional query constraints, this hook
 * automatically subscribes to the data using `onSnapshot`. It returns the
 * current list of documents, a loading flag and any error encountered.
 *
 * @param {import('firebase/firestore').CollectionReference} ref
 *   A Firestore collection reference created via `collection(db, ...segments)`.
 * @param {import('firebase/firestore').QueryConstraint[]} [constraints]
 *   Optional array of query constraints (e.g. `orderBy` or `where`).
 * @param {(doc: import('firebase/firestore').QueryDocumentSnapshot) => any} [mapFn]
 *   Optional mapping function to transform each document. Defaults to
 *   converting the snapshot into an object with an `id` property.
 * @returns {{data: any[], loading: boolean, error: Error | null}}
 */
export function useFirestoreCollection(ref, constraints = [], mapFn) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Build the query. If no constraints are provided, use the ref directly.
    const q = constraints && constraints.length > 0 ? makeQuery(ref, ...constraints) : ref;
    // Subscribe to realtime updates. Snapshot callbacks will update state.
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => (mapFn ? mapFn(d) : { id: d.id, ...d.data() }));
        setData(list);
        setLoading(false);
      },
      (err) => {
        console.error('useFirestoreCollection error:', err);
        setError(err);
        setLoading(false);
      }
    );
    // Cleanup subscription when the component unmounts or the ref/constraints change.
    return () => unsub();
    // We stringify the constraints array to create a stable dependency. Without
    // this, a new array instance on each render would trigger the effect again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, JSON.stringify(constraints)]);

  return { data, loading, error };
}
