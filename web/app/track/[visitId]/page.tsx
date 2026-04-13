import { VisitTracker } from "@/components/tracking/visit-tracker";

interface Props {
  params: Promise<{ visitId: string }>;
}

async function getTrackingData(visitId: string) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    const res = await fetch(`${backendUrl}/api/visits/${visitId}/track`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function TrackPage({ params }: Props) {
  const { visitId } = await params;
  const data = await getTrackingData(visitId);
  // If SSR fetch fails, pass null — client component fetches on mount
  return <VisitTracker visitId={visitId} initialData={data} />;
}

export const metadata = {
  title: "Visit Tracking · City Hospital",
};
