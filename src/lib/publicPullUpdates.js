import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function submitPublicPullUpdate({ shareToken, email, actions }) {
  const callable = httpsCallable(functions, "publicUpdatePull");
  const response = await callable({
    shareToken,
    email,
    actions,
  });
  return response?.data?.pull || null;
}

