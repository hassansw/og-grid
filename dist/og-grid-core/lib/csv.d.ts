import { ColumnDef } from './types';
export declare function toCsv<T>(rows: T[], cols: ColumnDef<T>[]): string;
