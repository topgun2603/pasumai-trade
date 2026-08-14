import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/table-skeleton";

/**
 * Covers every admin route. The overview shows four tiles and the entity pages
 * show none, so the tiles are included — a row that disappears is less jarring
 * than one that appears.
 */
export default function AdminLoading() {
  return (
    <>
      <PageHeaderSkeleton tiles={4} />
      <TableSkeleton />
    </>
  );
}
