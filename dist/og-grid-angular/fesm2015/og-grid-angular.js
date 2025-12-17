import * as i0 from '@angular/core';
import { Component, ChangeDetectionStrategy, Input, HostListener, NgModule } from '@angular/core';
import { toCsv, mergeColDef, filterRows, sortRows, pivotRows, groupAndFlattenRows, getCellValue } from 'og-grid-core';
import * as i1 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i2 from '@angular/forms';
import { FormsModule } from '@angular/forms';

class OgGridComponent {
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

class OgGridModule {
}
OgGridModule.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0, type: OgGridModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule });
OgGridModule.ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0, type: OgGridModule, declarations: [OgGridComponent], imports: [CommonModule, FormsModule], exports: [OgGridComponent] });
OgGridModule.ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0, type: OgGridModule, imports: [[CommonModule, FormsModule]] });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0, type: OgGridModule, decorators: [{
            type: NgModule,
            args: [{
                    declarations: [OgGridComponent],
                    imports: [CommonModule, FormsModule],
                    exports: [OgGridComponent],
                }]
        }] });

/**
 * Generated bundle index. Do not edit.
 */

export { OgGridComponent, OgGridModule };
//# sourceMappingURL=og-grid-angular.js.map
