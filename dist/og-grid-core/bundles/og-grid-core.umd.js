(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define('og-grid-core', ['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["og-grid-core"] = {}));
})(this, (function (exports) { 'use strict';

    function mergeColDef(col, defaultColDef) {
        var base = defaultColDef || {};
        // Shallow merge is enough for the current scope.
        return Object.assign({}, base, col);
    }
    function getCellValue(col, row) {
        var _a;
        if (!col)
            return undefined;
        if (col.valueGetter)
            return col.valueGetter(row);
        var field = col.field;
        return (_a = row) === null || _a === void 0 ? void 0 : _a[field];
    }
    function sortRows(rows, cols, sortModel) {
        if (!rows || rows.length === 0)
            return [];
        if (!sortModel || sortModel.length === 0)
            return rows.slice();
        var colMap = {};
        cols.forEach(function (c) {
            colMap[String(c.field)] = c;
        });
        var active = sortModel
            .map(function (m) {
            var col = colMap[m.colId];
            if (!col || !col.sortable)
                return null;
            var dir = m.sort === 'desc' ? -1 : 1;
            var cmp = col.comparator ||
                function (a, b) {
                    if (a == null && b == null)
                        return 0;
                    if (a == null)
                        return -1;
                    if (b == null)
                        return 1;
                    if (typeof a === 'number' && typeof b === 'number')
                        return a - b;
                    var as = String(a);
                    var bs = String(b);
                    if (as < bs)
                        return -1;
                    if (as > bs)
                        return 1;
                    return 0;
                };
            return { col: col, dir: dir, cmp: cmp };
        })
            .filter(Boolean);
        if (active.length === 0)
            return rows.slice();
        var clone = rows.slice();
        clone.sort(function (a, b) {
            for (var i = 0; i < active.length; i++) {
                var s = active[i];
                var av = getCellValue(s.col, a);
                var bv = getCellValue(s.col, b);
                var res = s.cmp(av, bv) * s.dir;
                if (res !== 0)
                    return res;
            }
            return 0;
        });
        return clone;
    }
    function filterRows(rows, cols, filterModel) {
        if (!rows || rows.length === 0)
            return [];
        if (!filterModel || filterModel.length === 0)
            return rows.slice();
        var colMap = {};
        cols.forEach(function (c) {
            colMap[String(c.field)] = c;
        });
        return rows.filter(function (row) {
            for (var i = 0; i < filterModel.length; i++) {
                var f = filterModel[i];
                var col = colMap[f.colId];
                if (!col)
                    continue;
                var cell = getCellValue(col, row);
                // Custom predicate wins
                if (typeof col.filter === 'function') {
                    if (!col.filter(cell, row))
                        return false;
                    continue;
                }
                var type = f.type || (typeof cell === 'number' ? 'number' : 'text');
                var comparator = col.filterComparator || defaultFilterComparator;
                var pass = comparator(cell, f.value, f.valueTo, type, f.matchMode || col.filterMatchMode);
                if (!pass)
                    return false;
            }
            return true;
        });
    }
    function defaultFilterComparator(cellValue, filterValue, filterValueTo, type, matchMode) {
        if (type === 'number') {
            if (filterValue == null && filterValueTo == null)
                return true;
            var num = numberVal(cellValue);
            if (num == null)
                return false;
            var from = numberVal(filterValue);
            var to = numberVal(filterValueTo);
            if (from != null && num < from)
                return false;
            if (to != null && num > to)
                return false;
            return true;
        }
        if (type === 'date') {
            if (!filterValue && !filterValueTo)
                return true;
            var d = dateVal(cellValue);
            if (d == null)
                return false;
            var dFrom = dateVal(filterValue);
            var dTo = dateVal(filterValueTo);
            if (dFrom != null && d < dFrom)
                return false;
            if (dTo != null && d > dTo)
                return false;
            return true;
        }
        // text (default): case-insensitive contains/starts/equals
        if (filterValue == null || filterValue === '')
            return true;
        var s = safeString(cellValue);
        var fv = safeString(filterValue);
        if (matchMode === 'startsWith')
            return s.startsWith(fv);
        if (matchMode === 'equals')
            return s === fv;
        return s.indexOf(fv) >= 0;
    }
    function safeString(v) {
        return v == null ? '' : String(v).toLowerCase();
    }
    function numberVal(v) {
        if (v == null || v === '')
            return null;
        var n = Number(v);
        return isNaN(n) ? null : n;
    }
    function dateVal(v) {
        if (!v && v !== 0)
            return null;
        if (v instanceof Date)
            return v.getTime();
        var d = new Date(v);
        var t = d.getTime();
        return isNaN(t) ? null : t;
    }
    function groupAndFlattenRows(rows, cols, groupModel, aggModel, expanded) {
        if (!groupModel || groupModel.length === 0) {
            return { flat: rows.slice(), paths: [] };
        }
        var colMap = {};
        cols.forEach(function (c) {
            colMap[String(c.field)] = c;
        });
        var aggLookup = {};
        aggModel.forEach(function (a) {
            aggLookup[a.colId] = a;
        });
        var tree = buildGroupTree(rows, groupModel, colMap, aggLookup, 0, '');
        var paths = [];
        var flat = [];
        var isExpanded = function (path) {
            if (!expanded)
                return true;
            return expanded.has(path);
        };
        flatten(tree, isExpanded, flat, paths);
        return { flat: flat, paths: paths };
    }
    function buildGroupTree(rows, groupModel, colMap, aggLookup, level, prefix) {
        var _a;
        var colId = (_a = groupModel[level]) === null || _a === void 0 ? void 0 : _a.colId;
        if (!colId)
            return [];
        var col = colMap[colId];
        var groups = {};
        rows.forEach(function (row) {
            var key = col ? getCellValue(col, row) : undefined;
            var k = key == null ? '__null__' : String(key);
            if (!groups[k])
                groups[k] = [];
            groups[k].push(row);
        });
        var keys = Object.keys(groups).sort();
        var nodes = [];
        keys.forEach(function (k) {
            var keyRows = groups[k];
            var path = prefix ? prefix + '|' + k : k;
            var children;
            var leafRows;
            if (level < groupModel.length - 1) {
                children = buildGroupTree(keyRows, groupModel, colMap, aggLookup, level + 1, path);
            }
            else {
                leafRows = keyRows;
            }
            var agg = computeAggs(leafRows || collectLeafRows(children), colMap, aggLookup);
            nodes.push({
                key: k === '__null__' ? null : maybeOriginalKey(keyRows, col),
                colId: colId,
                level: level,
                path: path,
                count: leafRows ? leafRows.length : countLeaves(children),
                agg: agg,
                children: children,
                rows: leafRows,
            });
        });
        return nodes;
    }
    function maybeOriginalKey(rows, col) {
        if (!col || rows.length === 0)
            return null;
        return getCellValue(col, rows[0]);
    }
    function collectLeafRows(nodes) {
        if (!nodes || nodes.length === 0)
            return [];
        var out = [];
        nodes.forEach(function (n) {
            if (n.rows)
                out.push.apply(out, n.rows);
            else
                out.push.apply(out, collectLeafRows(n.children));
        });
        return out;
    }
    function countLeaves(nodes) {
        if (!nodes || nodes.length === 0)
            return 0;
        var total = 0;
        nodes.forEach(function (n) {
            if (n.rows)
                total += n.rows.length;
            else
                total += countLeaves(n.children);
        });
        return total;
    }
    function computeAggs(rows, colMap, aggLookup) {
        var agg = {};
        if (!rows || rows.length === 0)
            return agg;
        Object.keys(aggLookup).forEach(function (colId) {
            var aggItem = aggLookup[colId];
            var col = colMap[colId];
            var values = rows.map(function (r) {
                return col ? getCellValue(col, r) : undefined;
            });
            var fn = resolveAggFunc(aggItem.aggFunc, col);
            agg[colId] = fn(values);
        });
        return agg;
    }
    function pivotRows(rows, cols, pivot, expanded) {
        if (!pivot.enabled || !pivot.pivotCol || !pivot.valueCols.length) {
            return { rows: rows, dynamicCols: [], paths: [] };
        }
        var colMap = {};
        cols.forEach(function (c) {
            colMap[String(c.field)] = c;
        });
        var pivotCol = colMap[pivot.pivotCol];
        if (!pivotCol)
            return { rows: rows, dynamicCols: [], paths: [] };
        // Group rows by pivot value
        var pivotBuckets = {};
        var pivotValues = [];
        rows.forEach(function (r) {
            var key = getCellValue(pivotCol, r);
            var k = key == null ? '__null__' : String(key);
            if (!pivotBuckets[k]) {
                pivotBuckets[k] = [];
                pivotValues.push(k);
            }
            pivotBuckets[k].push(r);
        });
        // Build dynamic columns for pivot values x value cols
        var dynamicCols = [];
        pivotValues.forEach(function (pv) {
            pivot.valueCols.forEach(function (vcol) {
                var base = colMap[vcol.colId];
                dynamicCols.push({
                    field: 'pv:' + pv + ':' + vcol.colId,
                    headerName: ((base === null || base === void 0 ? void 0 : base.headerName) || vcol.colId) + ' ' + (pv === '__null__' ? '(blank)' : pv),
                    sortable: false,
                    filter: 'number',
                    width: 140,
                });
            });
        });
        // Compute aggregated rows per pivot value
        var out = [];
        Object.keys(pivotBuckets).forEach(function (pv) {
            var bucket = pivotBuckets[pv];
            var row = { __pivotKey: pv };
            pivot.valueCols.forEach(function (vcol) {
                var aggItem = vcol;
                var aggFn = resolveAggFunc(aggItem.aggFunc, colMap[vcol.colId]);
                var values = bucket.map(function (r) {
                    var c = colMap[vcol.colId];
                    return c ? getCellValue(c, r) : undefined;
                });
                row['pv:' + pv + ':' + vcol.colId] = aggFn(values);
            });
            out.push(row);
        });
        return { rows: out, dynamicCols: dynamicCols, paths: [] };
    }
    function resolveAggFunc(agg, col) {
        if (typeof agg === 'function')
            return agg;
        var numericAgg = function (values, reducer, start) {
            var nums = values
                .map(function (v) {
                return typeof v === 'number' ? v : Number(v);
            })
                .filter(function (v) {
                return !isNaN(v);
            });
            if (nums.length === 0)
                return null;
            return nums.reduce(reducer, start);
        };
        switch (agg) {
            case 'sum':
                return function (values) {
                    return numericAgg(values, function (a, b) { return a + b; }, 0);
                };
            case 'min':
                return function (values) {
                    return numericAgg(values, function (a, b) { return Math.min(a, b); }, Number.POSITIVE_INFINITY);
                };
            case 'max':
                return function (values) {
                    return numericAgg(values, function (a, b) { return Math.max(a, b); }, Number.NEGATIVE_INFINITY);
                };
            case 'avg':
                return function (values) {
                    var nums = values
                        .map(function (v) {
                        return typeof v === 'number' ? v : Number(v);
                    })
                        .filter(function (v) {
                        return !isNaN(v);
                    });
                    if (nums.length === 0)
                        return null;
                    var total = nums.reduce(function (a, b) { return a + b; }, 0);
                    return total / nums.length;
                };
            case 'count':
            default:
                return function (values) {
                    return values.length;
                };
        }
    }
    function flatten(nodes, isExpanded, out, paths) {
        nodes.forEach(function (n) {
            var gRow = {
                __group: true,
                key: n.key,
                colId: n.colId,
                level: n.level,
                path: n.path,
                count: n.count,
                agg: n.agg,
            };
            out.push(gRow);
            paths.push(n.path);
            if (isExpanded(n.path)) {
                if (n.children && n.children.length) {
                    flatten(n.children, isExpanded, out, paths);
                }
                else if (n.rows) {
                    out.push.apply(out, n.rows);
                }
            }
        });
    }

    function escapeCsv(v) {
        var s = v == null ? '' : String(v);
        // Escape quotes by doubling them
        if (s.indexOf('"') >= 0)
            s = s.replace(/"/g, '""');
        // Wrap if contains commas/newlines/quotes
        if (/[",\n\r]/.test(s))
            s = '"' + s + '"';
        return s;
    }
    function toCsv(rows, cols) {
        var headers = cols.map(function (c) {
            return escapeCsv(c.headerName != null ? c.headerName : String(c.field));
        });
        var lines = [];
        lines.push(headers.join(','));
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var line = cols.map(function (c) {
                var val = getCellValue(c, r);
                if (c.valueFormatter)
                    val = c.valueFormatter(val, r);
                return escapeCsv(val);
            });
            lines.push(line.join(','));
        }
        return lines.join('\n');
    }

    /*
     * Public API Surface of og-grid-core
     */

    /**
     * Generated bundle index. Do not edit.
     */

    exports.filterRows = filterRows;
    exports.getCellValue = getCellValue;
    exports.groupAndFlattenRows = groupAndFlattenRows;
    exports.mergeColDef = mergeColDef;
    exports.pivotRows = pivotRows;
    exports.sortRows = sortRows;
    exports.toCsv = toCsv;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=og-grid-core.umd.js.map
