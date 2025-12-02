import { useMemo } from "react";
import { collection, orderBy } from "firebase/firestore";
import { db as firebaseDb } from "../lib/firebase";
import { colorSwatchesPath } from "../lib/paths";
import { indexColorSwatches } from "../lib/colorPalette";
import { useFirestoreCollection } from "./useFirestoreCollection";

export function useColorSwatches(clientId, { db = firebaseDb } = {}) {
  const ref = useMemo(() => {
    if (!db || !clientId) return null;
    return collection(db, ...colorSwatchesPath(clientId));
  }, [db, clientId]);

  const { data, loading, error } = useFirestoreCollection(ref, [orderBy("name", "asc")]);

  const paletteIndex = useMemo(() => indexColorSwatches(data), [data]);

  return {
    swatches: data,
    loading,
    error,
    paletteIndex,
  };
}

export default useColorSwatches;
