import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserList } from './admin/user-list/user-list';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UserList],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'esibuy-frontend';
}