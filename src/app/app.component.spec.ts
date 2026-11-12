import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { ShortLink } from './links-api.service';

describe('AppComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function createComponent() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:3000/api/links').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  function enterUrl(fixture: ReturnType<typeof createComponent>, url: string) {
    const input = fixture.nativeElement.querySelector('#url') as HTMLInputElement;
    input.value = url;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(fixture: ReturnType<typeof createComponent>) {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('loads the links table and displays its empty state', () => {
    const fixture = createComponent();
    expect(fixture.nativeElement.textContent).toContain('No links yet.');
  });

  it('rejects non-HTTP URLs before sending a request', () => {
    const fixture = createComponent();
    enterUrl(fixture, 'ftp://example.com/file');
    submit(fixture);

    expect(fixture.nativeElement.textContent).toContain(
      'Enter a valid URL that starts with http:// or https://.',
    );
    httpTesting.expectNone('http://localhost:3000/api/links');
  });

  it('creates a link and refreshes the links table', () => {
    const fixture = createComponent();
    const link: ShortLink = {
      code: 'Ab12Cd',
      url: 'https://example.com/article',
      shortUrl: 'http://localhost:3000/Ab12Cd',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    enterUrl(fixture, link.url);
    submit(fixture);
    httpTesting
      .expectOne('http://localhost:3000/api/links')
      .flush(link, { status: 201, statusText: 'Created' });
    httpTesting.expectOne('http://localhost:3000/api/links').flush([link]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(link.shortUrl);
    expect(fixture.nativeElement.textContent).toContain(link.url);
    expect(fixture.nativeElement.textContent).toContain('Ab12Cd');
  });

  it('shows server validation errors inline', () => {
    const fixture = createComponent();
    enterUrl(fixture, 'https://example.com');
    submit(fixture);
    httpTesting
      .expectOne('http://localhost:3000/api/links')
      .flush(
        { error: 'url must be a valid HTTP(S) URL' },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'url must be a valid HTTP(S) URL',
    );
  });
});
