"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page"><h1>Something went wrong</h1>
    <p className="my-4">We could not load this page. Please try again.</p>
    <button onClick={reset}>Try again</button>
  </main>;
}
