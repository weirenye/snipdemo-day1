import { isDevMode, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ShortLink {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinksApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = isDevMode() ? 'http://localhost:3000' : '';

  listLinks(): Observable<ShortLink[]> {
    return this.http.get<ShortLink[]>(`${this.apiBaseUrl}/api/links`);
  }

  createLink(url: string): Observable<ShortLink> {
    return this.http.post<ShortLink>(`${this.apiBaseUrl}/api/links`, { url });
  }
}
