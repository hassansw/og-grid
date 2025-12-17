import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OgGridAngularComponent } from './og-grid-angular.component';

describe('OgGridAngularComponent', () => {
  let component: OgGridAngularComponent;
  let fixture: ComponentFixture<OgGridAngularComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OgGridAngularComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OgGridAngularComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
