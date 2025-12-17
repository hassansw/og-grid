import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OgGridComponent } from './og-grid.component';

@NgModule({
    declarations: [OgGridComponent],
    imports: [CommonModule, FormsModule],
    exports: [OgGridComponent],
})
export class OgGridModule { }
