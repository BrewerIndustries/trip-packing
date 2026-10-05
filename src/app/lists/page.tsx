import ListsEditor from "@/components/ListsEditor";
import { listListTypes, listTripTypes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ListsPage() {
  return <ListsEditor initial={listListTypes()} tripTypes={listTripTypes()} />;
}
