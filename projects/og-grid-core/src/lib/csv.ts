import { ColumnDef } from './types';
import { getCellValue } from './engine';

function escapeCsv(v: any): string {
    var s = v == null ? '' : String(v);
    // Escape quotes by doubling them
    if (s.indexOf('"') >= 0) s = s.replace(/"/g, '""');
    // Wrap if contains commas/newlines/quotes
    if (/[",\n\r]/.test(s)) s = '"' + s + '"';
    return s;
}

export function toCsv<T>(rows: T[], cols: ColumnDef<T>[]): string {
    var headers = cols.map(function (c) {
        return escapeCsv(c.headerName != null ? c.headerName : String(c.field));
    });

    var lines: string[] = [];
    lines.push(headers.join(','));

    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var line = cols.map(function (c) {
            var val = getCellValue(c, r);
            if (c.valueFormatter) val = c.valueFormatter(val, r);
            return escapeCsv(val);
        });
        lines.push(line.join(','));
    }

    return lines.join('\n');
}
