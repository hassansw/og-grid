import { TestBed } from '@angular/core/testing';

import { OgGridCoreService } from './og-grid-core.service';

describe('OgGridCoreService', () => {
  let service: OgGridCoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OgGridCoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
