"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  Rows3Icon,
  SearchIcon,
  SlidersHorizontalIcon,
  InboxIcon,
  FilterXIcon,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, type EmptyTone } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * The one data grid.
 *
 * Every list in both consoles renders through this, so search, sorting,
 * column visibility, pagination, the card toggle and the empty state behave
 * identically wherever you are. Before this existed, four grids were
 * hand-rolled and each had a slightly different idea of what a filter was.
 *
 * What varies per list is passed in: the columns, the filter tabs, an optional
 * card renderer, an optional expanded detail row, and optional row actions.
 * Nothing else should be forked — if a list needs behaviour this does not
 * have, add it here rather than dropping back to a bare `<Table>`.
 *
 * Sorting, filtering and pagination run client-side, which is right for
 * hundreds of rows and wrong for hundreds of thousands. TanStack supports
 * server-driven mode through `manualSorting` / `manualPagination` without the
 * column definitions changing — the seam is this file and nothing above it.
 */

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly className?: string;
  readonly cell: (row: T) => ReactNode;
  /**
   * Value the column sorts on. Omit to make the column unsortable — correct
   * for a column that is purely a badge or an action.
   */
  readonly sortValue?: (row: T) => string | number;
}

export interface FilterTab<T> {
  readonly value: string;
  readonly label: string;
  /** Omit on the "all" tab. */
  readonly match?: (row: T) => boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  entityLabel,
  tabs,
  card,
  expand,
  rowActions,
  toolbar,
  empty,
  initialPageSize = 25,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  /** Everything about a row that search should match, displayed or not. */
  searchText: (row: T) => string;
  searchPlaceholder: string;
  /** Plural, lower case — used in counts and the empty state. */
  entityLabel: string;
  tabs?: readonly FilterTab<T>[];
  /** Supplying this adds the table/card view toggle. */
  card?: (row: T) => ReactNode;
  /** Supplying this adds a per-row expander. */
  expand?: (row: T) => ReactNode;
  rowActions?: (row: T) => ReactNode;
  /** Extra controls dropped into the toolbar, e.g. a district filter. */
  toolbar?: ReactNode;
  /**
   * What to say when the list has never had anything in it.
   *
   * Distinct from the filtered-to-nothing message, which this component writes
   * itself. Conflating the two is what it used to do — "no buyers match these
   * filters" on a platform with no buyers reads as a broken filter, and
   * somebody clears it, and nothing happens.
   */
  empty?: { icon?: LucideIcon; title: string; description?: string; tone?: EmptyTone };
  initialPageSize?: number;
}) {
  const [tab, setTab] = useState(tabs?.[0]?.value ?? "all");
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  /*
    Cards first wherever a list can draw them.

    A row of cells answers "how do these compare"; a card answers "what is
    this one". Almost everything in both consoles is the second question — an
    operator opens the enquiry list to deal with a person, and a farmer opens
    their listings to look at a lot. The table is still one click away for the
    times comparison is the point, which is what the toggle is for.

    A list with no card renderer stays a table, because there is nothing else
    it could be.
  */
  const [view, setView] = useState<"table" | "cards">(card ? "cards" : "table");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Tab counts come from the unfiltered set on purpose: a count that shrinks
  // as you type stops telling you how much work there is.
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of tabs ?? []) {
      out[t.value] = t.match ? rows.filter(t.match).length : rows.length;
    }
    return out;
  }, [rows, tabs]);

  // Search and tab are applied before the table sees the data. TanStack's own
  // global filter only considers columns with an accessor and a string value,
  // which would silently skip every badge and composite column here.
  const scoped = useMemo(() => {
    const active = tabs?.find((t) => t.value === tab);
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (active?.match && !active.match(row)) return false;
      if (!needle) return true;
      return searchText(row).toLowerCase().includes(needle);
    });
  }, [rows, tabs, tab, query, searchText]);

  /*
    Two different emptinesses. Nothing has ever been here, or everything here is
    hidden — the second has a fix the reader can act on, so it offers it.
  */
  const nothingAtAll = rows.length === 0;

  const emptyState = nothingAtAll ? (
    <EmptyState
      icon={empty?.icon ?? InboxIcon}
      title={empty?.title ?? `No ${entityLabel} yet`}
      description={empty?.description}
      tone={empty?.tone ?? "waiting"}
    />
  ) : (
    <EmptyState
      icon={FilterXIcon}
      tone="filtered"
      title={`No ${entityLabel} match this search`}
      description={`There are ${rows.length} ${entityLabel} in total. Clear the search and tabs to see them.`}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuery("");
            setTab(tabs?.[0]?.value ?? "all");
          }}
        >
          Clear filters
        </Button>
      }
    />
  );

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const helper = createColumnHelper<T>();

    return columns.map((column) => {
      const meta = { className: column.className };

      // Sortable columns must be accessor columns: v8's `getCanSort()`
      // requires an `accessorFn`, so a display column can never sort no matter
      // what `enableSorting` says.
      if (column.sortValue) {
        const read = column.sortValue;
        return helper.accessor((row) => read(row), {
          id: column.key,
          header: column.header,
          cell: (context) => column.cell(context.row.original),
          enableSorting: true,
          sortingFn: (a, b, columnId) => {
            const left = a.getValue(columnId);
            const right = b.getValue(columnId);
            if (typeof left === "number" && typeof right === "number") {
              return left - right;
            }
            return String(left).localeCompare(String(right), "en-IN");
          },
          meta,
        });
      }

      return helper.display({
        id: column.key,
        header: column.header,
        cell: (context) => column.cell(context.row.original),
        enableSorting: false,
        meta,
      });
    }) as unknown as ColumnDef<T>[];
  }, [columns]);

  const table = useReactTable({
    data: scoped,
    columns: tableColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const pageRows = table.getRowModel().rows;
  const trailingColumns = (expand ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <SearchIcon className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${entityLabel}`}
            className="pl-8"
          />
        </div>

        {toolbar}

        {tabs && tabs.length > 0 ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label} {counts[t.value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon className="size-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().map((column) => (
                <div
                  key={column.id}
                  className="hover:bg-secondary flex items-center gap-2 rounded-sm px-2 py-1.5"
                >
                  <Checkbox
                    id={`col-${column.id}`}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) =>
                      column.toggleVisibility(checked === true)
                    }
                  />
                  <Label
                    htmlFor={`col-${column.id}`}
                    className="flex-1 text-sm font-normal"
                  >
                    {columns.find((c) => c.key === column.id)?.header ?? column.id}
                  </Label>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {card ? (
            // Grid on the left, table on the right. The order is not decoration:
            // a pair of toggles reads left to right as primary then secondary,
            // and the default should be the one your eye lands on first.
            <div className="flex" role="group" aria-label="View">
              <Button
                variant={view === "cards" ? "secondary" : "outline"}
                size="icon"
                aria-label="Card view"
                aria-pressed={view === "cards"}
                className="rounded-r-none"
                onClick={() => setView("cards")}
              >
                <LayoutGridIcon className="size-4" />
              </Button>
              <Button
                variant={view === "table" ? "secondary" : "outline"}
                size="icon"
                aria-label="Table view"
                aria-pressed={view === "table"}
                className="rounded-l-none border-l-0"
                onClick={() => setView("table")}
              >
                <Rows3Icon className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {card && view === "cards" ? (
        <div className="min-w-0 flex-1 overflow-y-auto border-t p-6">
          {pageRows.length === 0 ? (
            emptyState
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((row) => (
                <li
                  key={row.id}
                  className="bg-card flex flex-col gap-3 rounded-lg border p-4"
                >
                  {card(row.original)}
                  {rowActions ? (
                    <div className="mt-auto flex justify-end border-t pt-2">
                      {rowActions(row.original)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-x-auto border-t">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta as
                      | { className?: string }
                      | undefined;
                    const direction = header.column.getIsSorted();

                    return (
                      <TableHead key={header.id} className={meta?.className}>
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="hover:text-foreground focus-visible:ring-ring -mx-1 flex items-center gap-1 rounded px-1 py-0.5 focus-visible:ring-2 focus-visible:outline-none"
                            aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {direction === "asc" ? (
                              <ArrowUpIcon className="size-3" />
                            ) : direction === "desc" ? (
                              <ArrowDownIcon className="size-3" />
                            ) : (
                              <ArrowUpDownIcon className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </TableHead>
                    );
                  })}
                  {trailingColumns > 0 ? <TableHead className="w-0" /> : null}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length + trailingColumns}
                    className="p-6"
                  >
                    {emptyState}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const isOpen = expanded === row.original.id;

                  return (
                    <Fragment key={row.id}>
                      <TableRow>
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta as
                            | { className?: string }
                            | undefined;
                          return (
                            <TableCell key={cell.id} className={meta?.className}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          );
                        })}

                        {trailingColumns > 0 ? (
                          <TableCell className="pr-6 text-right">
                            <span className="flex items-center justify-end gap-1">
                              {rowActions ? rowActions(row.original) : null}
                              {expand ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-expanded={isOpen}
                                  aria-label="Show detail"
                                  onClick={() =>
                                    setExpanded(isOpen ? null : row.original.id)
                                  }
                                >
                                  <ChevronDownIcon
                                    className={cn(
                                      "size-4 transition-transform",
                                      isOpen && "rotate-180",
                                    )}
                                  />
                                </Button>
                              ) : null}
                            </span>
                          </TableCell>
                        ) : null}
                      </TableRow>

                      {expand && isOpen ? (
                        <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                          <TableCell
                            colSpan={
                              table.getVisibleLeafColumns().length + trailingColumns
                            }
                            className="px-6 py-4"
                          >
                            {expand(row.original)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
        <p className="text-muted-foreground tabular text-sm">
          {scoped.length === 0
            ? `No ${entityLabel}`
            : `${scoped.length} ${scoped.length === 1 ? entityLabel.replace(/s$/, "") : entityLabel}`}
          {query || tab !== (tabs?.[0]?.value ?? "all") ? ` of ${rows.length}` : ""}
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="page-size" className="text-faint text-xs">
              Per page
            </Label>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger id="page-size" size="sm" className="w-20">
                <SelectValue className="tabular">
                  {table.getState().pagination.pageSize}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-muted-foreground tabular text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </span>

          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
