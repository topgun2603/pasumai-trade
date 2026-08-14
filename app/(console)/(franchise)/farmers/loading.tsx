import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/table-skeleton";

export default function FarmersLoading() {
  return (
    <>
      <PageHeaderSkeleton tiles={4} />
      <TableSkeleton rows={6} />
    </>
  );
}
