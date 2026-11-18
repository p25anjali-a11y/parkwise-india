"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Something went wrong</h1>
      <p>Please try again. If it keeps happening, the problem is on our side.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
