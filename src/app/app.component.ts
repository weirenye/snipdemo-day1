import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LinksApiService, ShortLink } from './links-api.service';

function httpUrlValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = control.value.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'Could not reach the Snip API. Check the server connection and try again.';
  }

  if (
    error instanceof HttpErrorResponse &&
    typeof error.error?.error === 'string'
  ) {
    return error.error.error;
  }

  return fallback;
}

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly form = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2048), httpUrlValidator],
    }),
  });

  readonly links = signal<ShortLink[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly listError = signal('');
  readonly submitError = signal('');
  readonly createdLink = signal<ShortLink | null>(null);

  constructor(private readonly api: LinksApiService) {}

  ngOnInit(): void {
    this.loadLinks();
  }

  get urlControl(): FormControl<string> {
    return this.form.controls.url;
  }

  get urlError(): string {
    if (this.urlControl.hasError('required')) return 'Enter a URL to shorten.';
    if (this.urlControl.hasError('maxlength')) {
      return 'URLs must be 2048 characters or fewer.';
    }
    if (this.urlControl.hasError('httpUrl')) {
      return 'Enter a valid URL that starts with http:// or https://.';
    }
    return '';
  }

  submit(): void {
    if (this.isSubmitting()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.createdLink.set(null);
      this.submitError.set('');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.createdLink.set(null);

    this.api.createLink(this.urlControl.value.trim()).subscribe({
      next: (link) => {
        this.isSubmitting.set(false);
        this.createdLink.set(link);
        this.form.reset();
        this.loadLinks();
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.submitError.set(
          errorMessage(error, 'The link could not be created. Please try again.'),
        );
      },
    });
  }

  loadLinks(): void {
    this.isLoading.set(true);
    this.listError.set('');

    this.api.listLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.listError.set(
          errorMessage(error, 'Links could not be loaded. Please try again.'),
        );
        this.isLoading.set(false);
      },
    });
  }
}
