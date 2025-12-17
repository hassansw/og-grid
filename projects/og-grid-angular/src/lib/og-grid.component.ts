import {
    Component,
    ChangeDetectionStrategy,
    Input,
    OnChanges,
    SimpleChanges,
    ChangeDetectorRef,
    NgZone,
    HostListener,
    ElementRef,
    OnInit,
} from '@angular/core';

import {
    ColumnDef,
    GridOptions,
    GridApi,
    SortModelItem,
    FilterModelItem,
    GroupModelItem,
    PivotModel,
    AggModelItem,
    GroupViewRow,
    RowView,
    mergeColDef,
    sortRows,
    filterRows,
    groupAndFlattenRows,
    pivotRows,
    toCsv,
    getCellValue,
} from 'og-grid-core';


@Component({
    selector: 'og-grid',
    templateUrl: './og-grid.component.html',
    styleUrls: ['./og-grid.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgGridComponent<T = any> implements OnInit, OnChanges {
    @Input() columnDefs: ColumnDef<T>[] = [];
    @Input() rowData: T[] = [];
    @Input() options: Partial<GridOptions<T>> = {};
    @Input() showSelection: boolean = true; // explicit toggle for checkbox column

    // Optional: expose API to parent via template ref: #grid then grid.api.exportCsv()
    api: GridApi<T>;

    mergedCols: ColumnDef<T>[] = [];
    viewRows: RowView<T>[] = [];

    sortModel: SortModelItem[] = [];
    filterModel: FilterModelItem[] = [];
    groupModel: GroupModelItem[] = [];
    pivotModel: PivotModel = { rowGroupCols: [], valueCols: [], pivotCol: undefined, enabled: false };
    expandedGroups = new Set<string>();
    filterInputs: Record<string, { value?: any; valueTo?: any }> = {};
    private filterModes: Record<string, 'contains' | 'startsWith' | 'equals'> = {};
    private filterDebounce: Record<string, any> = {};
    private colWidths: Record<string, number> = {};
    menuOpenFor: string | null = null;
    private resizeFrame: number | null = null;
    private resizingCol: string | null = null;
    showPivotPanel = true;

    private selected = new Set<T>(); // track by row object references

    constructor(private cdr: ChangeDetectorRef, private zone: NgZone, private host: ElementRef<HTMLElement>) {
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
            setFilterModel: function (model: FilterModelItem[]) {
                self.filterModel = model || [];
                self.recompute();
            },
            getSortModel: function () {
                return self.sortModel.slice();
            },
            getFilterModel: function () {
                return self.filterModel.slice();
            },
            setGroupModel: function (model: GroupModelItem[]) {
                self.groupModel = model || [];
                self.recompute();
            },
            getGroupModel: function () {
                return self.groupModel.slice();
            },
            setExpandedGroups: function (paths: string[]) {
                self.expandedGroups = new Set(paths || []);
                self.recompute();
            },
            getExpandedGroups: function () {
                return Array.from(self.expandedGroups);
            },
            setPivotModel: function (model: PivotModel) {
                self.pivotModel = model || { rowGroupCols: [], valueCols: [], pivotCol: undefined, enabled: false };
                self.recompute();
            },
            getPivotModel: function () {
                return Object.assign({}, self.pivotModel);
            },
            getSelectedRows: function () {
                return Array.from(self.selected);
            },
            exportCsv: function (filename?: string) {
                var name = filename || 'og-grid-export.csv';
                var csv = toCsv(self.getLeafRows(), self.mergedCols);
                downloadTextFile(csv, name, 'text/csv;charset=utf-8;');
            },
        };
    }

    ngOnInit(): void {
        this.setColumns();
    }

    setColumns() {
        if (!isArrayValid(this.columnDefs, 0) && isArrayValid(this.rowData, 0)) {
            this.columnDefs = this.buildColumnDefs(this.rowData);
        }
    }

    inferType(val: any) {
        if (val === null || val === undefined) return 'text';
        if (typeof val === 'number') return 'number';
        const d = new Date(val);
        if (!isNaN(d.getTime()) && /[T:\-\/]/.test(String(val))) return 'date';
        if (!isNaN(Number(val)) && val !== '') return 'number';
        return 'text';
    }

    buildColumnDefs(data: any[]) {
        if (!data.length) return [];
        return Object.keys(data[0]).map(k => {
            let sample = data.find(r => r[k] != null)?.[k];
            const t = this.inferType(sample);
            const col: any = {
                field: k, headerName: this.generateHeaderFromKey(k), filter: true, sortable: true, resizable: true,
                enableRowGroup: true, enablePivot: true, enableValue: true
            };
            if (t === 'number') { col.aggFunc = 'sum'; }
            if (t === 'date') { col.filter = 'agDateColumnFilter'; }
            return col;
        });
    }

    generateHeaderFromKey(key: any) {
        return key
            // Insert space before uppercase letters (for camelCase)
            .replace(/([A-Z])/g, ' $1')
            // Replace common separators with spaces
            .replace(/[_-]/g, ' ')
            // Handle acronyms and special cases (multiple capitals in a row)
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            // Clean up multiple spaces
            .replace(/\s+/g, ' ')
            // Trim and convert to title case
            .trim()
            .split(' ')
            .map((word: any) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }



    @HostListener('document:click', ['$event'])
    onDocClick(ev: MouseEvent): void {
        if (!this.menuOpenFor) return;
        if (this.host && this.host.nativeElement.contains(ev.target as Node)) {
            // clicks inside component: ignore unless on menu toggle handled elsewhere
            return;
        }
        this.menuOpenFor = null;
        this.cdr.markForCheck();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.setColumns();
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

        var filtered = filterRows(this.rowData || [], this.mergedCols, this.filterModel);
        var sorted = sortRows(filtered, this.mergedCols, this.sortModel);

        if (this.pivotModel.enabled && this.pivotModel.pivotCol && this.pivotModel.valueCols.length) {
            var pivoted = pivotRows(sorted, this.mergedCols, this.pivotModel, this.expandedGroups);
            // replace columns with dynamic pivot cols only (no original data cols for now)
            this.viewRows = pivoted.rows;
            this.mergedCols = pivoted.dynamicCols;
            this.expandedGroups.clear();
        } else if (this.groupModel.length) {
            var aggModel = this.buildAggModel();
            var grouped = groupAndFlattenRows(sorted, this.mergedCols, this.groupModel, aggModel, this.expandedGroups);
            // Ensure new groups are expanded by default
            grouped.paths.forEach((p) => this.expandedGroups.add(p));
            this.viewRows = grouped.flat;
        } else {
            this.viewRows = sorted;
            this.expandedGroups.clear();
        }

        // Reset selection if it would become invalid
        var next = new Set<T>();
        var leaves = this.getLeafRows();
        this.selected.forEach((row) => {
            if (leaves.indexOf(row) >= 0) next.add(row);
        });
        this.selected = next;
    }

    // ---- UI actions ----

    onHeaderClick(col: ColumnDef<T>, ev?: MouseEvent): void {
        if (!col.sortable) return;
        // If menu is open for this column, don't toggle sort
        if (this.menuOpenFor === String(col.field)) return;

        var colId = String(col.field);
        var multi = !!(this.options && this.options.multiSort) || !!(ev && ev.shiftKey);

        var next = multi ? this.sortModel.slice() : [];
        var idx = next.findIndex(function (m) {
            return m.colId === colId;
        });

        if (idx === -1) {
            next.push({ colId: colId, sort: 'asc' });
        } else {
            var current = next[idx];
            if (current.sort === 'asc') next[idx] = { colId: colId, sort: 'desc' };
            else next.splice(idx, 1); // remove -> unsorted
        }

        this.recompute();
    }

    getSortIndicator(col: ColumnDef<T>): string {
        if (!this.sortModel.length) return '';
        var idx = this.sortModel.findIndex((m) => m.colId === String(col.field));
        if (idx === -1) return '';
        var mark = this.sortModel[idx].sort === 'asc' ? '▲' : '▼';
        return this.sortModel.length > 1 ? mark + ' ' + (idx + 1) : mark;
    }

    isRowSelected(row: RowView<T>): boolean {
        if (this.isGroupRow(row)) return false;
        return this.selected.has(row as T);
    }

    toggleRowSelection(row: RowView<T>, ev?: MouseEvent): void {
        if (!this.showSelectionColumn) return;
        if (this.isGroupRow(row)) return;
        var mode = (this.options && this.options.rowSelection) || 'single';

        if (mode === 'single') {
            this.selected.clear();
            this.selected.add(row as T);
            return;
        }

        // multiple
        if (this.selected.has(row as T)) this.selected.delete(row as T);
        else this.selected.add(row as T);
    }

    toggleAll(): void {
        if (!this.showSelectionColumn) return;
        var leaves = this.getLeafRows();
        if (leaves.length === 0) return;

        if (this.selected.size === leaves.length) {
            this.selected.clear();
            return;
        }

        this.selected.clear();
        leaves.forEach((r) => this.selected.add(r));
    }

    get allSelected(): boolean {
        if (!this.showSelectionColumn) return false;
        var leaves = this.getLeafRows();
        return leaves.length > 0 && this.selected.size === leaves.length;
    }

    renderCell(col: ColumnDef<T>, row: T): any {
        var value = getCellValue(col, row);
        return col.valueFormatter ? col.valueFormatter(value, row) : value;
    }

    get showSelectionColumn(): boolean {
        return this.options.showSelection !== false;
    }

    onFilterChange(col: ColumnDef<T>, value: any, valueTo?: any): void {
        var colId = String(col.field);
        var mode = this.filterModes[colId] || (col as any).filterMatchMode || 'contains';
        var next = this.filterModel.filter(function (f) {
            return f.colId !== colId;
        });

        var hasRange = valueTo !== undefined && valueTo !== null && valueTo !== '';
        var hasValue = value !== undefined && value !== null && value !== '';
        if (hasValue || hasRange) {
            var type = typeof col.filter === 'string' ? col.filter : undefined;
            next.push({ colId, type, value, valueTo, matchMode: mode as any } as any);
        }

        this.filterModel = next;
        this.recompute();
    }

    onRangeInput(col: ColumnDef<T>, part: 'min' | 'max', value: any): void {
        var colId = String(col.field);
        var current = this.filterInputs[colId] || {};
        if (part === 'min') current.value = value;
        else current.valueTo = value;
        this.filterInputs[colId] = current;
        this.onFilterChange(col, current.value, current.valueTo);
    }

    onTextFilterInput(col: ColumnDef<T>, raw: any, instant?: boolean): void {
        var colId = String(col.field);
        this.filterInputs[colId] = this.filterInputs[colId] || {};
        this.filterInputs[colId].value = raw;
        if (instant) {
            this.onFilterChange(col, raw, undefined);
            return;
        }
        // debounce per column
        clearTimeout(this.filterDebounce[colId]);
        this.filterDebounce[colId] = setTimeout(() => {
            this.onFilterChange(col, raw, undefined);
        }, 150);
    }

    onTextModeChange(col: ColumnDef<T>, mode: 'contains' | 'startsWith' | 'equals'): void {
        var colId = String(col.field);
        this.filterModes[colId] = mode;
        // Reapply current filter value with new mode
        var existing = this.filterModel.find((f) => f.colId === colId);
        var val = existing ? existing.value : '';
        this.onFilterChange(col, val, existing ? existing.valueTo : undefined);
    }

    clearFilters(): void {
        this.filterModel = [];
        this.filterInputs = {};
        this.recompute();
    }

    clearGroups(): void {
        this.groupModel = [];
        this.expandedGroups.clear();
        this.recompute();
    }

    toggleGroup(col: ColumnDef<T>): void {
        var colId = String(col.field);
        var idx = this.groupModel.findIndex((g) => g.colId === colId);
        var next = this.groupModel.slice();
        if (idx === -1) next.push({ colId });
        else next.splice(idx, 1);
        this.groupModel = next;
        if (!next.length) this.expandedGroups.clear();
        this.recompute();
    }

    isGrouped(col: ColumnDef<T>): boolean {
        return this.groupModel.some((g) => g.colId === String(col.field));
    }

    isGroupRow(row: RowView<T>): row is GroupViewRow<T> {
        return !!(row as any).__group;
    }

    isExpanded(row: GroupViewRow<T>): boolean {
        return this.expandedGroups.has(row.path);
    }

    toggleGroupExpand(row: GroupViewRow<T>): void {
        if (this.expandedGroups.has(row.path)) this.expandedGroups.delete(row.path);
        else this.expandedGroups.add(row.path);
        this.recompute();
    }

    getGroupAgg(row: GroupViewRow<T>, col: ColumnDef<T>): any {
        return row.agg[String(col.field)] ?? '';
    }

    private getLeafRows(): T[] {
        return (this.viewRows as Array<RowView<T>>).filter((r) => !this.isGroupRow(r)) as T[];
    }

    private buildAggModel(): AggModelItem[] {
        var sample = (this.rowData && this.rowData.length) ? this.rowData[0] : null;
        return this.mergedCols
            .map(function (c) {
                var agg = c.aggFunc;
                if (!agg && sample) {
                    var v = getCellValue(c, sample as any);
                    agg = typeof v === 'number' ? 'sum' : 'count';
                }
                if (!agg) agg = 'count';
                return { colId: String(c.field), aggFunc: agg };
            });
    }

    trackByRow = (_i: number, row: RowView<T>): string | number => {
        if (this.isGroupRow(row)) return 'g:' + (row as GroupViewRow<T>).path;
        // Use index to avoid duplicate keys from object stringification
        return 'r:' + _i;
    };

    trackByCol(_i: number, col: ColumnDef<T>): string {
        return String(col.field);
    }

    isValueCol(col: ColumnDef<T>): boolean {
        return this.pivotModel.valueCols.some((v) => v.colId === String(col.field));
    }

    toggleValueCol(col: ColumnDef<T>): void {
        var id = String(col.field);
        var next = this.pivotModel.valueCols.slice();
        var idx = next.findIndex((v) => v.colId === id);
        if (idx === -1) next.push({ colId: id, aggFunc: col.aggFunc || 'sum' });
        else next.splice(idx, 1);
        this.pivotModel = Object.assign({}, this.pivotModel, { valueCols: next });
        this.recompute();
    }

    onPivotToggle(enabled: any): void {
        this.pivotModel = Object.assign({}, this.pivotModel, { enabled: !!enabled });
        this.recompute();
    }

    onPivotConfigChange(val?: any): void {
        // Ensure undefined when cleared
        if (val === '' || val === null) val = undefined;
        this.pivotModel = Object.assign({}, this.pivotModel, { pivotCol: val });
        this.recompute();
    }

    getColWidth(col: ColumnDef<T>): number {
        var id = String(col.field);
        return this.colWidths[id] ?? (col.width || 160);
    }

    toggleMenu(col: ColumnDef<T>): void {
        var id = String(col.field);
        this.menuOpenFor = this.menuOpenFor === id ? null : id;
        this.cdr.markForCheck();
    }

    closeMenu(): void {
        this.menuOpenFor = null;
        this.cdr.markForCheck();
    }

    sortAsc(col: ColumnDef<T>): void {
        var id = String(col.field);
        var next = this.sortModel.filter((m) => m.colId !== id);
        next.unshift({ colId: id, sort: 'asc' });
        this.sortModel = next;
        this.recompute();
        this.closeMenu();
    }

    sortDesc(col: ColumnDef<T>): void {
        var id = String(col.field);
        var next = this.sortModel.filter((m) => m.colId !== id);
        next.unshift({ colId: id, sort: 'desc' });
        this.sortModel = next;
        this.recompute();
        this.closeMenu();
    }

    clearSort(col: ColumnDef<T>): void {
        var id = String(col.field);
        this.sortModel = this.sortModel.filter((m) => m.colId !== id);
        this.recompute();
        this.closeMenu();
    }

    clearFilterFor(col: ColumnDef<T>): void {
        var id = String(col.field);
        this.filterModel = this.filterModel.filter((f) => f.colId !== id);
        delete this.filterInputs[id];
        this.recompute();
        this.closeMenu();
    }

    onResizeStart(ev: MouseEvent, col: ColumnDef<T>): void {
        ev.stopPropagation();
        ev.preventDefault();
        var startX = ev.clientX;
        var id = String(col.field);
        var startW = this.getColWidth(col);
        var minW = col.minWidth || 60;
        var maxW = col.maxWidth || 600;
        this.zone.runOutsideAngular(() => {
            var pending = false;
            var nextWidth = startW;
            var move = (e: MouseEvent) => {
                var delta = e.clientX - startX;
                nextWidth = Math.max(minW, Math.min(maxW, startW + delta));
                if (!pending) {
                    pending = true;
                    this.resizeFrame = requestAnimationFrame(() => {
                        pending = false;
                        this.colWidths = Object.assign({}, this.colWidths, { [id]: nextWidth });
                        this.cdr.markForCheck();
                    });
                }
            };
            var up = () => {
                if (this.resizeFrame != null) {
                    cancelAnimationFrame(this.resizeFrame);
                    this.resizeFrame = null;
                }
                this.resizingCol = null;
                document.body.style.cursor = '';
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
                this.zone.run(() => this.cdr.markForCheck());
            };
            this.resizingCol = id;
            document.body.style.cursor = 'col-resize';
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up, { once: true });
            this.zone.run(() => this.cdr.markForCheck());
        });
    }

    getFilterValue(col: ColumnDef<T>, part: 'min' | 'max' = 'min'): any {
        var colId = String(col.field);
        // Range values cached separately
        if (part === 'min' || part === 'max') {
            var cached = this.filterInputs[colId];
            if (cached) return part === 'min' ? cached.value : cached.valueTo;
        }
        // For text / single-value filters, derive from model
        var hit = this.filterModel.find((f) => f.colId === colId);
        if (!hit) return '';
        return part === 'min' ? hit.value ?? '' : hit.valueTo ?? '';
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

const isArrayValid = ($array: any[], $length: number) => {
    return $array && $array.length > $length ? true : false;
}
