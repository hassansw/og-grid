import { AggModelItem, ColumnDef, FilterModelItem, GroupModelItem, RowView, SortModelItem, PivotModel } from './types';
export declare function mergeColDef<T>(col: ColumnDef<T>, defaultColDef?: Partial<ColumnDef<T>>): ColumnDef<T>;
export declare function getCellValue<T>(col: ColumnDef<T>, row: T): any;
export declare function sortRows<T>(rows: T[], cols: ColumnDef<T>[], sortModel: SortModelItem[]): T[];
export declare function filterRows<T>(rows: T[], cols: ColumnDef<T>[], filterModel: FilterModelItem[]): T[];
export declare function groupAndFlattenRows<T>(rows: T[], cols: ColumnDef<T>[], groupModel: GroupModelItem[], aggModel: AggModelItem[], expanded: Set<string> | null | undefined): {
    flat: Array<RowView<T>>;
    paths: string[];
};
export interface PivotResult<T = any> {
    rows: T[];
    dynamicCols: ColumnDef<T>[];
    paths: string[];
}
export declare function pivotRows<T>(rows: T[], cols: ColumnDef<T>[], pivot: PivotModel, expanded: Set<string> | null | undefined): PivotResult<T>;
