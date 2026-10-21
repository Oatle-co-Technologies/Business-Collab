import Link from "next/link";
export default function NotFound() {
  return <main className="page"><h1>Collaboration request not found</h1><p className="my-4">This request is unavailable or is not shared with your account.</p><Link href="/collaborations">Back to collaborations</Link></main>;
}
