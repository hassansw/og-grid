export type SortDirection = 'asc' | 'desc';

export interface SortModelItem {
    colId: string;
    sort: SortDirection;
}

export type RowSelectionMode = 'single' | 'multiple';

export interface GridOptions<T = any> {
    rowSelection?: RowSelectionMode;
    defaultColDef?: Partial<ColumnDef<T>>;
}

export interface ColumnDef<T = any> {
    field: keyof T | string;
    headerName?: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    sortable?: boolean;
    /**
     * Returns the raw value for this column. If omitted, the field property is used.
     */
    valueGetter?: (row: T) => any;
    /**
     * Formats the value for display/export. Receives the raw value and the row object.
     */
    valueFormatter?: (value: any, row: T) => any;
    /**
     * Optional custom comparator used for sorting.
     */
    comparator?: (a: any, b: any, rowA: T, rowB: T) => number;
}

export interface GridApi<T = any> {
    setRowData(data: T[]): void;
    setColumnDefs(cols: ColumnDef<T>[]): void;
    setSortModel(model: SortModelItem[]): void;
    getSortModel(): SortModelItem[];
    getSelectedRows(): T[];
    exportCsv(filename?: string): void;
}

