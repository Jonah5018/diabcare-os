"use client";

export default function PlatformError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 p-6"><p>Platform administration could not be loaded.</p><button onClick={reset} className="rounded-lg border px-4 py-2">Try again</button></div>;
}
