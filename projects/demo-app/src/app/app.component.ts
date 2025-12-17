import { Component, ViewChild } from '@angular/core';
import { ColumnDef } from 'og-grid-core';
import { OgGridComponent } from 'og-grid-angular';

type Row = { make: string; model: string; price: number };

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  @ViewChild('grid') grid?: OgGridComponent<Row>;

  columnDefs: ColumnDef<Row>[] = [
    { field: 'make', sortable: true },
    { field: 'model', sortable: true },
    { field: 'price', sortable: true, valueFormatter: (v: any) => (v == null ? '' : '$' + v) },

  ];

  rowData: Row[] = [
    { make: 'Toyota', model: 'Celica', price: 35000 },
    { make: 'Ford', model: 'Mondeo', price: 32000 },
    { make: 'Porsche', model: 'Boxster', price: 72000 },
  ];

  options = {
    rowSelection: 'multiple' as const,
    defaultColDef: { minWidth: 80 },
  };

  exportCsv(): void {
    if (this.grid) this.grid.api.exportCsv('og-grid-demo.csv');
  }
}
