import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/table-skeleton";

export default function OrdersLoading() {
  return (
    <>
      <PageHeaderSkeleton tiles={4} />
      <TableSkeleton rows={8} />
    </>
  );
}
