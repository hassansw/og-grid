export type SortDirection = 'asc' | 'desc';

export interface SortModelItem {
    colId: string;
    sort: SortDirection;
}

export type TextFilterMode = 'contains' | 'startsWith' | 'equals';

export type AggregationType = 'sum' | 'min' | 'max' | 'avg' | 'count';

export interface AggModelItem {
    colId: string;
    aggFunc: AggregationType | ((values: any[]) => any);
}

export type FilterType = 'text' | 'number' | 'date';

export interface FilterModelItem {
    colId: string;
    type?: FilterType;
    value?: any;
    /**
     * Optional upper bound for range filters (number/date).
     */
    valueTo?: any;
    /**
     * For text filters: contains | startsWith | equals
     */
    matchMode?: TextFilterMode;
}

export type RowSelectionMode = 'single' | 'multiple';

export interface GroupModelItem {
    colId: string;
}

export interface PivotModel {
    rowGroupCols: GroupModelItem[];
    pivotCol?: string;
    valueCols: AggModelItem[];
    enabled: boolean;
}

export interface GridOptions<T = any> {
    rowSelection?: RowSelectionMode;
    defaultColDef?: Partial<ColumnDef<T>>;
    /**
     * Enable multi-column sorting (otherwise single-column).
     */
    multiSort?: boolean;
}

export interface ColumnDef<T = any> {
    // field: keyof T | string;
    field: any;
    headerName?: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    sortable?: boolean;
    filter?: FilterType | ((value: any, row: T) => boolean);
    /**
     * Optional filter comparator: receives cell value + filter values.
     */
    filterComparator?: (cellValue: any, filterValue: any, filterValueTo?: any) => boolean;
    /**
     * Default text match mode for this column.
     */
    filterMatchMode?: TextFilterMode;
    /**
     * Aggregation function to use when this column participates in grouping aggregations.
     * If omitted, numeric columns default to 'sum', others to 'count'.
     */
    aggFunc?: AggregationType | ((values: any[]) => any);
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
    setFilterModel(model: FilterModelItem[]): void;
    setGroupModel(model: GroupModelItem[]): void;
    setExpandedGroups(paths: string[]): void;
    setPivotModel(model: PivotModel): void;
    getSortModel(): SortModelItem[];
    getFilterModel(): FilterModelItem[];
    getGroupModel(): GroupModelItem[];
    getExpandedGroups(): string[];
    getPivotModel(): PivotModel;
    getSelectedRows(): T[];
    exportCsv(filename?: string): void;
}

export interface GroupViewRow<T = any> {
    __group: true;
    key: any;
    colId: string;
    level: number;
    path: string;
    count: number;
    agg: Record<string, any>;
}

export type RowView<T = any> = T | GroupViewRow<T>;

