import { Component, ChangeDetectionStrategy, Input, HostListener, } from '@angular/core';
import { mergeColDef, sortRows, filterRows, groupAndFlattenRows, pivotRows, toCsv, getCellValue, } from 'og-grid-core';
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
import * as i2 from "@angular/forms";
export class OgGridComponent {
    constructor(cdr, zone, host) {
        this.cdr = cdr;
        this.zone = zone;
        this.host = host;
        this.columnDefs = [];
        this.rowData = [];
        this.options = {};
        this.showSelection = true; // explicit toggle for checkbox column
        this.mergedCols = [];
        this.viewRows = [];
        this.sortModel = [];
        this.filterModel = [];
        this.groupModel = [];
        this.pivotModel = { rowGroupCols: [], valueCols: [], pivotCol: undefined, enabled: false };
        this.expandedGroups = new Set();
        this.filterInputs = {};
        this.filterModes = {};
        this.filterDebounce = {};
        this.colWidths = {};
        this.menuOpenFor = null;
        this.resizeFrame = null;
        this.resizingCol = null;
        this.showPivotPanel = true;
        this.selected = new Set(); // track by row object references
        this.trackByRow = (_i, row) => {
            if (this.isGroupRow(row))
                return 'g:' + row.path;
            // Use index to avoid duplicate keys from object stringification
            return 'r:' + _i;
        };
        var self = this;
        this.api = {
            setRowData: function (data) {
                self.rowData = data || [];
                self.recompute();
            },
            setColumnDefs: function (cols) {
                self.columnDefs = cols || [];
                self.recompute();
            },
            setSortModel: function (model) {
                self.sortModel = model || [];
                self.recompute();
            },
            setFilterModel: function (model) {
                self.filterModel = model || [];
                self.recompute();
            },
            getSortModel: function () {
                return self.sortModel.slice();
            },
            getFilterModel: function () {
                return self.filterModel.slice();
            },
            setGroupModel: function (model) {
                self.groupModel = model || [];
                self.recompute();
            },
            getGroupModel: function () {
                return self.groupModel.slice();
            },
            setExpandedGroups: function (paths) {
                self.expandedGroups = new Set(paths || []);
                self.recompute();
            },
            getExpandedGroups: function () {
                return Array.from(self.expandedGroups);
            },
            setPivotModel: function (model) {
                self.pivotModel = model || { rowGroupCols: [], valueCols: [], pivotCol: undefined, enabled: false };
                self.recompute();
            },
            getPivotModel: function () {
                return Object.assign({}, self.pivotModel);
            },
            getSelectedRows: function () {
                return Array.from(self.selected);
            },
            exportCsv: function (filename) {
                var name = filename || 'og-grid-export.csv';
                var csv = toCsv(self.getLeafRows(), self.mergedCols);
                downloadTextFile(csv, name, 'text/csv;charset=utf-8;');
            },
        };
    }
    ngOnInit() {
        this.setColumns();
    }
    setColumns() {
        if (!isArrayValid(this.columnDefs, 0) && isArrayValid(this.rowData, 0)) {
            this.columnDefs = this.buildColumnDefs(this.rowData);
        }
    }
    inferType(val) {
        if (val === null || val === undefined)
            return 'text';
        if (typeof val === 'number')
            return 'number';
        const d = new Date(val);
        if (!isNaN(d.getTime()) && /[T:\-\/]/.test(String(val)))
            return 'date';
        if (!isNaN(Number(val)) && val !== '')
            return 'number';
        return 'text';
    }
    buildColumnDefs(data) {
        if (!data.length)
            return [];
        return Object.keys(data[0]).map(k => {
            var _a;
            let sample = (_a = data.find(r => r[k] != null)) === null || _a === void 0 ? void 0 : _a[k];
            const t = this.inferType(sample);
            const col = {
                field: k, headerName: this.generateHeaderFromKey(k), filter: true, sortable: true, resizable: true,
                enableRowGroup: true, enablePivot: true, enableValue: true
            };
            if (t === 'number') {
                col.aggFunc = 'sum';
            }
            if (t === 'date') {
                col.filter = 'agDateColumnFilter';
            }
            return col;
        });
    }
    generateHeaderFromKey(key) {
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
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    onDocClick(ev) {
        if (!this.menuOpenFor)
            return;
        if (this.host && this.host.nativeElement.contains(ev.target)) {
            // clicks inside component: ignore unless on menu toggle handled elsewhere
            return;
        }
        this.menuOpenFor = null;
        this.cdr.markForCheck();
    }
    ngOnChanges(changes) {
        this.setColumns();
        if (changes.columnDefs ||
            changes.rowData ||
            changes.options) {
            this.recompute();
        }
    }
    recompute() {
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
        }
        else if (this.groupModel.length) {
            var aggModel = this.buildAggModel();
            var grouped = groupAndFlattenRows(sorted, this.mergedCols, this.groupModel, aggModel, this.expandedGroups);
            // Ensure new groups are expanded by default
            grouped.paths.forEach((p) => this.expandedGroups.add(p));
            this.viewRows = grouped.flat;
        }
        else {
            this.viewRows = sorted;
            this.expandedGroups.clear();
        }
        // Reset selection if it would become invalid
        var next = new Set();
        var leaves = this.getLeafRows();
        this.selected.forEach((row) => {
            if (leaves.indexOf(row) >= 0)
                next.add(row);
        });
        this.selected = next;
    }
    // ---- UI actions ----
    onHeaderClick(col, ev) {
        if (!col.sortable)
            return;
        // If menu is open for this column, don't toggle sort
        if (this.menuOpenFor === String(col.field))
            return;
        var colId = String(col.field);
        var multi = !!(this.options && this.options.multiSort) || !!(ev && ev.shiftKey);
        var next = multi ? this.sortModel.slice() : [];
        var idx = next.findIndex(function (m) {
            return m.colId === colId;
        });
        if (idx === -1) {
            next.push({ colId: colId, sort: 'asc' });
        }
        else {
            var current = next[idx];
            if (current.sort === 'asc')
                next[idx] = { colId: colId, sort: 'desc' };
            else
                next.splice(idx, 1); // remove -> unsorted
        }
        this.recompute();
    }
    getSortIndicator(col) {
        if (!this.sortModel.length)
            return '';
        var idx = this.sortModel.findIndex((m) => m.colId === String(col.field));
        if (idx === -1)
            return '';
        var mark = this.sortModel[idx].sort === 'asc' ? '▲' : '▼';
        return this.sortModel.length > 1 ? mark + ' ' + (idx + 1) : mark;
    }
    isRowSelected(row) {
        if (this.isGroupRow(row))
            return false;
        return this.selected.has(row);
    }
    toggleRowSelection(row, ev) {
        if (!this.showSelectionColumn)
            return;
        if (this.isGroupRow(row))
            return;
        var mode = (this.options && this.options.rowSelection) || 'single';
        if (mode === 'single') {
            this.selected.clear();
            this.selected.add(row);
            return;
        }
        // multiple
        if (this.selected.has(row))
            this.selected.delete(row);
        else
            this.selected.add(row);
    }
    toggleAll() {
        if (!this.showSelectionColumn)
            return;
        var leaves = this.getLeafRows();
        if (leaves.length === 0)
            return;
        if (this.selected.size === leaves.length) {
            this.selected.clear();
            return;
        }
        this.selected.clear();
        leaves.forEach((r) => this.selected.add(r));
    }
    get allSelected() {
        if (!this.showSelectionColumn)
            return false;
        var leaves = this.getLeafRows();
        return leaves.length > 0 && this.selected.size === leaves.length;
    }
    renderCell(col, row) {
        var value = getCellValue(col, row);
        return col.valueFormatter ? col.valueFormatter(value, row) : value;
    }
    get showSelectionColumn() {
        return this.options.showSelection !== false;
    }
    onFilterChange(col, value, valueTo) {
        var colId = String(col.field);
        var mode = this.filterModes[colId] || col.filterMatchMode || 'contains';
        var next = this.filterModel.filter(function (f) {
            return f.colId !== colId;
        });
        var hasRange = valueTo !== undefined && valueTo !== null && valueTo !== '';
        var hasValue = value !== undefined && value !== null && value !== '';
        if (hasValue || hasRange) {
            var type = typeof col.filter === 'string' ? col.filter : undefined;
            next.push({ colId, type, value, valueTo, matchMode: mode });
        }
        this.filterModel = next;
        this.recompute();
    }
    onRangeInput(col, part, value) {
        var colId = String(col.field);
        var current = this.filterInputs[colId] || {};
        if (part === 'min')
            current.value = value;
        else
            current.valueTo = value;
        this.filterInputs[colId] = current;
        this.onFilterChange(col, current.value, current.valueTo);
    }
    onTextFilterInput(col, raw, instant) {
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
    onTextModeChange(col, mode) {
        var colId = String(col.field);
        this.filterModes[colId] = mode;
        // Reapply current filter value with new mode
        var existing = this.filterModel.find((f) => f.colId === colId);
        var val = existing ? existing.value : '';
        this.onFilterChange(col, val, existing ? existing.valueTo : undefined);
    }
    clearFilters() {
        this.filterModel = [];
        this.filterInputs = {};
        this.filterModes = {};
        this.recompute();
        this.cdr.markForCheck();
    }
    clearGroups() {
        this.groupModel = [];
        this.expandedGroups.clear();
        this.recompute();
    }
    toggleGroup(col) {
        var colId = String(col.field);
        var idx = this.groupModel.findIndex((g) => g.colId === colId);
        var next = this.groupModel.slice();
        if (idx === -1)
            next.push({ colId });
        else
            next.splice(idx, 1);
        this.groupModel = next;
        if (!next.length)
            this.expandedGroups.clear();
        this.recompute();
    }
    isGrouped(col) {
        return this.groupModel.some((g) => g.colId === String(col.field));
    }
    isGroupRow(row) {
        return !!row.__group;
    }
    isExpanded(row) {
        return this.expandedGroups.has(row.path);
    }
    toggleGroupExpand(row) {
        if (this.expandedGroups.has(row.path))
            this.expandedGroups.delete(row.path);
        else
            this.expandedGroups.add(row.path);
        this.recompute();
    }
    getGroupAgg(row, col) {
        var _a;
        return (_a = row.agg[String(col.field)]) !== null && _a !== void 0 ? _a : '';
    }
    getLeafRows() {
        return this.viewRows.filter((r) => !this.isGroupRow(r));
    }
    buildAggModel() {
        var sample = (this.rowData && this.rowData.length) ? this.rowData[0] : null;
        return this.mergedCols
            .map(function (c) {
            var agg = c.aggFunc;
            if (!agg && sample) {
                var v = getCellValue(c, sample);
                agg = typeof v === 'number' ? 'sum' : 'count';
            }
            if (!agg)
                agg = 'count';
            return { colId: String(c.field), aggFunc: agg };
        });
    }
    trackByCol(_i, col) {
        return String(col.field);
    }
    isValueCol(col) {
        return this.pivotModel.valueCols.some((v) => v.colId === String(col.field));
    }
    toggleValueCol(col) {
        var id = String(col.field);
        var next = this.pivotModel.valueCols.slice();
        var idx = next.findIndex((v) => v.colId === id);
        if (idx === -1)
            next.push({ colId: id, aggFunc: col.aggFunc || 'sum' });
        else
            next.splice(idx, 1);
        this.pivotModel = Object.assign({}, this.pivotModel, { valueCols: next });
        this.recompute();
    }
    onPivotToggle(enabled) {
        this.pivotModel = Object.assign({}, this.pivotModel, { enabled: !!enabled });
        this.recompute();
    }
    onPivotConfigChange(val) {
        // Ensure undefined when cleared
        if (val === '' || val === null)
            val = undefined;
        this.pivotModel = Object.assign({}, this.pivotModel, { pivotCol: val });
        this.recompute();
    }
    getColWidth(col) {
        var _a;
        var id = String(col.field);
        return (_a = this.colWidths[id]) !== null && _a !== void 0 ? _a : (col.width || 160);
    }
    toggleMenu(col) {
        var id = String(col.field);
        this.menuOpenFor = this.menuOpenFor === id ? null : id;
        this.cdr.markForCheck();
    }
    closeMenu() {
        this.menuOpenFor = null;
        this.cdr.markForCheck();
    }
    sortAsc(col) {
        var id = String(col.field);
        var next = this.sortModel.filter((m) => m.colId !== id);
        next.unshift({ colId: id, sort: 'asc' });
        this.sortModel = next;
        this.recompute();
        this.closeMenu();
    }
    sortDesc(col) {
        var id = String(col.field);
        var next = this.sortModel.filter((m) => m.colId !== id);
        next.unshift({ colId: id, sort: 'desc' });
        this.sortModel = next;
        this.recompute();
        this.closeMenu();
    }
    clearSort(col) {
        var id = String(col.field);
        this.sortModel = this.sortModel.filter((m) => m.colId !== id);
        this.recompute();
        this.closeMenu();
    }
    clearFilterFor(col) {
        var id = String(col.field);
        this.filterModel = this.filterModel.filter((f) => f.colId !== id);
        delete this.filterInputs[id];
        this.recompute();
        this.closeMenu();
    }
    onResizeStart(ev, col) {
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
            var move = (e) => {
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
    getFilterValue(col, part = 'min') {
        var _a, _b;
        var colId = String(col.field);
        // Range values cached separately
        if (part === 'min' || part === 'max') {
            var cached = this.filterInputs[colId];
            if (cached)
                return part === 'min' ? cached.value : cached.valueTo;
        }
        // For text / single-value filters, derive from model
        var hit = this.filterModel.find((f) => f.colId === colId);
        if (!hit)
            return '';
        return part === 'min' ? (_a = hit.value) !== null && _a !== void 0 ? _a : '' : (_b = hit.valueTo) !== null && _b !== void 0 ? _b : '';
    }
}
OgGridComponent.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0, type: OgGridComponent, deps: [{ token: i0.ChangeDetectorRef }, { token: i0.NgZone }, { token: i0.ElementRef }], target: i0.ɵɵFactoryTarget.Component });
OgGridComponent.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "12.0.0", version: "12.2.17", type: OgGridComponent, selector: "og-grid", inputs: { columnDefs: "columnDefs", rowData: "rowData", options: "options", showSelection: "showSelection" }, host: { listeners: { "document:click": "onDocClick($event)" } }, usesOnChanges: true, ngImport: i0, template: "<div class=\"og-grid-root\">\n    <div class=\"og-grid-groupbar\" *ngIf=\"mergedCols.length\">\n        <div class=\"og-grid-actions\">\n            <button type=\"button\" class=\"og-grid-btn og-grid-pivot-btn\" (click)=\"showPivotPanel = !showPivotPanel\">\n                {{ showPivotPanel ? 'Hide Pivot' : 'Show Pivot' }}\n            </button>\n        </div>\n        <div class=\"og-grid-group-label\">Group by:</div>\n        <div class=\"og-grid-group-pills\">\n            <label class=\"og-grid-pill\" *ngFor=\"let col of mergedCols\">\n                <input type=\"checkbox\" [checked]=\"isGrouped(col)\" (change)=\"toggleGroup(col)\" />\n                <span>{{ col.headerName || (col.field + '') }}</span>\n            </label>\n            <button type=\"button\" class=\"og-grid-btn\" (click)=\"clearGroups()\">Clear</button>\n        </div>\n    </div>\n\n    <div class=\"og-grid-header\">\n        <div class=\"og-grid-header-cell og-grid-select\" *ngIf=\"showSelectionColumn && showSelection \">\n            <input type=\"checkbox\" [checked]=\"allSelected\" (change)=\"toggleAll()\" />\n        </div>\n\n        <div class=\"og-grid-header-cell\" *ngFor=\"let col of mergedCols; let ci = index; trackBy: trackByCol\"\n            [style.width.px]=\"getColWidth(col)\" (click)=\"onHeaderClick(col, $event)\"\n            [class.og-grid-sortable]=\"!!col.sortable\" title=\"Click to sort\">\n            <span class=\"og-grid-header-title\">\n                {{ col.headerName || (col.field + '') }}\n            </span>\n            <span class=\"og-grid-sort-ind\">{{ getSortIndicator(col) }}</span>\n            <span class=\"og-grid-header-menu\" (click)=\"toggleMenu(col); $event.stopPropagation()\">\n                \u22EE\n            </span>\n            <div class=\"og-grid-menu\" *ngIf=\"menuOpenFor === (col.field + '')\" (click)=\"$event.stopPropagation()\">\n                <button type=\"button\" (click)=\"sortAsc(col)\">Sort Ascending</button>\n                <button type=\"button\" (click)=\"sortDesc(col)\">Sort Descending</button>\n                <button type=\"button\" (click)=\"clearSort(col)\">Clear Sort</button>\n                <hr />\n                <button type=\"button\" (click)=\"clearFilterFor(col)\">Clear Filter</button>\n                <button type=\"button\" (click)=\"clearFilters()\">Clear All Filters</button>\n            </div>\n            <span class=\"og-grid-resizer\" (mousedown)=\"onResizeStart($event, col)\"></span>\n        </div>\n    </div>\n\n    <div class=\"og-grid-pivot-panel\" *ngIf=\"showPivotPanel\">\n        <div class=\"og-grid-pivot-toggle\">\n            <label><input type=\"checkbox\" [(ngModel)]=\"pivotModel.enabled\" (ngModelChange)=\"onPivotToggle($event)\" />\n                Pivot Mode</label>\n        </div>\n        <div class=\"og-grid-pivot-section\">\n            <div class=\"og-grid-pivot-title\">Pivot Column</div>\n            <select [(ngModel)]=\"pivotModel.pivotCol\" (ngModelChange)=\"onPivotConfigChange($event)\">\n                <option [ngValue]=\"undefined\">None</option>\n                <option *ngFor=\"let col of columnDefs\" [ngValue]=\"col.field\">{{ col.headerName || (col.field + '') }}\n                </option>\n            </select>\n        </div>\n        <div class=\"og-grid-pivot-section\">\n            <div class=\"og-grid-pivot-title\">Row Groups</div>\n            <div class=\"og-grid-pivot-list\">\n                <label *ngFor=\"let col of columnDefs\">\n                    <input type=\"checkbox\" [checked]=\"isGrouped(col)\" (change)=\"toggleGroup(col)\" />\n                    {{ col.headerName || (col.field + '') }}\n                </label>\n            </div>\n        </div>\n        <div class=\"og-grid-pivot-section\">\n            <div class=\"og-grid-pivot-title\">Values</div>\n            <div class=\"og-grid-pivot-list\">\n                <label *ngFor=\"let col of columnDefs\">\n                    <input type=\"checkbox\" [checked]=\"isValueCol(col)\" (change)=\"toggleValueCol(col)\" />\n                    {{ col.headerName || (col.field + '') }}\n                </label>\n            </div>\n        </div>\n    </div>\n\n    <div class=\"og-grid-filter\" *ngIf=\"mergedCols.length\">\n        <div class=\"og-grid-filter-cell og-grid-select\" *ngIf=\"showSelectionColumn\">\n            <button type=\"button\" class=\"og-grid-btn\" (click)=\"clearFilters()\">Clear</button>\n        </div>\n\n        <div class=\"og-grid-filter-cell\" *ngFor=\"let col of mergedCols; trackBy: trackByCol\"\n            [style.width.px]=\"getColWidth(col)\">\n            <ng-container [ngSwitch]=\"col.filter || 'text'\">\n                <ng-container *ngSwitchCase=\"'text'\">\n                    <input type=\"text\" placeholder=\"Filter...\" [ngModel]=\"filterInputs[col.field]?.value || ''\"\n                        (ngModelChange)=\"onTextFilterInput(col, $event, true)\" />\n                    <div class=\"og-grid-filter-mode-row\">\n                        <select (change)=\"onTextModeChange(col, $any($event.target).value)\">\n                            <option value=\"contains\">Contains</option>\n                            <option value=\"startsWith\">Starts with</option>\n                            <option value=\"equals\">Equals</option>\n                        </select>\n                    </div>\n                </ng-container>\n\n                <div *ngSwitchCase=\"'number'\" class=\"og-grid-filter-range\">\n                    <input type=\"number\" placeholder=\"Min\" [ngModel]=\"filterInputs[col.field]?.value || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'min', $event)\" />\n                    <input type=\"number\" data-max placeholder=\"Max\" [ngModel]=\"filterInputs[col.field]?.valueTo || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'max', $event)\" />\n                </div>\n\n                <div *ngSwitchCase=\"'date'\" class=\"og-grid-filter-range\">\n                    <input type=\"date\" placeholder=\"From\" [ngModel]=\"filterInputs[col.field]?.value || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'min', $event)\" />\n                    <input type=\"date\" data-max placeholder=\"To\" [ngModel]=\"filterInputs[col.field]?.valueTo || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'max', $event)\" />\n                </div>\n\n                <input *ngSwitchDefault type=\"text\" placeholder=\"Filter...\"\n                    [ngModel]=\"filterInputs[col.field]?.value || ''\" (ngModelChange)=\"onFilterChange(col, $event)\" />\n            </ng-container>\n        </div>\n    </div>\n\n    <div class=\"og-grid-body\">\n        <div class=\"og-grid-row\" *ngFor=\"let row of viewRows; let ri = index; trackBy: trackByRow\"\n            [class.og-grid-row-selected]=\"isRowSelected(row)\" [class.og-grid-group-row]=\"isGroupRow(row)\">\n            <div class=\"og-grid-cell og-grid-select\" *ngIf=\"showSelectionColumn\">\n                <ng-container *ngIf=\"!isGroupRow(row); else groupToggle\">\n                    <input *ngIf=\"showSelection\" type=\"checkbox\" [checked]=\"isRowSelected(row)\"\n                        (change)=\"toggleRowSelection(row)\" />\n                </ng-container>\n                <ng-template #groupToggle>\n                    <button type=\"button\" class=\"og-grid-toggle\" (click)=\"toggleGroupExpand($any(row))\">\n                        {{ isExpanded($any(row)) ? '\u25BE' : '\u25B8' }}\n                    </button>\n                </ng-template>\n            </div>\n\n            <div class=\"og-grid-cell\" *ngFor=\"let col of mergedCols; let ci = index\"\n                [style.width.px]=\"getColWidth(col)\">\n                <ng-container *ngIf=\"!isGroupRow(row); else groupCell\">\n                    {{ renderCell(col, $any(row)) }}\n                </ng-container>\n                <ng-template #groupCell>\n                    <ng-container *ngIf=\"ci === 0; else aggCell\">\n                        <span class=\"og-grid-indent\" [style.paddingLeft.px]=\"($any(row).level * 14)\"></span>\n                        <strong>{{ $any(row).key ?? '(blank)' }}</strong>\n                        <span class=\"og-grid-count\">({{ $any(row).count }})</span>\n                    </ng-container>\n                    <ng-template #aggCell>\n                        {{ getGroupAgg($any(row), col) }}\n                    </ng-template>\n                </ng-template>\n            </div>\n        </div>\n    </div>\n</div>", styles: [".og-grid-root{border:1px solid #ddd;font-family:Arial,Helvetica,sans-serif;font-size:13px;position:relative;padding-right:12px;overflow:auto}.og-grid-root.resizing,.og-grid-root.resizing *{cursor:col-resize!important;-webkit-user-select:none!important;user-select:none!important}.og-grid-header,.og-grid-filter,.og-grid-groupbar,.og-grid-row{display:flex;align-items:center;min-width:max-content}.og-grid-header{position:relative;-webkit-user-select:none;user-select:none;border-bottom:1px solid #ddd;background:#f7f7f7;font-weight:600;overflow:visible}.og-grid-filter{border-bottom:1px solid #eee;background:#fbfbfb;align-items:flex-start}.og-grid-groupbar{padding:6px 8px;border-bottom:1px solid #eee;background:#fdfdfd;grid-gap:8px;gap:8px;justify-content:flex-start;align-items:center}.og-grid-group-label{font-weight:600;margin-right:6px;white-space:nowrap}.og-grid-group-pills{display:flex;flex-wrap:wrap;grid-gap:6px;gap:6px}.og-grid-actions{display:flex;grid-gap:6px;gap:6px;align-items:center}.og-grid-pill{display:inline-flex;align-items:center;grid-gap:4px;gap:4px;padding:2px 6px;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:12px;cursor:pointer}.og-grid-pill input{margin:0}.og-grid-header-cell,.og-grid-filter-cell,.og-grid-cell{position:relative;flex:0 0 auto;padding:6px 8px;border-right:1px solid #eee;white-space:nowrap;overflow:visible;text-overflow:ellipsis;box-sizing:border-box;display:flex;justify-content:space-between}.og-grid-header-cell:last-child,.og-grid-filter-cell:last-child,.og-grid-cell:last-child{border-right:none}.og-grid-sortable{cursor:pointer}.og-grid-sort-ind{margin-left:6px;font-size:11px}.og-grid-header-title{display:inline-block;max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis;vertical-align:middle}.og-grid-header-menu{margin-left:6px;cursor:pointer;position:relative;-webkit-user-select:none;user-select:none}.og-grid-menu{position:absolute;top:calc(100% + 4px);right:0;left:auto;background:#fff;border:1px solid #ddd;box-shadow:0 4px 10px #0000001f;min-width:180px;max-width:220px;display:flex;flex-direction:column;z-index:50;padding:6px 0}.og-grid-menu button{width:100%;padding:6px 10px;text-align:left;background:none;border:none;cursor:pointer;white-space:nowrap}.og-grid-menu button:hover{background:#f5f5f5}.og-grid-menu hr{margin:4px 0;border:none;border-top:1px solid #eee}.og-grid-resizer{position:absolute;top:0;right:0;width:8px;cursor:col-resize;-webkit-user-select:none;user-select:none;height:100%;background:transparent}.og-grid-resizer:hover{background:rgba(0,0,0,.06)}.og-grid-header-cell,.og-grid-filter-cell,.og-grid-cell{box-sizing:border-box}.og-grid-filter-cell{display:flex;flex-direction:column;grid-gap:4px;gap:4px}.og-grid-filter .og-grid-select{flex:0 0 36px;width:36px;padding:6px;align-items:center}.og-grid-filter .og-grid-select .og-grid-btn{width:auto;padding:4px 6px}.og-grid-filter-cell input,.og-grid-filter-cell select{width:100%;box-sizing:border-box;padding:4px 6px;font-size:12px}.og-grid-filter-mode-row{margin-top:4px}.og-grid-filter-mode-row select{width:100%;padding:4px 6px;font-size:12px}.og-grid-filter-range{display:flex;grid-gap:4px;gap:4px}.og-grid-filter-range input{width:100%}.og-grid-btn{padding:4px 8px;font-size:12px;border:1px solid #ccc;background:#fff;cursor:pointer;box-sizing:border-box}.og-grid-btn:hover{background:#f1f1f1}.og-grid-pivot-btn{border-color:#0f62fe;color:#0f62fe}.og-grid-pivot-btn:hover{background:#e8f0ff}.og-grid-toggle{border:1px solid #ccc;background:#fff;padding:2px 4px;cursor:pointer;font-size:12px}.og-grid-toggle:hover{background:#f5f5f5}.og-grid-body{max-height:420px;overflow:auto;min-width:max-content}.og-grid-row{border-bottom:1px solid #f1f1f1}.og-grid-group-row{background:#f6f8fb;font-weight:600}.og-grid-row:hover{background:#fafafa}.og-grid-row-selected{background:#e9f2ff}.og-grid-indent{display:inline-block;width:0}.og-grid-count{margin-left:6px;color:#666;font-weight:400}.og-grid-select{width:36px;flex:0 0 36px;display:flex;justify-content:center}.og-grid-pivot-panel{position:fixed;top:72px;right:12px;width:260px;max-height:90vh;background:#fff;border:1px solid #e2e2e2;box-shadow:0 8px 24px #0000001f;border-radius:8px;padding:10px 12px;overflow:auto;z-index:90}.og-grid-pivot-toggle{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:600}.og-grid-pivot-section{margin-bottom:12px}.og-grid-pivot-title{font-weight:600;margin-bottom:6px;color:#333}.og-grid-pivot-list{display:grid;grid-template-columns:1fr;grid-gap:6px;gap:6px}.og-grid-pivot-list label{display:flex;align-items:center;grid-gap:6px;gap:6px;padding:4px 6px;border:1px solid #eee;border-radius:4px;background:#fafafa}\n"], directives: [{ type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { type: i2.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { type: i2.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { type: i2.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { type: i2.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { type: i2.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { type: i1.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { type: i1.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { type: i2.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { type: i1.NgSwitchDefault, selector: "[ngSwitchDefault]" }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0, type: OgGridComponent, decorators: [{
            type: Component,
            args: [{
                    selector: 'og-grid',
                    templateUrl: './og-grid.component.html',
                    styleUrls: ['./og-grid.component.scss'],
                    changeDetection: ChangeDetectionStrategy.OnPush,
                }]
        }], ctorParameters: function () { return [{ type: i0.ChangeDetectorRef }, { type: i0.NgZone }, { type: i0.ElementRef }]; }, propDecorators: { columnDefs: [{
                type: Input
            }], rowData: [{
                type: Input
            }], options: [{
                type: Input
            }], showSelection: [{
                type: Input
            }], onDocClick: [{
                type: HostListener,
                args: ['document:click', ['$event']]
            }] } });
function downloadTextFile(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        (window.URL || window.webkitURL).revokeObjectURL(url);
    }, 0);
}
const isArrayValid = ($array, $length) => {
    return $array && $array.length > $length ? true : false;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2ctZ3JpZC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9vZy1ncmlkLWFuZ3VsYXIvc3JjL2xpYi9vZy1ncmlkLmNvbXBvbmVudC50cyIsIi4uLy4uLy4uLy4uL3Byb2plY3RzL29nLWdyaWQtYW5ndWxhci9zcmMvbGliL29nLWdyaWQuY29tcG9uZW50Lmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNILFNBQVMsRUFDVCx1QkFBdUIsRUFDdkIsS0FBSyxFQUtMLFlBQVksR0FHZixNQUFNLGVBQWUsQ0FBQztBQUV2QixPQUFPLEVBV0gsV0FBVyxFQUNYLFFBQVEsRUFDUixVQUFVLEVBQ1YsbUJBQW1CLEVBQ25CLFNBQVMsRUFDVCxLQUFLLEVBQ0wsWUFBWSxHQUNmLE1BQU0sY0FBYyxDQUFDOzs7O0FBU3RCLE1BQU0sT0FBTyxlQUFlO0lBNEJ4QixZQUFvQixHQUFzQixFQUFVLElBQVksRUFBVSxJQUE2QjtRQUFuRixRQUFHLEdBQUgsR0FBRyxDQUFtQjtRQUFVLFNBQUksR0FBSixJQUFJLENBQVE7UUFBVSxTQUFJLEdBQUosSUFBSSxDQUF5QjtRQTNCOUYsZUFBVSxHQUFtQixFQUFFLENBQUM7UUFDaEMsWUFBTyxHQUFRLEVBQUUsQ0FBQztRQUNsQixZQUFPLEdBQTRCLEVBQUUsQ0FBQztRQUN0QyxrQkFBYSxHQUFZLElBQUksQ0FBQyxDQUFDLHNDQUFzQztRQUs5RSxlQUFVLEdBQW1CLEVBQUUsQ0FBQztRQUNoQyxhQUFRLEdBQWlCLEVBQUUsQ0FBQztRQUU1QixjQUFTLEdBQW9CLEVBQUUsQ0FBQztRQUNoQyxnQkFBVyxHQUFzQixFQUFFLENBQUM7UUFDcEMsZUFBVSxHQUFxQixFQUFFLENBQUM7UUFDbEMsZUFBVSxHQUFlLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLEtB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Q0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3ZELElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDNUIsQ0FBQztJQUVELFNBQVM7UUFDTCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFRCxPQUFPLENBQUMsR0FBaUI7UUFDckIsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDakIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ3JCLENBQUM7SUFFRCxRQUFRLENBQUMsR0FBaUI7UUFDdEIsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsU0FB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QUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFLLE1BQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFMUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNwQyxDQUFDLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztJQUNiLENBQUMsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQ3RCLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztJQUN6QixRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7SUFFVixVQUFVLENBQUM7UUFDUCxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QixDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUssTUFBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNuRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDVixDQUFDO0FBRUQsTUFBTSxZQUFZLEdBQUcsQ0FBQyxNQUFhLEVBQUUsT0FBZSxFQUFFLEVBQUU7SUFDcEQsT0FBTyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzVELENBQUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gICAgQ29tcG9uZW50LFxuICAgIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICAgIElucHV0LFxuICAgIE9uQ2hhbmdlcyxcbiAgICBTaW1wbGVDaGFuZ2VzLFxuICAgIENoYW5nZURldGVjdG9yUmVmLFxuICAgIE5nWm9uZSxcbiAgICBIb3N0TGlzdGVuZXIsXG4gICAgRWxlbWVudFJlZixcbiAgICBPbkluaXQsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5pbXBvcnQge1xuICAgIENvbHVtbkRlZixcbiAgICBHcmlkT3B0aW9ucyxcbiAgICBHcmlkQXBpLFxuICAgIFNvcnRNb2RlbEl0ZW0sXG4gICAgRmlsdGVyTW9kZWxJdGVtLFxuICAgIEdyb3VwTW9kZWxJdGVtLFxuICAgIFBpdm90TW9kZWwsXG4gICAgQWdnTW9kZWxJdGVtLFxuICAgIEdyb3VwVmlld1JvdyxcbiAgICBSb3dWaWV3LFxuICAgIG1lcmdlQ29sRGVmLFxuICAgIHNvcnRSb3dzLFxuICAgIGZpbHRlclJvd3MsXG4gICAgZ3JvdXBBbmRGbGF0dGVuUm93cyxcbiAgICBwaXZvdFJvd3MsXG4gICAgdG9Dc3YsXG4gICAgZ2V0Q2VsbFZhbHVlLFxufSBmcm9tICdvZy1ncmlkLWNvcmUnO1xuXG5cbkBDb21wb25lbnQoe1xuICAgIHNlbGVjdG9yOiAnb2ctZ3JpZCcsXG4gICAgdGVtcGxhdGVVcmw6ICcuL29nLWdyaWQuY29tcG9uZW50Lmh0bWwnLFxuICAgIHN0eWxlVXJsczogWycuL29nLWdyaWQuY29tcG9uZW50LnNjc3MnXSxcbiAgICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaCxcbn0pXG5leHBvcnQgY2xhc3MgT2dHcmlkQ29tcG9uZW50PFQgPSBhbnk+IGltcGxlbWVudHMgT25Jbml0LCBPbkNoYW5nZXMge1xuICAgIEBJbnB1dCgpIGNvbHVtbkRlZnM6IENvbHVtbkRlZjxUPltdID0gW107XG4gICAgQElucHV0KCkgcm93RGF0YTogVFtdID0gW107XG4gICAgQElucHV0KCkgb3B0aW9uczogUGFydGlhbDxHcmlkT3B0aW9uczxUPj4gPSB7fTtcbiAgICBASW5wdXQoKSBzaG93U2VsZWN0aW9uOiBib29sZWFuID0gdHJ1ZTsgLy8gZXhwbGljaXQgdG9nZ2xlIGZvciBjaGVja2JveCBjb2x1bW5cblxuICAgIC8vIE9wdGlvbmFsOiBleHBvc2UgQVBJIHRvIHBhcmVudCB2aWEgdGVtcGxhdGUgcmVmOiAjZ3JpZCB0aGVuIGdyaWQuYXBpLmV4cG9ydENzdigpXG4gICAgYXBpOiBHcmlkQXBpPFQ+O1xuXG4gICAgbWVyZ2VkQ29sczogQ29sdW1uRGVmPFQ+W10gPSBbXTtcbiAgICB2aWV3Um93czogUm93VmlldzxUPltdID0gW107XG5cbiAgICBzb3J0TW9kZWw6IFNvcnRNb2RlbEl0ZW1bXSA9IFtdO1xuICAgIGZpbHRlck1vZGVsOiBGaWx0ZXJNb2RlbEl0ZW1bXSA9IFtdO1xuICAgIGdyb3VwTW9kZWw6IEdyb3VwTW9kZWxJdGVtW10gPSBbXTtcbiAgICBwaXZvdE1vZGVsOiBQaXZvdE1vZGVsID0geyByb3dHcm91cENvbHM6IFtdLCB2YWx1ZUNvbHM6IFtdLCBwaXZvdENvbDogdW5kZWZpbmVkLCBlbmFibGVkOiBmYWxzZSB9O1xuICAgIGV4cGFuZGVkR3JvdXBzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZmlsdGVySW5wdXRzOiBSZWNvcmQ8c3RyaW5nLCB7IHZhbHVlPzogYW55OyB2YWx1ZVRvPzogYW55IH0+ID0ge307XG4gICAgcHJpdmF0ZSBmaWx0ZXJNb2RlczogUmVjb3JkPHN0cmluZywgJ2NvbnRhaW5zJyB8ICdzdGFydHNXaXRoJyB8ICdlcXVhbHMnPiA9IHt9O1xuICAgIHByaXZhdGUgZmlsdGVyRGVib3VuY2U6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICBwcml2YXRlIGNvbFdpZHRoczogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuICAgIG1lbnVPcGVuRm9yOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIHJlc2l6ZUZyYW1lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIHJlc2l6aW5nQ29sOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBzaG93UGl2b3RQYW5lbCA9IHRydWU7XG5cbiAgICBwcml2YXRlIHNlbGVjdGVkID0gbmV3IFNldDxUPigpOyAvLyB0cmFjayBieSByb3cgb2JqZWN0IHJlZmVyZW5jZXNcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgY2RyOiBDaGFuZ2VEZXRlY3RvclJlZiwgcHJpdmF0ZSB6b25lOiBOZ1pvbmUsIHByaXZhdGUgaG9zdDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD4pIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMuYXBpID0ge1xuICAgICAgICAgICAgc2V0Um93RGF0YTogZnVuY3Rpb24gKGRhdGE6IFRbXSkge1xuICAgICAgICAgICAgICAgIHNlbGYucm93RGF0YSA9IGRhdGEgfHwgW107XG4gICAgICAgICAgICAgICAgc2VsZi5yZWNvbXB1dGUoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXRDb2x1bW5EZWZzOiBmdW5jdGlvbiAoY29sczogQ29sdW1uRGVmPFQ+W10pIHtcbiAgICAgICAgICAgICAgICBzZWxmLmNvbHVtbkRlZnMgPSBjb2xzIHx8IFtdO1xuICAgICAgICAgICAgICAgIHNlbGYucmVjb21wdXRlKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0U29ydE1vZGVsOiBmdW5jdGlvbiAobW9kZWw6IFNvcnRNb2RlbEl0ZW1bXSkge1xuICAgICAgICAgICAgICAgIHNlbGYuc29ydE1vZGVsID0gbW9kZWwgfHwgW107XG4gICAgICAgICAgICAgICAgc2VsZi5yZWNvbXB1dGUoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXRGaWx0ZXJNb2RlbDogZnVuY3Rpb24gKG1vZGVsOiBGaWx0ZXJNb2RlbEl0ZW1bXSkge1xuICAgICAgICAgICAgICAgIHNlbGYuZmlsdGVyTW9kZWwgPSBtb2RlbCB8fCBbXTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlY29tcHV0ZSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldFNvcnRNb2RlbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnNvcnRNb2RlbC5zbGljZSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldEZpbHRlck1vZGVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuZmlsdGVyTW9kZWwuc2xpY2UoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXRHcm91cE1vZGVsOiBmdW5jdGlvbiAobW9kZWw6IEdyb3VwTW9kZWxJdGVtW10pIHtcbiAgICAgICAgICAgICAgICBzZWxmLmdyb3VwTW9kZWwgPSBtb2RlbCB8fCBbXTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlY29tcHV0ZSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldEdyb3VwTW9kZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5ncm91cE1vZGVsLnNsaWNlKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0RXhwYW5kZWRHcm91cHM6IGZ1bmN0aW9uIChwYXRoczogc3RyaW5nW10pIHtcbiAgICAgICAgICAgICAgICBzZWxmLmV4cGFuZGVkR3JvdXBzID0gbmV3IFNldChwYXRocyB8fCBbXSk7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWNvbXB1dGUoKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXRFeHBhbmRlZEdyb3VwczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBcnJheS5mcm9tKHNlbGYuZXhwYW5kZWRHcm91cHMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldFBpdm90TW9kZWw6IGZ1bmN0aW9uIChtb2RlbDogUGl2b3RNb2RlbCkge1xuICAgICAgICAgICAgICAgIHNlbGYucGl2b3RNb2RlbCA9IG1vZGVsIHx8IHsgcm93R3JvdXBDb2xzOiBbXSwgdmFsdWVDb2xzOiBbXSwgcGl2b3RDb2w6IHVuZGVmaW5lZCwgZW5hYmxlZDogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlY29tcHV0ZSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldFBpdm90TW9kZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgc2VsZi5waXZvdE1vZGVsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXRTZWxlY3RlZFJvd3M6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShzZWxmLnNlbGVjdGVkKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBleHBvcnRDc3Y6IGZ1bmN0aW9uIChmaWxlbmFtZT86IHN0cmluZykge1xuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gZmlsZW5hbWUgfHwgJ29nLWdyaWQtZXhwb3J0LmNzdic7XG4gICAgICAgICAgICAgICAgdmFyIGNzdiA9IHRvQ3N2KHNlbGYuZ2V0TGVhZlJvd3MoKSwgc2VsZi5tZXJnZWRDb2xzKTtcbiAgICAgICAgICAgICAgICBkb3dubG9hZFRleHRGaWxlKGNzdiwgbmFtZSwgJ3RleHQvY3N2O2NoYXJzZXQ9dXRmLTg7Jyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIG5nT25Jbml0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldENvbHVtbnMoKTtcbiAgICB9XG5cbiAgICBzZXRDb2x1bW5zKCkge1xuICAgICAgICBpZiAoIWlzQXJyYXlWYWxpZCh0aGlzLmNvbHVtbkRlZnMsIDApICYmIGlzQXJyYXlWYWxpZCh0aGlzLnJvd0RhdGEsIDApKSB7XG4gICAgICAgICAgICB0aGlzLmNvbHVtbkRlZnMgPSB0aGlzLmJ1aWxkQ29sdW1uRGVmcyh0aGlzLnJvd0RhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5mZXJUeXBlKHZhbDogYW55KSB7XG4gICAgICAgIGlmICh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpIHJldHVybiAndGV4dCc7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykgcmV0dXJuICdudW1iZXInO1xuICAgICAgICBjb25zdCBkID0gbmV3IERhdGUodmFsKTtcbiAgICAgICAgaWYgKCFpc05hTihkLmdldFRpbWUoKSkgJiYgL1tUOlxcLVxcL10vLnRlc3QoU3RyaW5nKHZhbCkpKSByZXR1cm4gJ2RhdGUnO1xuICAgICAgICBpZiAoIWlzTmFOKE51bWJlcih2YWwpKSAmJiB2YWwgIT09ICcnKSByZXR1cm4gJ251bWJlcic7XG4gICAgICAgIHJldHVybiAndGV4dCc7XG4gICAgfVxuXG4gICAgYnVpbGRDb2x1bW5EZWZzKGRhdGE6IGFueVtdKSB7XG4gICAgICAgIGlmICghZGF0YS5sZW5ndGgpIHJldHVybiBbXTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGRhdGFbMF0pLm1hcChrID0+IHtcbiAgICAgICAgICAgIGxldCBzYW1wbGUgPSBkYXRhLmZpbmQociA9PiByW2tdICE9IG51bGwpPy5ba107XG4gICAgICAgICAgICBjb25zdCB0ID0gdGhpcy5pbmZlclR5cGUoc2FtcGxlKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbDogYW55ID0ge1xuICAgICAgICAgICAgICAgIGZpZWxkOiBrLCBoZWFkZXJOYW1lOiB0aGlzLmdlbmVyYXRlSGVhZGVyRnJvbUtleShrKSwgZmlsdGVyOiB0cnVlLCBzb3J0YWJsZTogdHJ1ZSwgcmVzaXphYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGVuYWJsZVJvd0dyb3VwOiB0cnVlLCBlbmFibGVQaXZvdDogdHJ1ZSwgZW5hYmxlVmFsdWU6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAodCA9PT0gJ251bWJlcicpIHsgY29sLmFnZ0Z1bmMgPSAnc3VtJzsgfVxuICAgICAgICAgICAgaWYgKHQgPT09ICdkYXRlJykgeyBjb2wuZmlsdGVyID0gJ2FnRGF0ZUNvbHVtbkZpbHRlcic7IH1cbiAgICAgICAgICAgIHJldHVybiBjb2w7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdlbmVyYXRlSGVhZGVyRnJvbUtleShrZXk6IGFueSkge1xuICAgICAgICByZXR1cm4ga2V5XG4gICAgICAgICAgICAvLyBJbnNlcnQgc3BhY2UgYmVmb3JlIHVwcGVyY2FzZSBsZXR0ZXJzIChmb3IgY2FtZWxDYXNlKVxuICAgICAgICAgICAgLnJlcGxhY2UoLyhbQS1aXSkvZywgJyAkMScpXG4gICAgICAgICAgICAvLyBSZXBsYWNlIGNvbW1vbiBzZXBhcmF0b3JzIHdpdGggc3BhY2VzXG4gICAgICAgICAgICAucmVwbGFjZSgvW18tXS9nLCAnICcpXG4gICAgICAgICAgICAvLyBIYW5kbGUgYWNyb255bXMgYW5kIHNwZWNpYWwgY2FzZXMgKG11bHRpcGxlIGNhcGl0YWxzIGluIGEgcm93KVxuICAgICAgICAgICAgLnJlcGxhY2UoLyhbQS1aXSspKFtBLVpdW2Etel0pL2csICckMSAkMicpXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBtdWx0aXBsZSBzcGFjZXNcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICcgJylcbiAgICAgICAgICAgIC8vIFRyaW0gYW5kIGNvbnZlcnQgdG8gdGl0bGUgY2FzZVxuICAgICAgICAgICAgLnRyaW0oKVxuICAgICAgICAgICAgLnNwbGl0KCcgJylcbiAgICAgICAgICAgIC5tYXAoKHdvcmQ6IGFueSkgPT4gd29yZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHdvcmQuc2xpY2UoMSkudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgIC5qb2luKCcgJyk7XG4gICAgfVxuXG5cblxuICAgIEBIb3N0TGlzdGVuZXIoJ2RvY3VtZW50OmNsaWNrJywgWyckZXZlbnQnXSlcbiAgICBvbkRvY0NsaWNrKGV2OiBNb3VzZUV2ZW50KTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5tZW51T3BlbkZvcikgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5ob3N0ICYmIHRoaXMuaG9zdC5uYXRpdmVFbGVtZW50LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkge1xuICAgICAgICAgICAgLy8gY2xpY2tzIGluc2lkZSBjb21wb25lbnQ6IGlnbm9yZSB1bmxlc3Mgb24gbWVudSB0b2dnbGUgaGFuZGxlZCBlbHNld2hlcmVcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lbnVPcGVuRm9yID0gbnVsbDtcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgfVxuXG4gICAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcyk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldENvbHVtbnMoKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgY2hhbmdlcy5jb2x1bW5EZWZzIHx8XG4gICAgICAgICAgICBjaGFuZ2VzLnJvd0RhdGEgfHxcbiAgICAgICAgICAgIGNoYW5nZXMub3B0aW9uc1xuICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMucmVjb21wdXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHJlY29tcHV0ZSgpOiB2b2lkIHtcbiAgICAgICAgdmFyIGRlZiA9ICh0aGlzLm9wdGlvbnMgJiYgdGhpcy5vcHRpb25zLmRlZmF1bHRDb2xEZWYpIHx8IHt9O1xuICAgICAgICB0aGlzLm1lcmdlZENvbHMgPSAodGhpcy5jb2x1bW5EZWZzIHx8IFtdKS5tYXAoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXJnZUNvbERlZihjLCBkZWYpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgZmlsdGVyZWQgPSBmaWx0ZXJSb3dzKHRoaXMucm93RGF0YSB8fCBbXSwgdGhpcy5tZXJnZWRDb2xzLCB0aGlzLmZpbHRlck1vZGVsKTtcbiAgICAgICAgdmFyIHNvcnRlZCA9IHNvcnRSb3dzKGZpbHRlcmVkLCB0aGlzLm1lcmdlZENvbHMsIHRoaXMuc29ydE1vZGVsKTtcblxuICAgICAgICBpZiAodGhpcy5waXZvdE1vZGVsLmVuYWJsZWQgJiYgdGhpcy5waXZvdE1vZGVsLnBpdm90Q29sICYmIHRoaXMucGl2b3RNb2RlbC52YWx1ZUNvbHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgcGl2b3RlZCA9IHBpdm90Um93cyhzb3J0ZWQsIHRoaXMubWVyZ2VkQ29scywgdGhpcy5waXZvdE1vZGVsLCB0aGlzLmV4cGFuZGVkR3JvdXBzKTtcbiAgICAgICAgICAgIC8vIHJlcGxhY2UgY29sdW1ucyB3aXRoIGR5bmFtaWMgcGl2b3QgY29scyBvbmx5IChubyBvcmlnaW5hbCBkYXRhIGNvbHMgZm9yIG5vdylcbiAgICAgICAgICAgIHRoaXMudmlld1Jvd3MgPSBwaXZvdGVkLnJvd3M7XG4gICAgICAgICAgICB0aGlzLm1lcmdlZENvbHMgPSBwaXZvdGVkLmR5bmFtaWNDb2xzO1xuICAgICAgICAgICAgdGhpcy5leHBhbmRlZEdyb3Vwcy5jbGVhcigpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZ3JvdXBNb2RlbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBhZ2dNb2RlbCA9IHRoaXMuYnVpbGRBZ2dNb2RlbCgpO1xuICAgICAgICAgICAgdmFyIGdyb3VwZWQgPSBncm91cEFuZEZsYXR0ZW5Sb3dzKHNvcnRlZCwgdGhpcy5tZXJnZWRDb2xzLCB0aGlzLmdyb3VwTW9kZWwsIGFnZ01vZGVsLCB0aGlzLmV4cGFuZGVkR3JvdXBzKTtcbiAgICAgICAgICAgIC8vIEVuc3VyZSBuZXcgZ3JvdXBzIGFyZSBleHBhbmRlZCBieSBkZWZhdWx0XG4gICAgICAgICAgICBncm91cGVkLnBhdGhzLmZvckVhY2goKHApID0+IHRoaXMuZXhwYW5kZWRHcm91cHMuYWRkKHApKTtcbiAgICAgICAgICAgIHRoaXMudmlld1Jvd3MgPSBncm91cGVkLmZsYXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnZpZXdSb3dzID0gc29ydGVkO1xuICAgICAgICAgICAgdGhpcy5leHBhbmRlZEdyb3Vwcy5jbGVhcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgc2VsZWN0aW9uIGlmIGl0IHdvdWxkIGJlY29tZSBpbnZhbGlkXG4gICAgICAgIHZhciBuZXh0ID0gbmV3IFNldDxUPigpO1xuICAgICAgICB2YXIgbGVhdmVzID0gdGhpcy5nZXRMZWFmUm93cygpO1xuICAgICAgICB0aGlzLnNlbGVjdGVkLmZvckVhY2goKHJvdykgPT4ge1xuICAgICAgICAgICAgaWYgKGxlYXZlcy5pbmRleE9mKHJvdykgPj0gMCkgbmV4dC5hZGQocm93KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBuZXh0O1xuICAgIH1cblxuICAgIC8vIC0tLS0gVUkgYWN0aW9ucyAtLS0tXG5cbiAgICBvbkhlYWRlckNsaWNrKGNvbDogQ29sdW1uRGVmPFQ+LCBldj86IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKCFjb2wuc29ydGFibGUpIHJldHVybjtcbiAgICAgICAgLy8gSWYgbWVudSBpcyBvcGVuIGZvciB0aGlzIGNvbHVtbiwgZG9uJ3QgdG9nZ2xlIHNvcnRcbiAgICAgICAgaWYgKHRoaXMubWVudU9wZW5Gb3IgPT09IFN0cmluZyhjb2wuZmllbGQpKSByZXR1cm47XG5cbiAgICAgICAgdmFyIGNvbElkID0gU3RyaW5nKGNvbC5maWVsZCk7XG4gICAgICAgIHZhciBtdWx0aSA9ICEhKHRoaXMub3B0aW9ucyAmJiB0aGlzLm9wdGlvbnMubXVsdGlTb3J0KSB8fCAhIShldiAmJiBldi5zaGlmdEtleSk7XG5cbiAgICAgICAgdmFyIG5leHQgPSBtdWx0aSA/IHRoaXMuc29ydE1vZGVsLnNsaWNlKCkgOiBbXTtcbiAgICAgICAgdmFyIGlkeCA9IG5leHQuZmluZEluZGV4KGZ1bmN0aW9uIChtKSB7XG4gICAgICAgICAgICByZXR1cm4gbS5jb2xJZCA9PT0gY29sSWQ7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChpZHggPT09IC0xKSB7XG4gICAgICAgICAgICBuZXh0LnB1c2goeyBjb2xJZDogY29sSWQsIHNvcnQ6ICdhc2MnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGN1cnJlbnQgPSBuZXh0W2lkeF07XG4gICAgICAgICAgICBpZiAoY3VycmVudC5zb3J0ID09PSAnYXNjJykgbmV4dFtpZHhdID0geyBjb2xJZDogY29sSWQsIHNvcnQ6ICdkZXNjJyB9O1xuICAgICAgICAgICAgZWxzZSBuZXh0LnNwbGljZShpZHgsIDEpOyAvLyByZW1vdmUgLT4gdW5zb3J0ZWRcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVjb21wdXRlKCk7XG4gICAgfVxuXG4gICAgZ2V0U29ydEluZGljYXRvcihjb2w6IENvbHVtbkRlZjxUPik6IHN0cmluZyB7XG4gICAgICAgIGlmICghdGhpcy5zb3J0TW9kZWwubGVuZ3RoKSByZXR1cm4gJyc7XG4gICAgICAgIHZhciBpZHggPSB0aGlzLnNvcnRNb2RlbC5maW5kSW5kZXgoKG0pID0+IG0uY29sSWQgPT09IFN0cmluZyhjb2wuZmllbGQpKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybiAnJztcbiAgICAgICAgdmFyIG1hcmsgPSB0aGlzLnNvcnRNb2RlbFtpZHhdLnNvcnQgPT09ICdhc2MnID8gJ+KWsicgOiAn4pa8JztcbiAgICAgICAgcmV0dXJuIHRoaXMuc29ydE1vZGVsLmxlbmd0aCA+IDEgPyBtYXJrICsgJyAnICsgKGlkeCArIDEpIDogbWFyaztcbiAgICB9XG5cbiAgICBpc1Jvd1NlbGVjdGVkKHJvdzogUm93VmlldzxUPik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodGhpcy5pc0dyb3VwUm93KHJvdykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWQuaGFzKHJvdyBhcyBUKTtcbiAgICB9XG5cbiAgICB0b2dnbGVSb3dTZWxlY3Rpb24ocm93OiBSb3dWaWV3PFQ+LCBldj86IE1vdXNlRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLnNob3dTZWxlY3Rpb25Db2x1bW4pIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuaXNHcm91cFJvdyhyb3cpKSByZXR1cm47XG4gICAgICAgIHZhciBtb2RlID0gKHRoaXMub3B0aW9ucyAmJiB0aGlzLm9wdGlvbnMucm93U2VsZWN0aW9uKSB8fCAnc2luZ2xlJztcblxuICAgICAgICBpZiAobW9kZSA9PT0gJ3NpbmdsZScpIHtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWQuY2xlYXIoKTtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWQuYWRkKHJvdyBhcyBUKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG11bHRpcGxlXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkLmhhcyhyb3cgYXMgVCkpIHRoaXMuc2VsZWN0ZWQuZGVsZXRlKHJvdyBhcyBUKTtcbiAgICAgICAgZWxzZSB0aGlzLnNlbGVjdGVkLmFkZChyb3cgYXMgVCk7XG4gICAgfVxuXG4gICAgdG9nZ2xlQWxsKCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuc2hvd1NlbGVjdGlvbkNvbHVtbikgcmV0dXJuO1xuICAgICAgICB2YXIgbGVhdmVzID0gdGhpcy5nZXRMZWFmUm93cygpO1xuICAgICAgICBpZiAobGVhdmVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkLnNpemUgPT09IGxlYXZlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWQuY2xlYXIoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2VsZWN0ZWQuY2xlYXIoKTtcbiAgICAgICAgbGVhdmVzLmZvckVhY2goKHIpID0+IHRoaXMuc2VsZWN0ZWQuYWRkKHIpKTtcbiAgICB9XG5cbiAgICBnZXQgYWxsU2VsZWN0ZWQoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5zaG93U2VsZWN0aW9uQ29sdW1uKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHZhciBsZWF2ZXMgPSB0aGlzLmdldExlYWZSb3dzKCk7XG4gICAgICAgIHJldHVybiBsZWF2ZXMubGVuZ3RoID4gMCAmJiB0aGlzLnNlbGVjdGVkLnNpemUgPT09IGxlYXZlcy5sZW5ndGg7XG4gICAgfVxuXG4gICAgcmVuZGVyQ2VsbChjb2w6IENvbHVtbkRlZjxUPiwgcm93OiBUKTogYW55IHtcbiAgICAgICAgdmFyIHZhbHVlID0gZ2V0Q2VsbFZhbHVlKGNvbCwgcm93KTtcbiAgICAgICAgcmV0dXJuIGNvbC52YWx1ZUZvcm1hdHRlciA/IGNvbC52YWx1ZUZvcm1hdHRlcih2YWx1ZSwgcm93KSA6IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzaG93U2VsZWN0aW9uQ29sdW1uKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb24gIT09IGZhbHNlO1xuICAgIH1cblxuICAgIG9uRmlsdGVyQ2hhbmdlKGNvbDogQ29sdW1uRGVmPFQ+LCB2YWx1ZTogYW55LCB2YWx1ZVRvPzogYW55KTogdm9pZCB7XG4gICAgICAgIHZhciBjb2xJZCA9IFN0cmluZyhjb2wuZmllbGQpO1xuICAgICAgICB2YXIgbW9kZSA9IHRoaXMuZmlsdGVyTW9kZXNbY29sSWRdIHx8IChjb2wgYXMgYW55KS5maWx0ZXJNYXRjaE1vZGUgfHwgJ2NvbnRhaW5zJztcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLmZpbHRlck1vZGVsLmZpbHRlcihmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgcmV0dXJuIGYuY29sSWQgIT09IGNvbElkO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgaGFzUmFuZ2UgPSB2YWx1ZVRvICE9PSB1bmRlZmluZWQgJiYgdmFsdWVUbyAhPT0gbnVsbCAmJiB2YWx1ZVRvICE9PSAnJztcbiAgICAgICAgdmFyIGhhc1ZhbHVlID0gdmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gJyc7XG4gICAgICAgIGlmIChoYXNWYWx1ZSB8fCBoYXNSYW5nZSkge1xuICAgICAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgY29sLmZpbHRlciA9PT0gJ3N0cmluZycgPyBjb2wuZmlsdGVyIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgbmV4dC5wdXNoKHsgY29sSWQsIHR5cGUsIHZhbHVlLCB2YWx1ZVRvLCBtYXRjaE1vZGU6IG1vZGUgYXMgYW55IH0gYXMgYW55KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlsdGVyTW9kZWwgPSBuZXh0O1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgIH1cblxuICAgIG9uUmFuZ2VJbnB1dChjb2w6IENvbHVtbkRlZjxUPiwgcGFydDogJ21pbicgfCAnbWF4JywgdmFsdWU6IGFueSk6IHZvaWQge1xuICAgICAgICB2YXIgY29sSWQgPSBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSB0aGlzLmZpbHRlcklucHV0c1tjb2xJZF0gfHwge307XG4gICAgICAgIGlmIChwYXJ0ID09PSAnbWluJykgY3VycmVudC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICBlbHNlIGN1cnJlbnQudmFsdWVUbyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpbHRlcklucHV0c1tjb2xJZF0gPSBjdXJyZW50O1xuICAgICAgICB0aGlzLm9uRmlsdGVyQ2hhbmdlKGNvbCwgY3VycmVudC52YWx1ZSwgY3VycmVudC52YWx1ZVRvKTtcbiAgICB9XG5cbiAgICBvblRleHRGaWx0ZXJJbnB1dChjb2w6IENvbHVtbkRlZjxUPiwgcmF3OiBhbnksIGluc3RhbnQ/OiBib29sZWFuKTogdm9pZCB7XG4gICAgICAgIHZhciBjb2xJZCA9IFN0cmluZyhjb2wuZmllbGQpO1xuICAgICAgICB0aGlzLmZpbHRlcklucHV0c1tjb2xJZF0gPSB0aGlzLmZpbHRlcklucHV0c1tjb2xJZF0gfHwge307XG4gICAgICAgIHRoaXMuZmlsdGVySW5wdXRzW2NvbElkXS52YWx1ZSA9IHJhdztcbiAgICAgICAgaWYgKGluc3RhbnQpIHtcbiAgICAgICAgICAgIHRoaXMub25GaWx0ZXJDaGFuZ2UoY29sLCByYXcsIHVuZGVmaW5lZCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGVib3VuY2UgcGVyIGNvbHVtblxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5maWx0ZXJEZWJvdW5jZVtjb2xJZF0pO1xuICAgICAgICB0aGlzLmZpbHRlckRlYm91bmNlW2NvbElkXSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbkZpbHRlckNoYW5nZShjb2wsIHJhdywgdW5kZWZpbmVkKTtcbiAgICAgICAgfSwgMTUwKTtcbiAgICB9XG5cbiAgICBvblRleHRNb2RlQ2hhbmdlKGNvbDogQ29sdW1uRGVmPFQ+LCBtb2RlOiAnY29udGFpbnMnIHwgJ3N0YXJ0c1dpdGgnIHwgJ2VxdWFscycpOiB2b2lkIHtcbiAgICAgICAgdmFyIGNvbElkID0gU3RyaW5nKGNvbC5maWVsZCk7XG4gICAgICAgIHRoaXMuZmlsdGVyTW9kZXNbY29sSWRdID0gbW9kZTtcbiAgICAgICAgLy8gUmVhcHBseSBjdXJyZW50IGZpbHRlciB2YWx1ZSB3aXRoIG5ldyBtb2RlXG4gICAgICAgIHZhciBleGlzdGluZyA9IHRoaXMuZmlsdGVyTW9kZWwuZmluZCgoZikgPT4gZi5jb2xJZCA9PT0gY29sSWQpO1xuICAgICAgICB2YXIgdmFsID0gZXhpc3RpbmcgPyBleGlzdGluZy52YWx1ZSA6ICcnO1xuICAgICAgICB0aGlzLm9uRmlsdGVyQ2hhbmdlKGNvbCwgdmFsLCBleGlzdGluZyA/IGV4aXN0aW5nLnZhbHVlVG8gOiB1bmRlZmluZWQpO1xuICAgIH1cblxuICAgIGNsZWFyRmlsdGVycygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5maWx0ZXJNb2RlbCA9IFtdO1xuICAgICAgICB0aGlzLmZpbHRlcklucHV0cyA9IHt9O1xuICAgICAgICB0aGlzLmZpbHRlck1vZGVzID0ge307XG4gICAgICAgIHRoaXMucmVjb21wdXRlKCk7XG4gICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xuICAgIH1cblxuICAgIGNsZWFyR3JvdXBzKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmdyb3VwTW9kZWwgPSBbXTtcbiAgICAgICAgdGhpcy5leHBhbmRlZEdyb3Vwcy5jbGVhcigpO1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgIH1cblxuICAgIHRvZ2dsZUdyb3VwKGNvbDogQ29sdW1uRGVmPFQ+KTogdm9pZCB7XG4gICAgICAgIHZhciBjb2xJZCA9IFN0cmluZyhjb2wuZmllbGQpO1xuICAgICAgICB2YXIgaWR4ID0gdGhpcy5ncm91cE1vZGVsLmZpbmRJbmRleCgoZykgPT4gZy5jb2xJZCA9PT0gY29sSWQpO1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMuZ3JvdXBNb2RlbC5zbGljZSgpO1xuICAgICAgICBpZiAoaWR4ID09PSAtMSkgbmV4dC5wdXNoKHsgY29sSWQgfSk7XG4gICAgICAgIGVsc2UgbmV4dC5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgdGhpcy5ncm91cE1vZGVsID0gbmV4dDtcbiAgICAgICAgaWYgKCFuZXh0Lmxlbmd0aCkgdGhpcy5leHBhbmRlZEdyb3Vwcy5jbGVhcigpO1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgIH1cblxuICAgIGlzR3JvdXBlZChjb2w6IENvbHVtbkRlZjxUPik6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ncm91cE1vZGVsLnNvbWUoKGcpID0+IGcuY29sSWQgPT09IFN0cmluZyhjb2wuZmllbGQpKTtcbiAgICB9XG5cbiAgICBpc0dyb3VwUm93KHJvdzogUm93VmlldzxUPik6IHJvdyBpcyBHcm91cFZpZXdSb3c8VD4ge1xuICAgICAgICByZXR1cm4gISEocm93IGFzIGFueSkuX19ncm91cDtcbiAgICB9XG5cbiAgICBpc0V4cGFuZGVkKHJvdzogR3JvdXBWaWV3Um93PFQ+KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4cGFuZGVkR3JvdXBzLmhhcyhyb3cucGF0aCk7XG4gICAgfVxuXG4gICAgdG9nZ2xlR3JvdXBFeHBhbmQocm93OiBHcm91cFZpZXdSb3c8VD4pOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuZXhwYW5kZWRHcm91cHMuaGFzKHJvdy5wYXRoKSkgdGhpcy5leHBhbmRlZEdyb3Vwcy5kZWxldGUocm93LnBhdGgpO1xuICAgICAgICBlbHNlIHRoaXMuZXhwYW5kZWRHcm91cHMuYWRkKHJvdy5wYXRoKTtcbiAgICAgICAgdGhpcy5yZWNvbXB1dGUoKTtcbiAgICB9XG5cbiAgICBnZXRHcm91cEFnZyhyb3c6IEdyb3VwVmlld1JvdzxUPiwgY29sOiBDb2x1bW5EZWY8VD4pOiBhbnkge1xuICAgICAgICByZXR1cm4gcm93LmFnZ1tTdHJpbmcoY29sLmZpZWxkKV0gPz8gJyc7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRMZWFmUm93cygpOiBUW10ge1xuICAgICAgICByZXR1cm4gKHRoaXMudmlld1Jvd3MgYXMgQXJyYXk8Um93VmlldzxUPj4pLmZpbHRlcigocikgPT4gIXRoaXMuaXNHcm91cFJvdyhyKSkgYXMgVFtdO1xuICAgIH1cblxuICAgIHByaXZhdGUgYnVpbGRBZ2dNb2RlbCgpOiBBZ2dNb2RlbEl0ZW1bXSB7XG4gICAgICAgIHZhciBzYW1wbGUgPSAodGhpcy5yb3dEYXRhICYmIHRoaXMucm93RGF0YS5sZW5ndGgpID8gdGhpcy5yb3dEYXRhWzBdIDogbnVsbDtcbiAgICAgICAgcmV0dXJuIHRoaXMubWVyZ2VkQ29sc1xuICAgICAgICAgICAgLm1hcChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICAgIHZhciBhZ2cgPSBjLmFnZ0Z1bmM7XG4gICAgICAgICAgICAgICAgaWYgKCFhZ2cgJiYgc2FtcGxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB2ID0gZ2V0Q2VsbFZhbHVlKGMsIHNhbXBsZSBhcyBhbnkpO1xuICAgICAgICAgICAgICAgICAgICBhZ2cgPSB0eXBlb2YgdiA9PT0gJ251bWJlcicgPyAnc3VtJyA6ICdjb3VudCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghYWdnKSBhZ2cgPSAnY291bnQnO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbElkOiBTdHJpbmcoYy5maWVsZCksIGFnZ0Z1bmM6IGFnZyB9O1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2tCeVJvdyA9IChfaTogbnVtYmVyLCByb3c6IFJvd1ZpZXc8VD4pOiBzdHJpbmcgfCBudW1iZXIgPT4ge1xuICAgICAgICBpZiAodGhpcy5pc0dyb3VwUm93KHJvdykpIHJldHVybiAnZzonICsgKHJvdyBhcyBHcm91cFZpZXdSb3c8VD4pLnBhdGg7XG4gICAgICAgIC8vIFVzZSBpbmRleCB0byBhdm9pZCBkdXBsaWNhdGUga2V5cyBmcm9tIG9iamVjdCBzdHJpbmdpZmljYXRpb25cbiAgICAgICAgcmV0dXJuICdyOicgKyBfaTtcbiAgICB9O1xuXG4gICAgdHJhY2tCeUNvbChfaTogbnVtYmVyLCBjb2w6IENvbHVtbkRlZjxUPik6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICB9XG5cbiAgICBpc1ZhbHVlQ29sKGNvbDogQ29sdW1uRGVmPFQ+KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpdm90TW9kZWwudmFsdWVDb2xzLnNvbWUoKHYpID0+IHYuY29sSWQgPT09IFN0cmluZyhjb2wuZmllbGQpKTtcbiAgICB9XG5cbiAgICB0b2dnbGVWYWx1ZUNvbChjb2w6IENvbHVtbkRlZjxUPik6IHZvaWQge1xuICAgICAgICB2YXIgaWQgPSBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLnBpdm90TW9kZWwudmFsdWVDb2xzLnNsaWNlKCk7XG4gICAgICAgIHZhciBpZHggPSBuZXh0LmZpbmRJbmRleCgodikgPT4gdi5jb2xJZCA9PT0gaWQpO1xuICAgICAgICBpZiAoaWR4ID09PSAtMSkgbmV4dC5wdXNoKHsgY29sSWQ6IGlkLCBhZ2dGdW5jOiBjb2wuYWdnRnVuYyB8fCAnc3VtJyB9KTtcbiAgICAgICAgZWxzZSBuZXh0LnNwbGljZShpZHgsIDEpO1xuICAgICAgICB0aGlzLnBpdm90TW9kZWwgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLnBpdm90TW9kZWwsIHsgdmFsdWVDb2xzOiBuZXh0IH0pO1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgIH1cblxuICAgIG9uUGl2b3RUb2dnbGUoZW5hYmxlZDogYW55KTogdm9pZCB7XG4gICAgICAgIHRoaXMucGl2b3RNb2RlbCA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucGl2b3RNb2RlbCwgeyBlbmFibGVkOiAhIWVuYWJsZWQgfSk7XG4gICAgICAgIHRoaXMucmVjb21wdXRlKCk7XG4gICAgfVxuXG4gICAgb25QaXZvdENvbmZpZ0NoYW5nZSh2YWw/OiBhbnkpOiB2b2lkIHtcbiAgICAgICAgLy8gRW5zdXJlIHVuZGVmaW5lZCB3aGVuIGNsZWFyZWRcbiAgICAgICAgaWYgKHZhbCA9PT0gJycgfHwgdmFsID09PSBudWxsKSB2YWwgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMucGl2b3RNb2RlbCA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucGl2b3RNb2RlbCwgeyBwaXZvdENvbDogdmFsIH0pO1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgIH1cblxuICAgIGdldENvbFdpZHRoKGNvbDogQ29sdW1uRGVmPFQ+KTogbnVtYmVyIHtcbiAgICAgICAgdmFyIGlkID0gU3RyaW5nKGNvbC5maWVsZCk7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbFdpZHRoc1tpZF0gPz8gKGNvbC53aWR0aCB8fCAxNjApO1xuICAgIH1cblxuICAgIHRvZ2dsZU1lbnUoY29sOiBDb2x1bW5EZWY8VD4pOiB2b2lkIHtcbiAgICAgICAgdmFyIGlkID0gU3RyaW5nKGNvbC5maWVsZCk7XG4gICAgICAgIHRoaXMubWVudU9wZW5Gb3IgPSB0aGlzLm1lbnVPcGVuRm9yID09PSBpZCA/IG51bGwgOiBpZDtcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgfVxuXG4gICAgY2xvc2VNZW51KCk6IHZvaWQge1xuICAgICAgICB0aGlzLm1lbnVPcGVuRm9yID0gbnVsbDtcbiAgICAgICAgdGhpcy5jZHIubWFya0ZvckNoZWNrKCk7XG4gICAgfVxuXG4gICAgc29ydEFzYyhjb2w6IENvbHVtbkRlZjxUPik6IHZvaWQge1xuICAgICAgICB2YXIgaWQgPSBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLnNvcnRNb2RlbC5maWx0ZXIoKG0pID0+IG0uY29sSWQgIT09IGlkKTtcbiAgICAgICAgbmV4dC51bnNoaWZ0KHsgY29sSWQ6IGlkLCBzb3J0OiAnYXNjJyB9KTtcbiAgICAgICAgdGhpcy5zb3J0TW9kZWwgPSBuZXh0O1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgICAgICB0aGlzLmNsb3NlTWVudSgpO1xuICAgIH1cblxuICAgIHNvcnREZXNjKGNvbDogQ29sdW1uRGVmPFQ+KTogdm9pZCB7XG4gICAgICAgIHZhciBpZCA9IFN0cmluZyhjb2wuZmllbGQpO1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMuc29ydE1vZGVsLmZpbHRlcigobSkgPT4gbS5jb2xJZCAhPT0gaWQpO1xuICAgICAgICBuZXh0LnVuc2hpZnQoeyBjb2xJZDogaWQsIHNvcnQ6ICdkZXNjJyB9KTtcbiAgICAgICAgdGhpcy5zb3J0TW9kZWwgPSBuZXh0O1xuICAgICAgICB0aGlzLnJlY29tcHV0ZSgpO1xuICAgICAgICB0aGlzLmNsb3NlTWVudSgpO1xuICAgIH1cblxuICAgIGNsZWFyU29ydChjb2w6IENvbHVtbkRlZjxUPik6IHZvaWQge1xuICAgICAgICB2YXIgaWQgPSBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICAgICAgdGhpcy5zb3J0TW9kZWwgPSB0aGlzLnNvcnRNb2RlbC5maWx0ZXIoKG0pID0+IG0uY29sSWQgIT09IGlkKTtcbiAgICAgICAgdGhpcy5yZWNvbXB1dGUoKTtcbiAgICAgICAgdGhpcy5jbG9zZU1lbnUoKTtcbiAgICB9XG5cbiAgICBjbGVhckZpbHRlckZvcihjb2w6IENvbHVtbkRlZjxUPik6IHZvaWQge1xuICAgICAgICB2YXIgaWQgPSBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICAgICAgdGhpcy5maWx0ZXJNb2RlbCA9IHRoaXMuZmlsdGVyTW9kZWwuZmlsdGVyKChmKSA9PiBmLmNvbElkICE9PSBpZCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmZpbHRlcklucHV0c1tpZF07XG4gICAgICAgIHRoaXMucmVjb21wdXRlKCk7XG4gICAgICAgIHRoaXMuY2xvc2VNZW51KCk7XG4gICAgfVxuXG4gICAgb25SZXNpemVTdGFydChldjogTW91c2VFdmVudCwgY29sOiBDb2x1bW5EZWY8VD4pOiB2b2lkIHtcbiAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHZhciBzdGFydFggPSBldi5jbGllbnRYO1xuICAgICAgICB2YXIgaWQgPSBTdHJpbmcoY29sLmZpZWxkKTtcbiAgICAgICAgdmFyIHN0YXJ0VyA9IHRoaXMuZ2V0Q29sV2lkdGgoY29sKTtcbiAgICAgICAgdmFyIG1pblcgPSBjb2wubWluV2lkdGggfHwgNjA7XG4gICAgICAgIHZhciBtYXhXID0gY29sLm1heFdpZHRoIHx8IDYwMDtcbiAgICAgICAgdGhpcy56b25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHtcbiAgICAgICAgICAgIHZhciBwZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB2YXIgbmV4dFdpZHRoID0gc3RhcnRXO1xuICAgICAgICAgICAgdmFyIG1vdmUgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBkZWx0YSA9IGUuY2xpZW50WCAtIHN0YXJ0WDtcbiAgICAgICAgICAgICAgICBuZXh0V2lkdGggPSBNYXRoLm1heChtaW5XLCBNYXRoLm1pbihtYXhXLCBzdGFydFcgKyBkZWx0YSkpO1xuICAgICAgICAgICAgICAgIGlmICghcGVuZGluZykge1xuICAgICAgICAgICAgICAgICAgICBwZW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNpemVGcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbFdpZHRocyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuY29sV2lkdGhzLCB7IFtpZF06IG5leHRXaWR0aCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHVwID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlc2l6ZUZyYW1lICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5yZXNpemVGcmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzaXplRnJhbWUgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnJlc2l6aW5nQ29sID0gbnVsbDtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBtb3ZlKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHVwKTtcbiAgICAgICAgICAgICAgICB0aGlzLnpvbmUucnVuKCgpID0+IHRoaXMuY2RyLm1hcmtGb3JDaGVjaygpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLnJlc2l6aW5nQ29sID0gaWQ7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdjb2wtcmVzaXplJztcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBtb3ZlKTtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdXAsIHsgb25jZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHRoaXMuem9uZS5ydW4oKCkgPT4gdGhpcy5jZHIubWFya0ZvckNoZWNrKCkpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRGaWx0ZXJWYWx1ZShjb2w6IENvbHVtbkRlZjxUPiwgcGFydDogJ21pbicgfCAnbWF4JyA9ICdtaW4nKTogYW55IHtcbiAgICAgICAgdmFyIGNvbElkID0gU3RyaW5nKGNvbC5maWVsZCk7XG4gICAgICAgIC8vIFJhbmdlIHZhbHVlcyBjYWNoZWQgc2VwYXJhdGVseVxuICAgICAgICBpZiAocGFydCA9PT0gJ21pbicgfHwgcGFydCA9PT0gJ21heCcpIHtcbiAgICAgICAgICAgIHZhciBjYWNoZWQgPSB0aGlzLmZpbHRlcklucHV0c1tjb2xJZF07XG4gICAgICAgICAgICBpZiAoY2FjaGVkKSByZXR1cm4gcGFydCA9PT0gJ21pbicgPyBjYWNoZWQudmFsdWUgOiBjYWNoZWQudmFsdWVUbztcbiAgICAgICAgfVxuICAgICAgICAvLyBGb3IgdGV4dCAvIHNpbmdsZS12YWx1ZSBmaWx0ZXJzLCBkZXJpdmUgZnJvbSBtb2RlbFxuICAgICAgICB2YXIgaGl0ID0gdGhpcy5maWx0ZXJNb2RlbC5maW5kKChmKSA9PiBmLmNvbElkID09PSBjb2xJZCk7XG4gICAgICAgIGlmICghaGl0KSByZXR1cm4gJyc7XG4gICAgICAgIHJldHVybiBwYXJ0ID09PSAnbWluJyA/IGhpdC52YWx1ZSA/PyAnJyA6IGhpdC52YWx1ZVRvID8/ICcnO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZG93bmxvYWRUZXh0RmlsZShjb250ZW50OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIG1pbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIHZhciBibG9iID0gbmV3IEJsb2IoW2NvbnRlbnRdLCB7IHR5cGU6IG1pbWUgfSk7XG4gICAgdmFyIHVybCA9ICh3aW5kb3cuVVJMIHx8ICh3aW5kb3cgYXMgYW55KS53ZWJraXRVUkwpLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblxuICAgIHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIGEuaHJlZiA9IHVybDtcbiAgICBhLmRvd25sb2FkID0gZmlsZW5hbWU7XG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG4gICAgYS5jbGljaygpO1xuXG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYSk7XG4gICAgICAgICh3aW5kb3cuVVJMIHx8ICh3aW5kb3cgYXMgYW55KS53ZWJraXRVUkwpLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgIH0sIDApO1xufVxuXG5jb25zdCBpc0FycmF5VmFsaWQgPSAoJGFycmF5OiBhbnlbXSwgJGxlbmd0aDogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuICRhcnJheSAmJiAkYXJyYXkubGVuZ3RoID4gJGxlbmd0aCA/IHRydWUgOiBmYWxzZTtcbn1cbiIsIjxkaXYgY2xhc3M9XCJvZy1ncmlkLXJvb3RcIj5cbiAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1ncm91cGJhclwiICpuZ0lmPVwibWVyZ2VkQ29scy5sZW5ndGhcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtYWN0aW9uc1wiPlxuICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJvZy1ncmlkLWJ0biBvZy1ncmlkLXBpdm90LWJ0blwiIChjbGljayk9XCJzaG93UGl2b3RQYW5lbCA9ICFzaG93UGl2b3RQYW5lbFwiPlxuICAgICAgICAgICAgICAgIHt7IHNob3dQaXZvdFBhbmVsID8gJ0hpZGUgUGl2b3QnIDogJ1Nob3cgUGl2b3QnIH19XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLWdyb3VwLWxhYmVsXCI+R3JvdXAgYnk6PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLWdyb3VwLXBpbGxzXCI+XG4gICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJvZy1ncmlkLXBpbGxcIiAqbmdGb3I9XCJsZXQgY29sIG9mIG1lcmdlZENvbHNcIj5cbiAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgW2NoZWNrZWRdPVwiaXNHcm91cGVkKGNvbClcIiAoY2hhbmdlKT1cInRvZ2dsZUdyb3VwKGNvbClcIiAvPlxuICAgICAgICAgICAgICAgIDxzcGFuPnt7IGNvbC5oZWFkZXJOYW1lIHx8IChjb2wuZmllbGQgKyAnJykgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJvZy1ncmlkLWJ0blwiIChjbGljayk9XCJjbGVhckdyb3VwcygpXCI+Q2xlYXI8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1oZWFkZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtaGVhZGVyLWNlbGwgb2ctZ3JpZC1zZWxlY3RcIiAqbmdJZj1cInNob3dTZWxlY3Rpb25Db2x1bW4gJiYgc2hvd1NlbGVjdGlvbiBcIj5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBbY2hlY2tlZF09XCJhbGxTZWxlY3RlZFwiIChjaGFuZ2UpPVwidG9nZ2xlQWxsKClcIiAvPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1oZWFkZXItY2VsbFwiICpuZ0Zvcj1cImxldCBjb2wgb2YgbWVyZ2VkQ29sczsgbGV0IGNpID0gaW5kZXg7IHRyYWNrQnk6IHRyYWNrQnlDb2xcIlxuICAgICAgICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImdldENvbFdpZHRoKGNvbClcIiAoY2xpY2spPVwib25IZWFkZXJDbGljayhjb2wsICRldmVudClcIlxuICAgICAgICAgICAgW2NsYXNzLm9nLWdyaWQtc29ydGFibGVdPVwiISFjb2wuc29ydGFibGVcIiB0aXRsZT1cIkNsaWNrIHRvIHNvcnRcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwib2ctZ3JpZC1oZWFkZXItdGl0bGVcIj5cbiAgICAgICAgICAgICAgICB7eyBjb2wuaGVhZGVyTmFtZSB8fCAoY29sLmZpZWxkICsgJycpIH19XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm9nLWdyaWQtc29ydC1pbmRcIj57eyBnZXRTb3J0SW5kaWNhdG9yKGNvbCkgfX08L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm9nLWdyaWQtaGVhZGVyLW1lbnVcIiAoY2xpY2spPVwidG9nZ2xlTWVudShjb2wpOyAkZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIj5cbiAgICAgICAgICAgICAgICDii65cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLW1lbnVcIiAqbmdJZj1cIm1lbnVPcGVuRm9yID09PSAoY29sLmZpZWxkICsgJycpXCIgKGNsaWNrKT1cIiRldmVudC5zdG9wUHJvcGFnYXRpb24oKVwiPlxuICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIChjbGljayk9XCJzb3J0QXNjKGNvbClcIj5Tb3J0IEFzY2VuZGluZzwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIChjbGljayk9XCJzb3J0RGVzYyhjb2wpXCI+U29ydCBEZXNjZW5kaW5nPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgKGNsaWNrKT1cImNsZWFyU29ydChjb2wpXCI+Q2xlYXIgU29ydDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxociAvPlxuICAgICAgICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIChjbGljayk9XCJjbGVhckZpbHRlckZvcihjb2wpXCI+Q2xlYXIgRmlsdGVyPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgKGNsaWNrKT1cImNsZWFyRmlsdGVycygpXCI+Q2xlYXIgQWxsIEZpbHRlcnM8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJvZy1ncmlkLXJlc2l6ZXJcIiAobW91c2Vkb3duKT1cIm9uUmVzaXplU3RhcnQoJGV2ZW50LCBjb2wpXCI+PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLXBpdm90LXBhbmVsXCIgKm5nSWY9XCJzaG93UGl2b3RQYW5lbFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1waXZvdC10b2dnbGVcIj5cbiAgICAgICAgICAgIDxsYWJlbD48aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgWyhuZ01vZGVsKV09XCJwaXZvdE1vZGVsLmVuYWJsZWRcIiAobmdNb2RlbENoYW5nZSk9XCJvblBpdm90VG9nZ2xlKCRldmVudClcIiAvPlxuICAgICAgICAgICAgICAgIFBpdm90IE1vZGU8L2xhYmVsPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtcGl2b3Qtc2VjdGlvblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtcGl2b3QtdGl0bGVcIj5QaXZvdCBDb2x1bW48L2Rpdj5cbiAgICAgICAgICAgIDxzZWxlY3QgWyhuZ01vZGVsKV09XCJwaXZvdE1vZGVsLnBpdm90Q29sXCIgKG5nTW9kZWxDaGFuZ2UpPVwib25QaXZvdENvbmZpZ0NoYW5nZSgkZXZlbnQpXCI+XG4gICAgICAgICAgICAgICAgPG9wdGlvbiBbbmdWYWx1ZV09XCJ1bmRlZmluZWRcIj5Ob25lPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgPG9wdGlvbiAqbmdGb3I9XCJsZXQgY29sIG9mIGNvbHVtbkRlZnNcIiBbbmdWYWx1ZV09XCJjb2wuZmllbGRcIj57eyBjb2wuaGVhZGVyTmFtZSB8fCAoY29sLmZpZWxkICsgJycpIH19XG4gICAgICAgICAgICAgICAgPC9vcHRpb24+XG4gICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLXBpdm90LXNlY3Rpb25cIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLXBpdm90LXRpdGxlXCI+Um93IEdyb3VwczwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtcGl2b3QtbGlzdFwiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCAqbmdGb3I9XCJsZXQgY29sIG9mIGNvbHVtbkRlZnNcIj5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIFtjaGVja2VkXT1cImlzR3JvdXBlZChjb2wpXCIgKGNoYW5nZSk9XCJ0b2dnbGVHcm91cChjb2wpXCIgLz5cbiAgICAgICAgICAgICAgICAgICAge3sgY29sLmhlYWRlck5hbWUgfHwgKGNvbC5maWVsZCArICcnKSB9fVxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLXBpdm90LXNlY3Rpb25cIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLXBpdm90LXRpdGxlXCI+VmFsdWVzPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1waXZvdC1saXN0XCI+XG4gICAgICAgICAgICAgICAgPGxhYmVsICpuZ0Zvcj1cImxldCBjb2wgb2YgY29sdW1uRGVmc1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgW2NoZWNrZWRdPVwiaXNWYWx1ZUNvbChjb2wpXCIgKGNoYW5nZSk9XCJ0b2dnbGVWYWx1ZUNvbChjb2wpXCIgLz5cbiAgICAgICAgICAgICAgICAgICAge3sgY29sLmhlYWRlck5hbWUgfHwgKGNvbC5maWVsZCArICcnKSB9fVxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1maWx0ZXJcIiAqbmdJZj1cIm1lcmdlZENvbHMubGVuZ3RoXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLWZpbHRlci1jZWxsIG9nLWdyaWQtc2VsZWN0XCIgKm5nSWY9XCJzaG93U2VsZWN0aW9uQ29sdW1uXCI+XG4gICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm9nLWdyaWQtYnRuXCIgKGNsaWNrKT1cImNsZWFyRmlsdGVycygpXCI+Q2xlYXI8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtZmlsdGVyLWNlbGxcIiAqbmdGb3I9XCJsZXQgY29sIG9mIG1lcmdlZENvbHM7IHRyYWNrQnk6IHRyYWNrQnlDb2xcIlxuICAgICAgICAgICAgW3N0eWxlLndpZHRoLnB4XT1cImdldENvbFdpZHRoKGNvbClcIj5cbiAgICAgICAgICAgIDxuZy1jb250YWluZXIgW25nU3dpdGNoXT1cImNvbC5maWx0ZXIgfHwgJ3RleHQnXCI+XG4gICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdTd2l0Y2hDYXNlPVwiJ3RleHQnXCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIHBsYWNlaG9sZGVyPVwiRmlsdGVyLi4uXCIgW25nTW9kZWxdPVwiZmlsdGVySW5wdXRzW2NvbC5maWVsZF0/LnZhbHVlIHx8ICcnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uVGV4dEZpbHRlcklucHV0KGNvbCwgJGV2ZW50LCB0cnVlKVwiIC8+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvZy1ncmlkLWZpbHRlci1tb2RlLXJvd1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNlbGVjdCAoY2hhbmdlKT1cIm9uVGV4dE1vZGVDaGFuZ2UoY29sLCAkYW55KCRldmVudC50YXJnZXQpLnZhbHVlKVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJjb250YWluc1wiPkNvbnRhaW5zPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cInN0YXJ0c1dpdGhcIj5TdGFydHMgd2l0aDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJlcXVhbHNcIj5FcXVhbHM8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L25nLWNvbnRhaW5lcj5cblxuICAgICAgICAgICAgICAgIDxkaXYgKm5nU3dpdGNoQ2FzZT1cIidudW1iZXInXCIgY2xhc3M9XCJvZy1ncmlkLWZpbHRlci1yYW5nZVwiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwiTWluXCIgW25nTW9kZWxdPVwiZmlsdGVySW5wdXRzW2NvbC5maWVsZF0/LnZhbHVlIHx8ICcnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uUmFuZ2VJbnB1dChjb2wsICdtaW4nLCAkZXZlbnQpXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJudW1iZXJcIiBkYXRhLW1heCBwbGFjZWhvbGRlcj1cIk1heFwiIFtuZ01vZGVsXT1cImZpbHRlcklucHV0c1tjb2wuZmllbGRdPy52YWx1ZVRvIHx8ICcnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uUmFuZ2VJbnB1dChjb2wsICdtYXgnLCAkZXZlbnQpXCIgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDxkaXYgKm5nU3dpdGNoQ2FzZT1cIidkYXRlJ1wiIGNsYXNzPVwib2ctZ3JpZC1maWx0ZXItcmFuZ2VcIj5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJkYXRlXCIgcGxhY2Vob2xkZXI9XCJGcm9tXCIgW25nTW9kZWxdPVwiZmlsdGVySW5wdXRzW2NvbC5maWVsZF0/LnZhbHVlIHx8ICcnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uUmFuZ2VJbnB1dChjb2wsICdtaW4nLCAkZXZlbnQpXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJkYXRlXCIgZGF0YS1tYXggcGxhY2Vob2xkZXI9XCJUb1wiIFtuZ01vZGVsXT1cImZpbHRlcklucHV0c1tjb2wuZmllbGRdPy52YWx1ZVRvIHx8ICcnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIChuZ01vZGVsQ2hhbmdlKT1cIm9uUmFuZ2VJbnB1dChjb2wsICdtYXgnLCAkZXZlbnQpXCIgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDxpbnB1dCAqbmdTd2l0Y2hEZWZhdWx0IHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJGaWx0ZXIuLi5cIlxuICAgICAgICAgICAgICAgICAgICBbbmdNb2RlbF09XCJmaWx0ZXJJbnB1dHNbY29sLmZpZWxkXT8udmFsdWUgfHwgJydcIiAobmdNb2RlbENoYW5nZSk9XCJvbkZpbHRlckNoYW5nZShjb2wsICRldmVudClcIiAvPlxuICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtYm9keVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwib2ctZ3JpZC1yb3dcIiAqbmdGb3I9XCJsZXQgcm93IG9mIHZpZXdSb3dzOyBsZXQgcmkgPSBpbmRleDsgdHJhY2tCeTogdHJhY2tCeVJvd1wiXG4gICAgICAgICAgICBbY2xhc3Mub2ctZ3JpZC1yb3ctc2VsZWN0ZWRdPVwiaXNSb3dTZWxlY3RlZChyb3cpXCIgW2NsYXNzLm9nLWdyaWQtZ3JvdXAtcm93XT1cImlzR3JvdXBSb3cocm93KVwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtY2VsbCBvZy1ncmlkLXNlbGVjdFwiICpuZ0lmPVwic2hvd1NlbGVjdGlvbkNvbHVtblwiPlxuICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCIhaXNHcm91cFJvdyhyb3cpOyBlbHNlIGdyb3VwVG9nZ2xlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCAqbmdJZj1cInNob3dTZWxlY3Rpb25cIiB0eXBlPVwiY2hlY2tib3hcIiBbY2hlY2tlZF09XCJpc1Jvd1NlbGVjdGVkKHJvdylcIlxuICAgICAgICAgICAgICAgICAgICAgICAgKGNoYW5nZSk9XCJ0b2dnbGVSb3dTZWxlY3Rpb24ocm93KVwiIC8+XG4gICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNncm91cFRvZ2dsZT5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJvZy1ncmlkLXRvZ2dsZVwiIChjbGljayk9XCJ0b2dnbGVHcm91cEV4cGFuZCgkYW55KHJvdykpXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7eyBpc0V4cGFuZGVkKCRhbnkocm93KSkgPyAn4pa+JyA6ICfilrgnIH19XG4gICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm9nLWdyaWQtY2VsbFwiICpuZ0Zvcj1cImxldCBjb2wgb2YgbWVyZ2VkQ29sczsgbGV0IGNpID0gaW5kZXhcIlxuICAgICAgICAgICAgICAgIFtzdHlsZS53aWR0aC5weF09XCJnZXRDb2xXaWR0aChjb2wpXCI+XG4gICAgICAgICAgICAgICAgPG5nLWNvbnRhaW5lciAqbmdJZj1cIiFpc0dyb3VwUm93KHJvdyk7IGVsc2UgZ3JvdXBDZWxsXCI+XG4gICAgICAgICAgICAgICAgICAgIHt7IHJlbmRlckNlbGwoY29sLCAkYW55KHJvdykpIH19XG4gICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgPG5nLXRlbXBsYXRlICNncm91cENlbGw+XG4gICAgICAgICAgICAgICAgICAgIDxuZy1jb250YWluZXIgKm5nSWY9XCJjaSA9PT0gMDsgZWxzZSBhZ2dDZWxsXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm9nLWdyaWQtaW5kZW50XCIgW3N0eWxlLnBhZGRpbmdMZWZ0LnB4XT1cIigkYW55KHJvdykubGV2ZWwgKiAxNClcIj48L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3Ryb25nPnt7ICRhbnkocm93KS5rZXkgPz8gJyhibGFuayknIH19PC9zdHJvbmc+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm9nLWdyaWQtY291bnRcIj4oe3sgJGFueShyb3cpLmNvdW50IH19KTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPC9uZy1jb250YWluZXI+XG4gICAgICAgICAgICAgICAgICAgIDxuZy10ZW1wbGF0ZSAjYWdnQ2VsbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIHt7IGdldEdyb3VwQWdnKCRhbnkocm93KSwgY29sKSB9fVxuICAgICAgICAgICAgICAgICAgICA8L25nLXRlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDwvbmctdGVtcGxhdGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG48L2Rpdj4iXX0=