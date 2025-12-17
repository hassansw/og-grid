import {
    Component,
    ChangeDetectionStrategy,
    Input,
    OnChanges,
    SimpleChanges,
} from '@angular/core';

import {
    ColumnDef,
    GridOptions,
    GridApi,
    SortModelItem,
    mergeColDef,
    sortRows,
    toCsv,
    getCellValue,
} from 'og-grid-core';


@Component({
    selector: 'og-grid',
    templateUrl: './og-grid.component.html',
    styleUrls: ['./og-grid.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgGridComponent<T = any> implements OnChanges {
    @Input() columnDefs: ColumnDef<T>[] = [];
    @Input() rowData: T[] = [];
    @Input() options: Partial<GridOptions<T>> = {};

    // Optional: expose API to parent via template ref: #grid then grid.api.exportCsv()
    api: GridApi<T>;

    mergedCols: ColumnDef<T>[] = [];
    viewRows: T[] = [];

    sortModel: SortModelItem[] = [];

    private selected = new Set<number>(); // track by row index in viewRows

    constructor() {
        var self = this;

        this.api = {
            setRowData: function (data: T[]) {
                self.rowData = data || [];
                self.recompute();
            },
            setColumnDefs: function (cols: ColumnDef<T>[]) {
                self.columnDefs = cols || [];
                self.recompute();
            },
            setSortModel: function (model: SortModelItem[]) {
                self.sortModel = model || [];
                self.recompute();
            },
            getSortModel: function () {
                return self.sortModel.slice();
            },
            getSelectedRows: function () {
                var out: T[] = [];
                self.selected.forEach(function (idx) {
                    if (idx >= 0 && idx < self.viewRows.length) out.push(self.viewRows[idx]);
                });
                return out;
            },
            exportCsv: function (filename?: string) {
                var name = filename || 'og-grid-export.csv';
                var csv = toCsv(self.viewRows, self.mergedCols);
                downloadTextFile(csv, name, 'text/csv;charset=utf-8;');
            },
        };
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (
            changes.columnDefs ||
            changes.rowData ||
            changes.options
        ) {
            this.recompute();
        }
    }

    private recompute(): void {
        var def = (this.options && this.options.defaultColDef) || {};
        this.mergedCols = (this.columnDefs || []).map(function (c) {
            return mergeColDef(c, def);
        });

        // Sorting only for now (filtering/grouping/pivot later)
        var sortableCols = this.mergedCols;
        this.viewRows = sortRows(this.rowData || [], sortableCols, this.sortModel);

        // Reset selection if it would become invalid
        var next = new Set<number>();
        this.selected.forEach((idx) => {
            if (idx >= 0 && idx < this.viewRows.length) next.add(idx);
        });
        this.selected = next;
    }

    // ---- UI actions ----

    onHeaderClick(col: ColumnDef<T>): void {
        if (!col.sortable) return;

        var colId = String(col.field);
        var existing = this.sortModel.length ? this.sortModel[0] : null;

        // Simple single-column sort cycle: none -> asc -> desc -> none
        if (!existing || existing.colId !== colId) {
            this.sortModel = [{ colId: colId, sort: 'asc' }];
        } else if (existing.sort === 'asc') {
            this.sortModel = [{ colId: colId, sort: 'desc' }];
        } else {
            this.sortModel = [];
        }

        this.recompute();
    }

    getSortIndicator(col: ColumnDef<T>): string {
        if (!this.sortModel.length) return '';
        var m = this.sortModel[0];
        if (m.colId !== String(col.field)) return '';
        return m.sort === 'asc' ? '▲' : '▼';
    }

    isRowSelected(rowIndex: number): boolean {
        return this.selected.has(rowIndex);
    }

    toggleRowSelection(rowIndex: number, ev?: MouseEvent): void {
        var mode = (this.options && this.options.rowSelection) || 'single';

        if (mode === 'single') {
            this.selected.clear();
            this.selected.add(rowIndex);
            return;
        }

        // multiple
        if (this.selected.has(rowIndex)) this.selected.delete(rowIndex);
        else this.selected.add(rowIndex);
    }

    toggleAll(): void {
        if (this.viewRows.length === 0) return;

        if (this.selected.size === this.viewRows.length) {
            this.selected.clear();
            return;
        }

        this.selected.clear();
        for (var i = 0; i < this.viewRows.length; i++) this.selected.add(i);
    }

    get allSelected(): boolean {
        return this.viewRows.length > 0 && this.selected.size === this.viewRows.length;
    }

    renderCell(col: ColumnDef<T>, row: T): any {
        var value = getCellValue(col, row);
        return col.valueFormatter ? col.valueFormatter(value, row) : value;
    }

    trackByIndex(_i: number, _row: T): number {
        return _i;
    }
}

function downloadTextFile(content: string, filename: string, mime: string): void {
    var blob = new Blob([content], { type: mime });
    var url = (window.URL || (window as any).webkitURL).createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
        document.body.removeChild(a);
        (window.URL || (window as any).webkitURL).revokeObjectURL(url);
    }, 0);
}
