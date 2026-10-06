import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HomeInfo } from './home-info';

const HOME_API_URL = 'http://localhost:8080/api/public/home';

@Injectable({ providedIn: 'root' })
export class HomeApiService {
  private readonly http = inject(HttpClient);

  getHomeInfo(): Observable<HomeInfo> {
    return this.http.get<HomeInfo>(HOME_API_URL);
  }
}
