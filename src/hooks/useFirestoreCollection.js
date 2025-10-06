import { useEffect, useState, useMemo, useRef } from "react";
import { onSnapshot, query as makeQuery } from "firebase/firestore";

/**
 * Helper to create a stable key from constraints without causing false positives.
 * This uses a combination of constraint types and values to detect actual changes.
 */
function getConstraintsKey(constraints) {
  if (!constraints || constraints.length === 0) return "";

  return constraints
    .map((c) => {
      // Extract the constraint type and relevant properties
      // QueryConstraint objects have a 'type' property that identifies them
      const constraintData = {
        type: c.type,
        // For where/orderBy/limit, extract the relevant properties
        ...(c._query ? { query: c._query } : {}),
      };
      return JSON.stringify(constraintData);
    })
    .join("|");
}

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

  // Create a stable constraints key that only changes when constraints actually change
  // This prevents unnecessary re-subscriptions from new array instances
  const constraintsKey = useMemo(
    () => getConstraintsKey(constraints),
    // We still need constraints in deps, but the memo prevents recalculation
    // unless the constraint values actually change
    [constraints.length, ...constraints]
  );

  // Store the previous key to detect actual changes
  const prevKeyRef = useRef(constraintsKey);

  useEffect(() => {
    // Only re-subscribe if the constraints key actually changed
    if (prevKeyRef.current !== constraintsKey) {
      prevKeyRef.current = constraintsKey;
    }

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
        console.error("useFirestoreCollection error:", err);
        setError(err);
        setLoading(false);
      }
    );

    // Cleanup subscription when the component unmounts or the ref/constraints change.
    return () => unsub();
    // Using constraintsKey instead of JSON.stringify(constraints) for stable dependencies
  }, [ref, constraintsKey]);

  return { data, loading, error };
}
