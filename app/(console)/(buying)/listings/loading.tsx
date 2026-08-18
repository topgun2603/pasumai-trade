import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/table-skeleton";

export default function ListingsLoading() {
  return (
    <>
      <PageHeaderSkeleton tiles={4} />
      <TableSkeleton rows={9} />
    </>
  );
}
