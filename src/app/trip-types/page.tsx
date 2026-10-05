import TripTypesEditor from "@/components/TripTypesEditor";
import { listListTypes, listTripTypes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function TripTypesPage() {
  return <TripTypesEditor initial={listTripTypes()} listTypes={listListTypes()} />;
}
