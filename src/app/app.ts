import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmacionHost } from './shared/confirmacion/confirmacion-host';
import { ToastContainer } from './shared/toast/toast-container';

@Component({
  imports: [RouterOutlet, ToastContainer, ConfirmacionHost],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
