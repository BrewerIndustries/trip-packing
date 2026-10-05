import TripsBoard from "@/components/TripsBoard";
import { listListTypes, listTrips, listTripTypes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  return <TripsBoard trips={listTrips()} tripTypes={listTripTypes()} listTypes={listListTypes()} />;
}
