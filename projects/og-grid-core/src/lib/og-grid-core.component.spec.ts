import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OgGridCoreComponent } from './og-grid-core.component';

describe('OgGridCoreComponent', () => {
  let component: OgGridCoreComponent;
  let fixture: ComponentFixture<OgGridCoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OgGridCoreComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OgGridCoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
