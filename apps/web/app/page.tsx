import { redirect } from "next/navigation";

/** The app always opens on the sign-in, where you choose driver or parking operator. Signed-in people can continue from there. */
export default function Home() {
  redirect("/login");
}
