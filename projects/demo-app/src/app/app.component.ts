import { Component, OnInit, ViewChild } from '@angular/core';
import { ColumnDef } from 'og-grid-core';
import { OgGridComponent } from 'og-grid-angular';

type Row = {
  make: string;
  model: string;
  year: number;
  price: number;
  units: number;
  releaseDate: string;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  @ViewChild('grid') grid?: OgGridComponent<Row>;

  columnDefs: ColumnDef[] = [];
  // columnDefs: ColumnDef<Row>[] = [
  //   { field: 'make', headerName: 'Make', filter: 'text', sortable: true },
  //   { field: 'model', headerName: 'Model', filter: 'text', sortable: true },
  //   { field: 'year', headerName: 'Year', filter: 'number', sortable: true, aggFunc: 'avg' },
  //   { field: 'price', headerName: 'Price', filter: 'number', sortable: true, aggFunc: 'sum', valueFormatter: (v: any) => (v == null ? '' : '$' + v.toLocaleString()), },
  //   { field: 'units', headerName: 'Units Sold', filter: 'number', sortable: true, aggFunc: 'sum' },
  //   { field: 'releaseDate', headerName: 'Release', filter: 'date', sortable: true },
  // ];

  rowData: any[] = []
  // rowData: Row[] = [
  //   { make: 'Toyota', model: 'Corolla', year: 2020, price: 22000, units: 1200, releaseDate: '2020-02-12' },
  //   { make: 'Toyota', model: 'Camry', year: 2021, price: 27000, units: 950, releaseDate: '2021-03-18' },
  //   { make: 'Toyota', model: 'Prius', year: 2019, price: 25000, units: 640, releaseDate: '2019-05-05' },
  //   { make: 'Ford', model: 'F-150', year: 2022, price: 41000, units: 1500, releaseDate: '2022-01-22' },
  //   { make: 'Ford', model: 'Mustang', year: 2021, price: 55000, units: 430, releaseDate: '2021-04-10' },
  //   { make: 'Ford', model: 'Escape', year: 2020, price: 32000, units: 870, releaseDate: '2020-07-30' },
  //   { make: 'Honda', model: 'Civic', year: 2022, price: 24000, units: 1100, releaseDate: '2022-02-14' },
  //   { make: 'Honda', model: 'Accord', year: 2021, price: 28000, units: 760, releaseDate: '2021-06-09' },
  //   { make: 'Honda', model: 'CR-V', year: 2020, price: 30000, units: 980, releaseDate: '2020-09-01' },
  //   { make: 'Porsche', model: 'Boxster', year: 2022, price: 82000, units: 120, releaseDate: '2022-03-12' },
  //   { make: 'Porsche', model: 'Cayenne', year: 2021, price: 92000, units: 210, releaseDate: '2021-08-21' },
  // ];



  ngOnInit(): void {
    // this.columnDefs = this.buildColumnDefs(this.rowData);
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
        field: k, headerName: k, filter: true, sortable: true, resizable: true,
        enableRowGroup: true, enablePivot: true, enableValue: true
      };
      if (t === 'number') { col.aggFunc = 'sum'; }
      if (t === 'date') { col.filter = 'agDateColumnFilter'; }
      return col;
    });
  }

  options = {
    rowSelection: 'multiple' as const,
    multiSort: true,
    showSelection: true,
    defaultColDef: { minWidth: 110 },
  };

  exportCsv(): void {
    this.grid?.api.exportCsv('og-grid-demo.csv');
  }

  groupByMakeModel(): void {
    this.grid?.api.setGroupModel([{ colId: 'make' }, { colId: 'model' }]);
  }

  clearGroups(): void {
    this.grid?.api.setGroupModel([]);
  }
}
