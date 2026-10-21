import Link from "next/link";

export default function NotFound() {
  return <main className="page"><h1>Business profile not found</h1>
    <Link className="mt-4 inline-block" href="/">Back to businesses</Link>
  </main>;
}
