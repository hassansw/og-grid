import {
    AggModelItem,
    AggregationType,
    ColumnDef,
    FilterModelItem,
    GroupModelItem,
    RowView,
    SortModelItem,
    GroupViewRow,
    TextFilterMode,
} from './types';

export function mergeColDef<T>(col: ColumnDef<T>, defaultColDef?: Partial<ColumnDef<T>>): ColumnDef<T> {
    var base = defaultColDef || {};
    // Shallow merge is enough for the current scope.
    return Object.assign({}, base, col);
}

export function getCellValue<T>(col: ColumnDef<T>, row: T): any {
    if (!col) return undefined;
    if (col.valueGetter) return col.valueGetter(row);
    var field = col.field as keyof T;
    return (row as any)?.[field];
}

export function sortRows<T>(
    rows: T[],
    cols: ColumnDef<T>[],
    sortModel: SortModelItem[]
): T[] {
    if (!rows || rows.length === 0) return [];
    if (!sortModel || sortModel.length === 0) return rows.slice();

    var colMap: Record<string, ColumnDef<T> | undefined> = {};
    cols.forEach(function (c) {
        colMap[String(c.field)] = c;
    });

    var active = sortModel
        .map(function (m) {
            var col = colMap[m.colId];
            if (!col || !col.sortable) return null;
            var dir = m.sort === 'desc' ? -1 : 1;
            var cmp =
                col.comparator ||
                function (a: any, b: any): number {
                    if (a == null && b == null) return 0;
                    if (a == null) return -1;
                    if (b == null) return 1;
                    if (typeof a === 'number' && typeof b === 'number') return a - b;
                    var as = String(a);
                    var bs = String(b);
                    if (as < bs) return -1;
                    if (as > bs) return 1;
                    return 0;
                };
            return { col, dir, cmp };
        })
        .filter(Boolean) as { col: ColumnDef<T>; dir: number; cmp: (a: any, b: any) => number }[];

    if (active.length === 0) return rows.slice();

    var clone = rows.slice();
    clone.sort(function (a, b) {
        for (var i = 0; i < active.length; i++) {
            var s = active[i];
            var av = getCellValue(s.col, a);
            var bv = getCellValue(s.col, b);
            var res = s.cmp(av, bv) * s.dir;
            if (res !== 0) return res;
        }
        return 0;
    });
    return clone;
}

export function filterRows<T>(
    rows: T[],
    cols: ColumnDef<T>[],
    filterModel: FilterModelItem[]
): T[] {
    if (!rows || rows.length === 0) return [];
    if (!filterModel || filterModel.length === 0) return rows.slice();

    var colMap: Record<string, ColumnDef<T> | undefined> = {};
    cols.forEach(function (c) {
        colMap[String(c.field)] = c;
    });

    return rows.filter(function (row) {
        for (var i = 0; i < filterModel.length; i++) {
            var f = filterModel[i];
            var col = colMap[f.colId];
            if (!col) continue;

            var cell = getCellValue(col, row);

            // Custom predicate wins
            if (typeof col.filter === 'function') {
                if (!col.filter(cell, row)) return false;
                continue;
            }

    var type = f.type || (typeof cell === 'number' ? 'number' : 'text');
    var comparator = col.filterComparator || defaultFilterComparator;
    var pass = comparator(cell, f.value, f.valueTo, type, f.matchMode || col.filterMatchMode);
            if (!pass) return false;
        }
        return true;
    });
}

function defaultFilterComparator(
    cellValue: any,
    filterValue: any,
    filterValueTo: any,
    type: FilterModelItem['type'],
    matchMode?: TextFilterMode
): boolean {
    if (type === 'number') {
        if (filterValue == null && filterValueTo == null) return true;
        var num = numberVal(cellValue);
        if (num == null) return false;
        var from = numberVal(filterValue);
        var to = numberVal(filterValueTo);
        if (from != null && num < from) return false;
        if (to != null && num > to) return false;
        return true;
    }

    if (type === 'date') {
        if (!filterValue && !filterValueTo) return true;
        var d = dateVal(cellValue);
        if (d == null) return false;
        var dFrom = dateVal(filterValue);
        var dTo = dateVal(filterValueTo);
        if (dFrom != null && d < dFrom) return false;
        if (dTo != null && d > dTo) return false;
        return true;
    }

    // text (default): case-insensitive contains/starts/equals
    if (filterValue == null || filterValue === '') return true;
    var s = safeString(cellValue);
    var fv = safeString(filterValue);
    if (matchMode === 'startsWith') return s.startsWith(fv);
    if (matchMode === 'equals') return s === fv;
    return s.indexOf(fv) >= 0;
}

function safeString(v: any): string {
    return v == null ? '' : String(v).toLowerCase();
}

function numberVal(v: any): number | null {
    if (v == null || v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
}

function dateVal(v: any): number | null {
    if (!v && v !== 0) return null;
    if (v instanceof Date) return v.getTime();
    var d = new Date(v);
    var t = d.getTime();
    return isNaN(t) ? null : t;
}

// -------- Grouping & Aggregation --------

interface GroupNode<T = any> {
    key: any;
    colId: string;
    level: number;
    path: string;
    count: number;
    agg: Record<string, any>;
    children?: GroupNode<T>[];
    rows?: T[];
}

export function groupAndFlattenRows<T>(
    rows: T[],
    cols: ColumnDef<T>[],
    groupModel: GroupModelItem[],
    aggModel: AggModelItem[],
    expanded: Set<string> | null | undefined
): { flat: Array<RowView<T>>; paths: string[] } {
    if (!groupModel || groupModel.length === 0) {
        return { flat: rows.slice() as Array<RowView<T>>, paths: [] };
    }

    var colMap: Record<string, ColumnDef<T> | undefined> = {};
    cols.forEach(function (c) {
        colMap[String(c.field)] = c;
    });

    var aggLookup: Record<string, AggModelItem> = {};
    aggModel.forEach(function (a) {
        aggLookup[a.colId] = a;
    });

    var tree = buildGroupTree(rows, groupModel, colMap, aggLookup, 0, '');
    var paths: string[] = [];
    var flat: Array<RowView<T>> = [];

    var isExpanded = function (path: string): boolean {
        if (!expanded) return true;
        return expanded.has(path);
    };

    flatten(tree, isExpanded, flat, paths);
    return { flat, paths };
}

function buildGroupTree<T>(
    rows: T[],
    groupModel: GroupModelItem[],
    colMap: Record<string, ColumnDef<T> | undefined>,
    aggLookup: Record<string, AggModelItem>,
    level: number,
    prefix: string
): GroupNode<T>[] {
    var colId = groupModel[level]?.colId;
    if (!colId) return [];
    var col = colMap[colId];
    var groups: Record<string, T[]> = {};

    rows.forEach(function (row) {
        var key = col ? getCellValue(col, row) : undefined;
        var k = key == null ? '__null__' : String(key);
        if (!groups[k]) groups[k] = [];
        groups[k].push(row);
    });

    var keys = Object.keys(groups).sort();
    var nodes: GroupNode<T>[] = [];

    keys.forEach(function (k) {
        var keyRows = groups[k];
        var path = prefix ? prefix + '|' + k : k;
        var children: GroupNode<T>[] | undefined;
        var leafRows: T[] | undefined;

        if (level < groupModel.length - 1) {
            children = buildGroupTree(keyRows, groupModel, colMap, aggLookup, level + 1, path);
        } else {
            leafRows = keyRows;
        }

        var agg = computeAggs(leafRows || collectLeafRows(children), colMap, aggLookup);

        nodes.push({
            key: k === '__null__' ? null : maybeOriginalKey(keyRows, col),
            colId: colId,
            level: level,
            path: path,
            count: leafRows ? leafRows.length : countLeaves(children),
            agg: agg,
            children: children,
            rows: leafRows,
        });
    });

    return nodes;
}

function maybeOriginalKey<T>(rows: T[], col?: ColumnDef<T>): any {
    if (!col || rows.length === 0) return null;
    return getCellValue(col, rows[0]);
}

function collectLeafRows<T>(nodes?: GroupNode<T>[]): T[] {
    if (!nodes || nodes.length === 0) return [];
    var out: T[] = [];
    nodes.forEach(function (n) {
        if (n.rows) out.push.apply(out, n.rows);
        else out.push.apply(out, collectLeafRows(n.children));
    });
    return out;
}

function countLeaves<T>(nodes?: GroupNode<T>[]): number {
    if (!nodes || nodes.length === 0) return 0;
    var total = 0;
    nodes.forEach(function (n) {
        if (n.rows) total += n.rows.length;
        else total += countLeaves(n.children);
    });
    return total;
}

function computeAggs<T>(
    rows: T[],
    colMap: Record<string, ColumnDef<T> | undefined>,
    aggLookup: Record<string, AggModelItem>
): Record<string, any> {
    var agg: Record<string, any> = {};
    if (!rows || rows.length === 0) return agg;

    Object.keys(aggLookup).forEach(function (colId) {
        var aggItem = aggLookup[colId];
        var col = colMap[colId];
        var values = rows.map(function (r) {
            return col ? getCellValue(col, r) : undefined;
        });
        var fn = resolveAggFunc(aggItem.aggFunc, col);
        agg[colId] = fn(values);
    });

    return agg;
}

function resolveAggFunc<T>(
    agg: AggregationType | ((values: any[]) => any),
    col?: ColumnDef<T>
): (values: any[]) => any {
    if (typeof agg === 'function') return agg;

    var numericAgg = function (values: any[], reducer: (a: number, b: number) => number, start: number): any {
        var nums = values
            .map(function (v) {
                return typeof v === 'number' ? v : Number(v);
            })
            .filter(function (v) {
                return !isNaN(v);
            });
        if (nums.length === 0) return null;
        return nums.reduce(reducer, start);
    };

    switch (agg) {
        case 'sum':
            return function (values: any[]): any {
                return numericAgg(values, function (a, b) { return a + b; }, 0);
            };
        case 'min':
            return function (values: any[]): any {
                return numericAgg(values, function (a, b) { return Math.min(a, b); }, Number.POSITIVE_INFINITY);
            };
        case 'max':
            return function (values: any[]): any {
                return numericAgg(values, function (a, b) { return Math.max(a, b); }, Number.NEGATIVE_INFINITY);
            };
        case 'avg':
            return function (values: any[]): any {
                var nums = values
                    .map(function (v) {
                        return typeof v === 'number' ? v : Number(v);
                    })
                    .filter(function (v) {
                        return !isNaN(v);
                    });
                if (nums.length === 0) return null;
                var total = nums.reduce(function (a, b) { return a + b; }, 0);
                return total / nums.length;
            };
        case 'count':
        default:
            return function (values: any[]): any {
                return values.length;
            };
    }
}

function flatten<T>(
    nodes: GroupNode<T>[],
    isExpanded: (path: string) => boolean,
    out: Array<RowView<T>>,
    paths: string[]
): void {
    nodes.forEach(function (n) {
        var gRow: GroupViewRow<T> = {
            __group: true,
            key: n.key,
            colId: n.colId,
            level: n.level,
            path: n.path,
            count: n.count,
            agg: n.agg,
        };
        out.push(gRow);
        paths.push(n.path);

        if (isExpanded(n.path)) {
            if (n.children && n.children.length) {
                flatten(n.children, isExpanded, out, paths);
            } else if (n.rows) {
                out.push.apply(out, n.rows as any);
            }
        }
    });
}

