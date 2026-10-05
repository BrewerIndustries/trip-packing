import { notFound } from "next/navigation";
import TripView from "@/components/TripView";
import { getTrip, listListTypes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const trip = getTrip((await params).id);
  if (!trip) notFound();
  return <TripView initial={trip} listTypes={listListTypes()} />;
}
