import { notFound } from "next/navigation";
import { VisitTracker } from "@/components/tracking/visit-tracker";

interface Props {
  params: { visitId: string };
}

async function getTrackingData(visitId: string) {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/api/visits/${visitId}/track`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function TrackPage({ params }: Props) {
  const data = await getTrackingData(params.visitId);
  if (!data) notFound();

  return <VisitTracker visitId={params.visitId} initialData={data} />;
}

export const metadata = {
  title: "Visit Tracking · City Hospital",
};
