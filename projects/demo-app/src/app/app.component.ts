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

  // rowData: any[] = []
  rowData: any[] = [
    {
      "Shipment_Id": 55884,
      "Shipment_Number": "HM-2511270002",
      "Shipment_Date": "2025-11-27",
      "Shipment_Status": "In-Transit",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "CMA CGM Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Karachi",
      "Destination": "Jeddah",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55841,
      "Shipment_Number": "HM-2511250004",
      "Shipment_Date": "2025-11-25",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "CMA CGM Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Singapore",
      "Destination": "Karachi",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55842,
      "Shipment_Number": "HM-2511250005",
      "Shipment_Date": "2025-11-25",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "CMA CGM Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Singapore",
      "Destination": "Karachi",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55876,
      "Shipment_Number": "HM-2511250032",
      "Shipment_Date": "2025-11-25",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "CMA CGM Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Karachi",
      "Destination": "Jeddah",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55877,
      "Shipment_Number": "HM-2511250033",
      "Shipment_Date": "2025-11-25",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "CMA CGM Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Karachi",
      "Destination": "Jeddah",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55821,
      "Shipment_Number": "HM-2511240019",
      "Shipment_Date": "2025-11-24",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "Any Carrier",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Jeddah",
      "Destination": "Karachi",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Imran Khan"
    },
    {
      "Shipment_Id": 55783,
      "Shipment_Number": "HM-2511210005",
      "Shipment_Date": "2025-11-21",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "Maersk Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "ANKARA",
      "Destination": "Colombo",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "sean paul"
    },
    {
      "Shipment_Id": 55759,
      "Shipment_Number": "HM-2511200001",
      "Shipment_Date": "2025-11-20",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "Maersk Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Abadan",
      "Destination": "Adelaide",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55763,
      "Shipment_Number": "HM-2511200005",
      "Shipment_Date": "2025-11-20",
      "Shipment_Status": "In-Review",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "Maersk Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Abadan",
      "Destination": "Adelaide",
      "Bill_Of_Lading_Number": null,
      "Bill_Of_Lading_Date": null,
      "Booked_By": "Asif Sattar"
    },
    {
      "Shipment_Id": 55645,
      "Shipment_Number": "HM-2511130004",
      "Shipment_Date": "2025-11-13",
      "Shipment_Status": "In-Transit",
      "Customer_Name": "Atco Laboratories",
      "Carrier_Name": "CMA CGM Shipping",
      "Service_Provider_Name": "Costa Logistics",
      "Cargo_Category": "General Goods",
      "Transport_Mode_Title": "SEA",
      "Origin": "Jeddah",
      "Destination": "Karachi",
      "Bill_Of_Lading_Number": "bl-0987623456789",
      "Bill_Of_Lading_Date": "2025-11-13",
      "Booked_By": "Asif Sattar"
    }
  ];



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
