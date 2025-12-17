import { ColumnDef, SortModelItem } from './types';

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
    var model = sortModel && sortModel.length ? sortModel[0] : null;
    if (!model) return rows.slice();

    var target = cols.find(function (c) {
        return String(c.field) === model!.colId;
    });
    if (!target || !target.sortable) return rows.slice();

    var dir = model.sort === 'desc' ? -1 : 1;
    var comparator =
        target.comparator ||
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

    var clone = rows.slice();
    clone.sort(function (a, b) {
        var av = getCellValue(target!, a);
        var bv = getCellValue(target!, b);
        return comparator(av, bv, a, b) * dir;
    });
    return clone;
}

