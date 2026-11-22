import { redirect } from "next/navigation";

/** Drivers land on Find parking. The explainer that used to live here is at /how. */
export default function Home() {
  redirect("/search");
}
