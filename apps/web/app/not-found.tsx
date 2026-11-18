import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Not found</h1>
      <p><Link href="/search">Find parking</Link></p>
    </main>
  );
}
