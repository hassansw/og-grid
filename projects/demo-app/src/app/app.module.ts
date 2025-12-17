import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { OgGridModule } from 'og-grid-angular';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, OgGridModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
