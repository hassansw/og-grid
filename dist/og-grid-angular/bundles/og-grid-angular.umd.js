(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('og-grid-core'), require('@angular/common'), require('@angular/forms')) :
    typeof define === 'function' && define.amd ? define('og-grid-angular', ['exports', '@angular/core', 'og-grid-core', '@angular/common', '@angular/forms'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["og-grid-angular"] = {}, global.ng.core, global.ogGridCore, global.ng.common, global.ng.forms));
})(this, (function (exports, i0, ogGridCore, i1, i2) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var i0__namespace = /*#__PURE__*/_interopNamespace(i0);
    var i1__namespace = /*#__PURE__*/_interopNamespace(i1);
    var i2__namespace = /*#__PURE__*/_interopNamespace(i2);

    var OgGridComponent = /** @class */ (function () {
        function OgGridComponent(cdr, zone, host) {
            var _this = this;
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
            this.trackByRow = function (_i, row) {
                if (_this.isGroupRow(row))
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
                    var csv = ogGridCore.toCsv(self.getLeafRows(), self.mergedCols);
                    downloadTextFile(csv, name, 'text/csv;charset=utf-8;');
                },
            };
        }
        OgGridComponent.prototype.ngOnInit = function () {
            this.setColumns();
        };
        OgGridComponent.prototype.setColumns = function () {
            if (!isArrayValid(this.columnDefs, 0) && isArrayValid(this.rowData, 0)) {
                this.columnDefs = this.buildColumnDefs(this.rowData);
            }
        };
        OgGridComponent.prototype.inferType = function (val) {
            if (val === null || val === undefined)
                return 'text';
            if (typeof val === 'number')
                return 'number';
            var d = new Date(val);
            if (!isNaN(d.getTime()) && /[T:\-\/]/.test(String(val)))
                return 'date';
            if (!isNaN(Number(val)) && val !== '')
                return 'number';
            return 'text';
        };
        OgGridComponent.prototype.buildColumnDefs = function (data) {
            var _this = this;
            if (!data.length)
                return [];
            return Object.keys(data[0]).map(function (k) {
                var _a;
                var sample = (_a = data.find(function (r) { return r[k] != null; })) === null || _a === void 0 ? void 0 : _a[k];
                var t = _this.inferType(sample);
                var col = {
                    field: k, headerName: _this.generateHeaderFromKey(k), filter: true, sortable: true, resizable: true,
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
        };
        OgGridComponent.prototype.generateHeaderFromKey = function (key) {
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
                .map(function (word) { return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(); })
                .join(' ');
        };
        OgGridComponent.prototype.onDocClick = function (ev) {
            if (!this.menuOpenFor)
                return;
            if (this.host && this.host.nativeElement.contains(ev.target)) {
                // clicks inside component: ignore unless on menu toggle handled elsewhere
                return;
            }
            this.menuOpenFor = null;
            this.cdr.markForCheck();
        };
        OgGridComponent.prototype.ngOnChanges = function (changes) {
            this.setColumns();
            if (changes.columnDefs ||
                changes.rowData ||
                changes.options) {
                this.recompute();
            }
        };
        OgGridComponent.prototype.recompute = function () {
            var _this = this;
            var def = (this.options && this.options.defaultColDef) || {};
            this.mergedCols = (this.columnDefs || []).map(function (c) {
                return ogGridCore.mergeColDef(c, def);
            });
            var filtered = ogGridCore.filterRows(this.rowData || [], this.mergedCols, this.filterModel);
            var sorted = ogGridCore.sortRows(filtered, this.mergedCols, this.sortModel);
            if (this.pivotModel.enabled && this.pivotModel.pivotCol && this.pivotModel.valueCols.length) {
                var pivoted = ogGridCore.pivotRows(sorted, this.mergedCols, this.pivotModel, this.expandedGroups);
                // replace columns with dynamic pivot cols only (no original data cols for now)
                this.viewRows = pivoted.rows;
                this.mergedCols = pivoted.dynamicCols;
                this.expandedGroups.clear();
            }
            else if (this.groupModel.length) {
                var aggModel = this.buildAggModel();
                var grouped = ogGridCore.groupAndFlattenRows(sorted, this.mergedCols, this.groupModel, aggModel, this.expandedGroups);
                // Ensure new groups are expanded by default
                grouped.paths.forEach(function (p) { return _this.expandedGroups.add(p); });
                this.viewRows = grouped.flat;
            }
            else {
                this.viewRows = sorted;
                this.expandedGroups.clear();
            }
            // Reset selection if it would become invalid
            var next = new Set();
            var leaves = this.getLeafRows();
            this.selected.forEach(function (row) {
                if (leaves.indexOf(row) >= 0)
                    next.add(row);
            });
            this.selected = next;
        };
        // ---- UI actions ----
        OgGridComponent.prototype.onHeaderClick = function (col, ev) {
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
        };
        OgGridComponent.prototype.getSortIndicator = function (col) {
            if (!this.sortModel.length)
                return '';
            var idx = this.sortModel.findIndex(function (m) { return m.colId === String(col.field); });
            if (idx === -1)
                return '';
            var mark = this.sortModel[idx].sort === 'asc' ? '▲' : '▼';
            return this.sortModel.length > 1 ? mark + ' ' + (idx + 1) : mark;
        };
        OgGridComponent.prototype.isRowSelected = function (row) {
            if (this.isGroupRow(row))
                return false;
            return this.selected.has(row);
        };
        OgGridComponent.prototype.toggleRowSelection = function (row, ev) {
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
        };
        OgGridComponent.prototype.toggleAll = function () {
            var _this = this;
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
            leaves.forEach(function (r) { return _this.selected.add(r); });
        };
        Object.defineProperty(OgGridComponent.prototype, "allSelected", {
            get: function () {
                if (!this.showSelectionColumn)
                    return false;
                var leaves = this.getLeafRows();
                return leaves.length > 0 && this.selected.size === leaves.length;
            },
            enumerable: false,
            configurable: true
        });
        OgGridComponent.prototype.renderCell = function (col, row) {
            var value = ogGridCore.getCellValue(col, row);
            return col.valueFormatter ? col.valueFormatter(value, row) : value;
        };
        Object.defineProperty(OgGridComponent.prototype, "showSelectionColumn", {
            get: function () {
                return this.options.showSelection !== false;
            },
            enumerable: false,
            configurable: true
        });
        OgGridComponent.prototype.onFilterChange = function (col, value, valueTo) {
            var colId = String(col.field);
            var mode = this.filterModes[colId] || col.filterMatchMode || 'contains';
            var next = this.filterModel.filter(function (f) {
                return f.colId !== colId;
            });
            var hasRange = valueTo !== undefined && valueTo !== null && valueTo !== '';
            var hasValue = value !== undefined && value !== null && value !== '';
            if (hasValue || hasRange) {
                var type = typeof col.filter === 'string' ? col.filter : undefined;
                next.push({ colId: colId, type: type, value: value, valueTo: valueTo, matchMode: mode });
            }
            this.filterModel = next;
            this.recompute();
        };
        OgGridComponent.prototype.onRangeInput = function (col, part, value) {
            var colId = String(col.field);
            var current = this.filterInputs[colId] || {};
            if (part === 'min')
                current.value = value;
            else
                current.valueTo = value;
            this.filterInputs[colId] = current;
            this.onFilterChange(col, current.value, current.valueTo);
        };
        OgGridComponent.prototype.onTextFilterInput = function (col, raw, instant) {
            var _this = this;
            var colId = String(col.field);
            this.filterInputs[colId] = this.filterInputs[colId] || {};
            this.filterInputs[colId].value = raw;
            if (instant) {
                this.onFilterChange(col, raw, undefined);
                return;
            }
            // debounce per column
            clearTimeout(this.filterDebounce[colId]);
            this.filterDebounce[colId] = setTimeout(function () {
                _this.onFilterChange(col, raw, undefined);
            }, 150);
        };
        OgGridComponent.prototype.onTextModeChange = function (col, mode) {
            var colId = String(col.field);
            this.filterModes[colId] = mode;
            // Reapply current filter value with new mode
            var existing = this.filterModel.find(function (f) { return f.colId === colId; });
            var val = existing ? existing.value : '';
            this.onFilterChange(col, val, existing ? existing.valueTo : undefined);
        };
        OgGridComponent.prototype.clearFilters = function () {
            this.filterModel = [];
            this.filterInputs = {};
            this.filterModes = {};
            this.recompute();
            this.cdr.markForCheck();
        };
        OgGridComponent.prototype.clearGroups = function () {
            this.groupModel = [];
            this.expandedGroups.clear();
            this.recompute();
        };
        OgGridComponent.prototype.toggleGroup = function (col) {
            var colId = String(col.field);
            var idx = this.groupModel.findIndex(function (g) { return g.colId === colId; });
            var next = this.groupModel.slice();
            if (idx === -1)
                next.push({ colId: colId });
            else
                next.splice(idx, 1);
            this.groupModel = next;
            if (!next.length)
                this.expandedGroups.clear();
            this.recompute();
        };
        OgGridComponent.prototype.isGrouped = function (col) {
            return this.groupModel.some(function (g) { return g.colId === String(col.field); });
        };
        OgGridComponent.prototype.isGroupRow = function (row) {
            return !!row.__group;
        };
        OgGridComponent.prototype.isExpanded = function (row) {
            return this.expandedGroups.has(row.path);
        };
        OgGridComponent.prototype.toggleGroupExpand = function (row) {
            if (this.expandedGroups.has(row.path))
                this.expandedGroups.delete(row.path);
            else
                this.expandedGroups.add(row.path);
            this.recompute();
        };
        OgGridComponent.prototype.getGroupAgg = function (row, col) {
            var _a;
            return (_a = row.agg[String(col.field)]) !== null && _a !== void 0 ? _a : '';
        };
        OgGridComponent.prototype.getLeafRows = function () {
            var _this = this;
            return this.viewRows.filter(function (r) { return !_this.isGroupRow(r); });
        };
        OgGridComponent.prototype.buildAggModel = function () {
            var sample = (this.rowData && this.rowData.length) ? this.rowData[0] : null;
            return this.mergedCols
                .map(function (c) {
                var agg = c.aggFunc;
                if (!agg && sample) {
                    var v = ogGridCore.getCellValue(c, sample);
                    agg = typeof v === 'number' ? 'sum' : 'count';
                }
                if (!agg)
                    agg = 'count';
                return { colId: String(c.field), aggFunc: agg };
            });
        };
        OgGridComponent.prototype.trackByCol = function (_i, col) {
            return String(col.field);
        };
        OgGridComponent.prototype.isValueCol = function (col) {
            return this.pivotModel.valueCols.some(function (v) { return v.colId === String(col.field); });
        };
        OgGridComponent.prototype.toggleValueCol = function (col) {
            var id = String(col.field);
            var next = this.pivotModel.valueCols.slice();
            var idx = next.findIndex(function (v) { return v.colId === id; });
            if (idx === -1)
                next.push({ colId: id, aggFunc: col.aggFunc || 'sum' });
            else
                next.splice(idx, 1);
            this.pivotModel = Object.assign({}, this.pivotModel, { valueCols: next });
            this.recompute();
        };
        OgGridComponent.prototype.onPivotToggle = function (enabled) {
            this.pivotModel = Object.assign({}, this.pivotModel, { enabled: !!enabled });
            this.recompute();
        };
        OgGridComponent.prototype.onPivotConfigChange = function (val) {
            // Ensure undefined when cleared
            if (val === '' || val === null)
                val = undefined;
            this.pivotModel = Object.assign({}, this.pivotModel, { pivotCol: val });
            this.recompute();
        };
        OgGridComponent.prototype.getColWidth = function (col) {
            var _a;
            var id = String(col.field);
            return (_a = this.colWidths[id]) !== null && _a !== void 0 ? _a : (col.width || 160);
        };
        OgGridComponent.prototype.toggleMenu = function (col) {
            var id = String(col.field);
            this.menuOpenFor = this.menuOpenFor === id ? null : id;
            this.cdr.markForCheck();
        };
        OgGridComponent.prototype.closeMenu = function () {
            this.menuOpenFor = null;
            this.cdr.markForCheck();
        };
        OgGridComponent.prototype.sortAsc = function (col) {
            var id = String(col.field);
            var next = this.sortModel.filter(function (m) { return m.colId !== id; });
            next.unshift({ colId: id, sort: 'asc' });
            this.sortModel = next;
            this.recompute();
            this.closeMenu();
        };
        OgGridComponent.prototype.sortDesc = function (col) {
            var id = String(col.field);
            var next = this.sortModel.filter(function (m) { return m.colId !== id; });
            next.unshift({ colId: id, sort: 'desc' });
            this.sortModel = next;
            this.recompute();
            this.closeMenu();
        };
        OgGridComponent.prototype.clearSort = function (col) {
            var id = String(col.field);
            this.sortModel = this.sortModel.filter(function (m) { return m.colId !== id; });
            this.recompute();
            this.closeMenu();
        };
        OgGridComponent.prototype.clearFilterFor = function (col) {
            var id = String(col.field);
            this.filterModel = this.filterModel.filter(function (f) { return f.colId !== id; });
            delete this.filterInputs[id];
            this.recompute();
            this.closeMenu();
        };
        OgGridComponent.prototype.onResizeStart = function (ev, col) {
            var _this = this;
            ev.stopPropagation();
            ev.preventDefault();
            var startX = ev.clientX;
            var id = String(col.field);
            var startW = this.getColWidth(col);
            var minW = col.minWidth || 60;
            var maxW = col.maxWidth || 600;
            this.zone.runOutsideAngular(function () {
                var pending = false;
                var nextWidth = startW;
                var move = function (e) {
                    var delta = e.clientX - startX;
                    nextWidth = Math.max(minW, Math.min(maxW, startW + delta));
                    if (!pending) {
                        pending = true;
                        _this.resizeFrame = requestAnimationFrame(function () {
                            var _c;
                            pending = false;
                            _this.colWidths = Object.assign({}, _this.colWidths, (_c = {}, _c[id] = nextWidth, _c));
                            _this.cdr.markForCheck();
                        });
                    }
                };
                var up = function () {
                    if (_this.resizeFrame != null) {
                        cancelAnimationFrame(_this.resizeFrame);
                        _this.resizeFrame = null;
                    }
                    _this.resizingCol = null;
                    document.body.style.cursor = '';
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                    _this.zone.run(function () { return _this.cdr.markForCheck(); });
                };
                _this.resizingCol = id;
                document.body.style.cursor = 'col-resize';
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up, { once: true });
                _this.zone.run(function () { return _this.cdr.markForCheck(); });
            });
        };
        OgGridComponent.prototype.getFilterValue = function (col, part) {
            if (part === void 0) { part = 'min'; }
            var _a, _b;
            var colId = String(col.field);
            // Range values cached separately
            if (part === 'min' || part === 'max') {
                var cached = this.filterInputs[colId];
                if (cached)
                    return part === 'min' ? cached.value : cached.valueTo;
            }
            // For text / single-value filters, derive from model
            var hit = this.filterModel.find(function (f) { return f.colId === colId; });
            if (!hit)
                return '';
            return part === 'min' ? (_a = hit.value) !== null && _a !== void 0 ? _a : '' : (_b = hit.valueTo) !== null && _b !== void 0 ? _b : '';
        };
        return OgGridComponent;
    }());
    OgGridComponent.ɵfac = i0__namespace.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0__namespace, type: OgGridComponent, deps: [{ token: i0__namespace.ChangeDetectorRef }, { token: i0__namespace.NgZone }, { token: i0__namespace.ElementRef }], target: i0__namespace.ɵɵFactoryTarget.Component });
    OgGridComponent.ɵcmp = i0__namespace.ɵɵngDeclareComponent({ minVersion: "12.0.0", version: "12.2.17", type: OgGridComponent, selector: "og-grid", inputs: { columnDefs: "columnDefs", rowData: "rowData", options: "options", showSelection: "showSelection" }, host: { listeners: { "document:click": "onDocClick($event)" } }, usesOnChanges: true, ngImport: i0__namespace, template: "<div class=\"og-grid-root\">\n    <div class=\"og-grid-groupbar\" *ngIf=\"mergedCols.length\">\n        <div class=\"og-grid-actions\">\n            <button type=\"button\" class=\"og-grid-btn og-grid-pivot-btn\" (click)=\"showPivotPanel = !showPivotPanel\">\n                {{ showPivotPanel ? 'Hide Pivot' : 'Show Pivot' }}\n            </button>\n        </div>\n        <div class=\"og-grid-group-label\">Group by:</div>\n        <div class=\"og-grid-group-pills\">\n            <label class=\"og-grid-pill\" *ngFor=\"let col of mergedCols\">\n                <input type=\"checkbox\" [checked]=\"isGrouped(col)\" (change)=\"toggleGroup(col)\" />\n                <span>{{ col.headerName || (col.field + '') }}</span>\n            </label>\n            <button type=\"button\" class=\"og-grid-btn\" (click)=\"clearGroups()\">Clear</button>\n        </div>\n    </div>\n\n    <div class=\"og-grid-header\">\n        <div class=\"og-grid-header-cell og-grid-select\" *ngIf=\"showSelectionColumn && showSelection \">\n            <input type=\"checkbox\" [checked]=\"allSelected\" (change)=\"toggleAll()\" />\n        </div>\n\n        <div class=\"og-grid-header-cell\" *ngFor=\"let col of mergedCols; let ci = index; trackBy: trackByCol\"\n            [style.width.px]=\"getColWidth(col)\" (click)=\"onHeaderClick(col, $event)\"\n            [class.og-grid-sortable]=\"!!col.sortable\" title=\"Click to sort\">\n            <span class=\"og-grid-header-title\">\n                {{ col.headerName || (col.field + '') }}\n            </span>\n            <span class=\"og-grid-sort-ind\">{{ getSortIndicator(col) }}</span>\n            <span class=\"og-grid-header-menu\" (click)=\"toggleMenu(col); $event.stopPropagation()\">\n                \u22EE\n            </span>\n            <div class=\"og-grid-menu\" *ngIf=\"menuOpenFor === (col.field + '')\" (click)=\"$event.stopPropagation()\">\n                <button type=\"button\" (click)=\"sortAsc(col)\">Sort Ascending</button>\n                <button type=\"button\" (click)=\"sortDesc(col)\">Sort Descending</button>\n                <button type=\"button\" (click)=\"clearSort(col)\">Clear Sort</button>\n                <hr />\n                <button type=\"button\" (click)=\"clearFilterFor(col)\">Clear Filter</button>\n                <button type=\"button\" (click)=\"clearFilters()\">Clear All Filters</button>\n            </div>\n            <span class=\"og-grid-resizer\" (mousedown)=\"onResizeStart($event, col)\"></span>\n        </div>\n    </div>\n\n    <div class=\"og-grid-pivot-panel\" *ngIf=\"showPivotPanel\">\n        <div class=\"og-grid-pivot-toggle\">\n            <label><input type=\"checkbox\" [(ngModel)]=\"pivotModel.enabled\" (ngModelChange)=\"onPivotToggle($event)\" />\n                Pivot Mode</label>\n        </div>\n        <div class=\"og-grid-pivot-section\">\n            <div class=\"og-grid-pivot-title\">Pivot Column</div>\n            <select [(ngModel)]=\"pivotModel.pivotCol\" (ngModelChange)=\"onPivotConfigChange($event)\">\n                <option [ngValue]=\"undefined\">None</option>\n                <option *ngFor=\"let col of columnDefs\" [ngValue]=\"col.field\">{{ col.headerName || (col.field + '') }}\n                </option>\n            </select>\n        </div>\n        <div class=\"og-grid-pivot-section\">\n            <div class=\"og-grid-pivot-title\">Row Groups</div>\n            <div class=\"og-grid-pivot-list\">\n                <label *ngFor=\"let col of columnDefs\">\n                    <input type=\"checkbox\" [checked]=\"isGrouped(col)\" (change)=\"toggleGroup(col)\" />\n                    {{ col.headerName || (col.field + '') }}\n                </label>\n            </div>\n        </div>\n        <div class=\"og-grid-pivot-section\">\n            <div class=\"og-grid-pivot-title\">Values</div>\n            <div class=\"og-grid-pivot-list\">\n                <label *ngFor=\"let col of columnDefs\">\n                    <input type=\"checkbox\" [checked]=\"isValueCol(col)\" (change)=\"toggleValueCol(col)\" />\n                    {{ col.headerName || (col.field + '') }}\n                </label>\n            </div>\n        </div>\n    </div>\n\n    <div class=\"og-grid-filter\" *ngIf=\"mergedCols.length\">\n        <div class=\"og-grid-filter-cell og-grid-select\" *ngIf=\"showSelectionColumn\">\n            <button type=\"button\" class=\"og-grid-btn\" (click)=\"clearFilters()\">Clear</button>\n        </div>\n\n        <div class=\"og-grid-filter-cell\" *ngFor=\"let col of mergedCols; trackBy: trackByCol\"\n            [style.width.px]=\"getColWidth(col)\">\n            <ng-container [ngSwitch]=\"col.filter || 'text'\">\n                <ng-container *ngSwitchCase=\"'text'\">\n                    <input type=\"text\" placeholder=\"Filter...\" [ngModel]=\"filterInputs[col.field]?.value || ''\"\n                        (ngModelChange)=\"onTextFilterInput(col, $event, true)\" />\n                    <div class=\"og-grid-filter-mode-row\">\n                        <select (change)=\"onTextModeChange(col, $any($event.target).value)\">\n                            <option value=\"contains\">Contains</option>\n                            <option value=\"startsWith\">Starts with</option>\n                            <option value=\"equals\">Equals</option>\n                        </select>\n                    </div>\n                </ng-container>\n\n                <div *ngSwitchCase=\"'number'\" class=\"og-grid-filter-range\">\n                    <input type=\"number\" placeholder=\"Min\" [ngModel]=\"filterInputs[col.field]?.value || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'min', $event)\" />\n                    <input type=\"number\" data-max placeholder=\"Max\" [ngModel]=\"filterInputs[col.field]?.valueTo || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'max', $event)\" />\n                </div>\n\n                <div *ngSwitchCase=\"'date'\" class=\"og-grid-filter-range\">\n                    <input type=\"date\" placeholder=\"From\" [ngModel]=\"filterInputs[col.field]?.value || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'min', $event)\" />\n                    <input type=\"date\" data-max placeholder=\"To\" [ngModel]=\"filterInputs[col.field]?.valueTo || ''\"\n                        (ngModelChange)=\"onRangeInput(col, 'max', $event)\" />\n                </div>\n\n                <input *ngSwitchDefault type=\"text\" placeholder=\"Filter...\"\n                    [ngModel]=\"filterInputs[col.field]?.value || ''\" (ngModelChange)=\"onFilterChange(col, $event)\" />\n            </ng-container>\n        </div>\n    </div>\n\n    <div class=\"og-grid-body\">\n        <div class=\"og-grid-row\" *ngFor=\"let row of viewRows; let ri = index; trackBy: trackByRow\"\n            [class.og-grid-row-selected]=\"isRowSelected(row)\" [class.og-grid-group-row]=\"isGroupRow(row)\">\n            <div class=\"og-grid-cell og-grid-select\" *ngIf=\"showSelectionColumn\">\n                <ng-container *ngIf=\"!isGroupRow(row); else groupToggle\">\n                    <input *ngIf=\"showSelection\" type=\"checkbox\" [checked]=\"isRowSelected(row)\"\n                        (change)=\"toggleRowSelection(row)\" />\n                </ng-container>\n                <ng-template #groupToggle>\n                    <button type=\"button\" class=\"og-grid-toggle\" (click)=\"toggleGroupExpand($any(row))\">\n                        {{ isExpanded($any(row)) ? '\u25BE' : '\u25B8' }}\n                    </button>\n                </ng-template>\n            </div>\n\n            <div class=\"og-grid-cell\" *ngFor=\"let col of mergedCols; let ci = index\"\n                [style.width.px]=\"getColWidth(col)\">\n                <ng-container *ngIf=\"!isGroupRow(row); else groupCell\">\n                    {{ renderCell(col, $any(row)) }}\n                </ng-container>\n                <ng-template #groupCell>\n                    <ng-container *ngIf=\"ci === 0; else aggCell\">\n                        <span class=\"og-grid-indent\" [style.paddingLeft.px]=\"($any(row).level * 14)\"></span>\n                        <strong>{{ $any(row).key ?? '(blank)' }}</strong>\n                        <span class=\"og-grid-count\">({{ $any(row).count }})</span>\n                    </ng-container>\n                    <ng-template #aggCell>\n                        {{ getGroupAgg($any(row), col) }}\n                    </ng-template>\n                </ng-template>\n            </div>\n        </div>\n    </div>\n</div>", styles: [".og-grid-root{border:1px solid #ddd;font-family:Arial,Helvetica,sans-serif;font-size:13px;position:relative;padding-right:12px;overflow:auto}.og-grid-root.resizing,.og-grid-root.resizing *{cursor:col-resize!important;-webkit-user-select:none!important;user-select:none!important}.og-grid-header,.og-grid-filter,.og-grid-groupbar,.og-grid-row{display:flex;align-items:center;min-width:max-content}.og-grid-header{position:relative;-webkit-user-select:none;user-select:none;border-bottom:1px solid #ddd;background:#f7f7f7;font-weight:600;overflow:visible}.og-grid-filter{border-bottom:1px solid #eee;background:#fbfbfb;align-items:flex-start}.og-grid-groupbar{padding:6px 8px;border-bottom:1px solid #eee;background:#fdfdfd;grid-gap:8px;gap:8px;justify-content:flex-start;align-items:center}.og-grid-group-label{font-weight:600;margin-right:6px;white-space:nowrap}.og-grid-group-pills{display:flex;flex-wrap:wrap;grid-gap:6px;gap:6px}.og-grid-actions{display:flex;grid-gap:6px;gap:6px;align-items:center}.og-grid-pill{display:inline-flex;align-items:center;grid-gap:4px;gap:4px;padding:2px 6px;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:12px;cursor:pointer}.og-grid-pill input{margin:0}.og-grid-header-cell,.og-grid-filter-cell,.og-grid-cell{position:relative;flex:0 0 auto;padding:6px 8px;border-right:1px solid #eee;white-space:nowrap;overflow:visible;text-overflow:ellipsis;box-sizing:border-box;display:flex;justify-content:space-between}.og-grid-header-cell:last-child,.og-grid-filter-cell:last-child,.og-grid-cell:last-child{border-right:none}.og-grid-sortable{cursor:pointer}.og-grid-sort-ind{margin-left:6px;font-size:11px}.og-grid-header-title{display:inline-block;max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis;vertical-align:middle}.og-grid-header-menu{margin-left:6px;cursor:pointer;position:relative;-webkit-user-select:none;user-select:none}.og-grid-menu{position:absolute;top:calc(100% + 4px);right:0;left:auto;background:#fff;border:1px solid #ddd;box-shadow:0 4px 10px #0000001f;min-width:180px;max-width:220px;display:flex;flex-direction:column;z-index:50;padding:6px 0}.og-grid-menu button{width:100%;padding:6px 10px;text-align:left;background:none;border:none;cursor:pointer;white-space:nowrap}.og-grid-menu button:hover{background:#f5f5f5}.og-grid-menu hr{margin:4px 0;border:none;border-top:1px solid #eee}.og-grid-resizer{position:absolute;top:0;right:0;width:8px;cursor:col-resize;-webkit-user-select:none;user-select:none;height:100%;background:transparent}.og-grid-resizer:hover{background:rgba(0,0,0,.06)}.og-grid-header-cell,.og-grid-filter-cell,.og-grid-cell{box-sizing:border-box}.og-grid-filter-cell{display:flex;flex-direction:column;grid-gap:4px;gap:4px}.og-grid-filter .og-grid-select{flex:0 0 36px;width:36px;padding:6px;align-items:center}.og-grid-filter .og-grid-select .og-grid-btn{width:auto;padding:4px 6px}.og-grid-filter-cell input,.og-grid-filter-cell select{width:100%;box-sizing:border-box;padding:4px 6px;font-size:12px}.og-grid-filter-mode-row{margin-top:4px}.og-grid-filter-mode-row select{width:100%;padding:4px 6px;font-size:12px}.og-grid-filter-range{display:flex;grid-gap:4px;gap:4px}.og-grid-filter-range input{width:100%}.og-grid-btn{padding:4px 8px;font-size:12px;border:1px solid #ccc;background:#fff;cursor:pointer;box-sizing:border-box}.og-grid-btn:hover{background:#f1f1f1}.og-grid-pivot-btn{border-color:#0f62fe;color:#0f62fe}.og-grid-pivot-btn:hover{background:#e8f0ff}.og-grid-toggle{border:1px solid #ccc;background:#fff;padding:2px 4px;cursor:pointer;font-size:12px}.og-grid-toggle:hover{background:#f5f5f5}.og-grid-body{max-height:420px;overflow:auto;min-width:max-content}.og-grid-row{border-bottom:1px solid #f1f1f1}.og-grid-group-row{background:#f6f8fb;font-weight:600}.og-grid-row:hover{background:#fafafa}.og-grid-row-selected{background:#e9f2ff}.og-grid-indent{display:inline-block;width:0}.og-grid-count{margin-left:6px;color:#666;font-weight:400}.og-grid-select{width:36px;flex:0 0 36px;display:flex;justify-content:center}.og-grid-pivot-panel{position:fixed;top:72px;right:12px;width:260px;max-height:90vh;background:#fff;border:1px solid #e2e2e2;box-shadow:0 8px 24px #0000001f;border-radius:8px;padding:10px 12px;overflow:auto;z-index:90}.og-grid-pivot-toggle{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:600}.og-grid-pivot-section{margin-bottom:12px}.og-grid-pivot-title{font-weight:600;margin-bottom:6px;color:#333}.og-grid-pivot-list{display:grid;grid-template-columns:1fr;grid-gap:6px;gap:6px}.og-grid-pivot-list label{display:flex;align-items:center;grid-gap:6px;gap:6px;padding:4px 6px;border:1px solid #eee;border-radius:4px;background:#fafafa}\n"], directives: [{ type: i1__namespace.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { type: i1__namespace.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { type: i2__namespace.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { type: i2__namespace.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { type: i2__namespace.NgModel, selector: "[ngModel]:not([formControlName]):not([formControl])", inputs: ["name", "disabled", "ngModel", "ngModelOptions"], outputs: ["ngModelChange"], exportAs: ["ngModel"] }, { type: i2__namespace.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { type: i2__namespace.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { type: i2__namespace.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { type: i1__namespace.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { type: i1__namespace.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { type: i2__namespace.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { type: i2__namespace.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { type: i1__namespace.NgSwitchDefault, selector: "[ngSwitchDefault]" }], changeDetection: i0__namespace.ChangeDetectionStrategy.OnPush });
    i0__namespace.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0__namespace, type: OgGridComponent, decorators: [{
                type: i0.Component,
                args: [{
                        selector: 'og-grid',
                        templateUrl: './og-grid.component.html',
                        styleUrls: ['./og-grid.component.scss'],
                        changeDetection: i0.ChangeDetectionStrategy.OnPush,
                    }]
            }], ctorParameters: function () { return [{ type: i0__namespace.ChangeDetectorRef }, { type: i0__namespace.NgZone }, { type: i0__namespace.ElementRef }]; }, propDecorators: { columnDefs: [{
                    type: i0.Input
                }], rowData: [{
                    type: i0.Input
                }], options: [{
                    type: i0.Input
                }], showSelection: [{
                    type: i0.Input
                }], onDocClick: [{
                    type: i0.HostListener,
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
    var isArrayValid = function ($array, $length) {
        return $array && $array.length > $length ? true : false;
    };

    var OgGridModule = /** @class */ (function () {
        function OgGridModule() {
        }
        return OgGridModule;
    }());
    OgGridModule.ɵfac = i0__namespace.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0__namespace, type: OgGridModule, deps: [], target: i0__namespace.ɵɵFactoryTarget.NgModule });
    OgGridModule.ɵmod = i0__namespace.ɵɵngDeclareNgModule({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0__namespace, type: OgGridModule, declarations: [OgGridComponent], imports: [i1.CommonModule, i2.FormsModule], exports: [OgGridComponent] });
    OgGridModule.ɵinj = i0__namespace.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0__namespace, type: OgGridModule, imports: [[i1.CommonModule, i2.FormsModule]] });
    i0__namespace.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "12.2.17", ngImport: i0__namespace, type: OgGridModule, decorators: [{
                type: i0.NgModule,
                args: [{
                        declarations: [OgGridComponent],
                        imports: [i1.CommonModule, i2.FormsModule],
                        exports: [OgGridComponent],
                    }]
            }] });

    /**
     * Generated bundle index. Do not edit.
     */

    exports.OgGridComponent = OgGridComponent;
    exports.OgGridModule = OgGridModule;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=og-grid-angular.umd.js.map
