import { TestBed } from '@angular/core/testing';

import { OgGridAngularService } from './og-grid-angular.service';

describe('OgGridAngularService', () => {
  let service: OgGridAngularService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OgGridAngularService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
